//! Chat & style routes for ย่านาง AI — Day 2 intelligence layer

use axum::{
    extract::State,
    response::sse::{Event, Sse},
    Json,
};
use futures_util::stream::Stream;
use serde::{Deserialize, Serialize};
use std::{convert::Infallible, sync::Arc};

use crate::api::thaillm::{self, ChatMessage};
use crate::engine::intent::{self, Intent};
use crate::engine::personality::{self, YanangPersonality};
use crate::engine::salience::{SalienceConfig, SpeakDecision, YanangSalienceGate};
use crate::prompts::templates::{build_guardrailed_prompt, YanangStyle};
use crate::AppState;

/// Incoming chat request
#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    pub message: String,
    pub style: Option<String>,
    pub history: Option<Vec<Message>>,
    /// เพิ่มใหม่สำหรับ push-to-talk voice assistant — มีเฉพาะคำขอที่มาจาก Voice_Controller
    /// ไม่มี field นี้เลยสำหรับคำขอแบบพิมพ์ (backward compatible 100%)
    pub voice_context: Option<VoiceContext>,
}

/// บริบทเพิ่มเติมที่แนบมาจาก Voice_Controller — ตำแหน่งผู้ใช้ + โครงการก่อสร้างใกล้เคียง
#[derive(Debug, Deserialize)]
pub struct VoiceContext {
    pub location: Option<GeoPoint>,
    pub nearby_projects: Option<Vec<NearbyProjectContext>>,
}

#[derive(Debug, Deserialize)]
pub struct GeoPoint {
    pub lat: f64,
    pub lng: f64,
}

#[derive(Debug, Deserialize, Clone)]
pub struct NearbyProjectContext {
    pub name: String,
    pub road_name: String,
    pub distance_m: f64,
    pub compliance_verdict: String,
}

/// Pure — สร้าง fragment ของ system prompt จาก VoiceContext หรือ None ถ้าไม่มีข้อมูล
/// ไม่มี side effect ใดๆ ทดสอบได้ตรงๆโดยไม่ต้องพึ่ง Axum/HTTP
pub fn build_voice_context_prompt_fragment(ctx: &Option<VoiceContext>) -> Option<String> {
    let ctx = ctx.as_ref()?;

    let mut lines: Vec<String> = Vec::new();

    if let Some(loc) = &ctx.location {
        lines.push(format!(
            "ตำแหน่งปัจจุบันของผู้ใช้: ละติจูด {:.4}, ลองจิจูด {:.4}",
            loc.lat, loc.lng
        ));
    }

    if let Some(projects) = &ctx.nearby_projects {
        if !projects.is_empty() {
            lines.push("โครงการก่อสร้างใกล้เคียง:".to_string());
            for p in projects {
                lines.push(format!(
                    "- {} บนถนน{} ห่างออกไป {:.0} เมตร (สถานะ: {})",
                    p.name, p.road_name, p.distance_m, p.compliance_verdict
                ));
            }
        }
    }

    if lines.is_empty() {
        return None;
    }

    Some(format!("[บริบทตำแหน่งและโครงการก่อสร้าง]\n{}", lines.join("\n")))
}

/// Simplified message for frontend exchange
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Message {
    pub role: String,
    pub content: String,
}

/// Chat response
#[derive(Debug, Serialize)]
pub struct ChatResponse {
    pub response: String,
    pub style: String,
    pub intent: String,
    pub personality: Vec<f32>,
}

/// List available styles
#[derive(Debug, Serialize)]
pub struct StyleList {
    pub styles: Vec<StyleItem>,
}

#[derive(Debug, Serialize)]
pub struct StyleItem {
    pub id: String,
    pub name: &'static str,
    pub description: &'static str,
    pub default_weight: f32,
}

/// Personality response from the kernel
#[derive(Debug, Serialize)]
pub struct PersonalityState {
    pub weights: [f32; personality::NUM_STYLES],
    pub activations: [f32; personality::NUM_STYLES],
    pub dominant_style: String,
    pub dominant_activation: f32,
}

/// POST /api/chat — with personality engine
pub async fn chat_handler(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ChatRequest>,
) -> Result<Json<ChatResponse>, (axum::http::StatusCode, String)> {
    // ── 1. Resolve style from request ──
    let (style, style_key) = resolve_style(&req);

    // ── 2. Classify intent ──
    let user_intent = intent::classify_intent(&req.message);
    let intent_label = format!("{:?}", user_intent);

    // ── 3. Build personality engine ──
    let mut personality = YanangPersonality::new();
    if style_key != "default" {
        let idx = style_idx(&style_key);
        personality.set_style(idx);
    }
    let activations = personality.style_activations();

    // ── 4. Check salience ──
    let salience_config = SalienceConfig::default();
    let mut salience_gate = YanangSalienceGate::new(salience_config);
    let decision = salience_gate.decide(
        &req.message,
        YanangSalienceGate::is_question(&req.message),
        false,
        YanangSalienceGate::is_direct_address(&req.message),
    );

    // ── 5. Build system prompt with guardrails ──
    let intent_context = match user_intent {
        Intent::Navigate => "การนำทาง — ผู้ใช้ต้องการเส้นทาง",
        Intent::Poi => "สถานที่ — ผู้ใช้ถามเกี่ยวกับสถานที่",
        Intent::Traffic => "จราจร — ผู้ใช้สอบถามสภาพการจราจร",
        Intent::Weather => "อากาศ — ผู้ใช้สอบถามสภาพอากาศ",
        Intent::Food => "อาหาร — ผู้ใช้ถามเกี่ยวกับร้านอาหาร",
        Intent::Chat => "ทั่วไป — ผู้ใช้ต้องการพูดคุย",
    };

    let mut system_prompt = build_guardrailed_prompt(&style, intent_context);
    if let Some(fragment) = build_voice_context_prompt_fragment(&req.voice_context) {
        system_prompt.push_str("\n\n");
        system_prompt.push_str(&fragment);
    }

    // ── 6. Build message list for API ──
    let mut messages: Vec<ChatMessage> = vec![ChatMessage {
        role: "system".to_string(),
        content: system_prompt,
    }];

    // Add conversation history (last 20 messages)
    if let Some(history) = &req.history {
        for msg in history.iter() {
            messages.push(ChatMessage {
                role: msg.role.clone(),
                content: msg.content.clone(),
            });
        }
    }

    // Add current user message
    messages.push(ChatMessage {
        role: "user".to_string(),
        content: req.message.clone(),
    });

    // ── 7. Decide: speak or silent ──
    let response = match decision {
        SpeakDecision::Speak => {
            // Call ThaiLLM API — lower temp for focus
            let temp = match style {
                YanangStyle::Serious | YanangStyle::Professional => 0.2,
                YanangStyle::Concise => 0.2,
                YanangStyle::Cheerful | YanangStyle::Friendly => 0.4,
            };
            thaillm::send_chat(&state, messages, temp, 2048)
                .await
                .map_err(|e| {
                    (
                        axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                        serde_json::json!({"error": e}).to_string(),
                    )
                })?
        }
        SpeakDecision::Silent => {
            // Stay silent — return empty response (frontend handles)
            String::new()
        }
        SpeakDecision::Delegate => {
            // Delegate to a specific skill (future)
            "ฉันกำลังตรวจสอบข้อมูลให้นะคะ รอสักครู่...".to_string()
        }
    };

    // ── 8. Convert activations to Vec<f32> for frontend ──
    let act_vec: Vec<f32> = activations.iter().copied().collect();

    if response.is_empty() {
        // Silent — just return style info
        Ok(Json(ChatResponse {
            response: String::new(),
            style: style_key.clone(),
            intent: intent_label,
            personality: act_vec,
        }))
    } else {
        Ok(Json(ChatResponse {
            response,
            style: style_key.clone(),
            intent: intent_label,
            personality: act_vec,
        }))
    }
}

/// POST /api/chat/stream — SSE streaming version
pub async fn chat_stream_handler(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ChatRequest>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    use futures_util::stream;

    let (style, _style_key) = resolve_style(&req);
    let user_intent = intent::classify_intent(&req.message);

    let intent_context = match user_intent {
        Intent::Navigate => "การนำทาง — ผู้ใช้ต้องการเส้นทาง",
        Intent::Poi => "สถานที่ — ผู้ใช้ถามเกี่ยวกับสถานที่",
        Intent::Traffic => "จราจร — ผู้ใช้สอบถามสภาพการจราจร",
        Intent::Weather => "อากาศ — ผู้ใช้สอบถามสภาพอากาศ",
        Intent::Food => "อาหาร — ผู้ใช้ถามเกี่ยวกับร้านอาหาร",
        Intent::Chat => "ทั่วไป — ผู้ใช้ต้องการพูดคุย",
    };

    let system_prompt = build_guardrailed_prompt(&style, intent_context);

    let mut messages: Vec<ChatMessage> = vec![ChatMessage {
        role: "system".to_string(),
        content: system_prompt,
    }];

    if let Some(history) = &req.history {
        for msg in history.iter() {
            messages.push(ChatMessage {
                role: msg.role.clone(),
                content: msg.content.clone(),
            });
        }
    }

    messages.push(ChatMessage {
        role: "user".to_string(),
        content: req.message.clone(),
    });

    let temp = match style {
        YanangStyle::Serious | YanangStyle::Professional => 0.2,
        YanangStyle::Concise => 0.2,
        YanangStyle::Cheerful | YanangStyle::Friendly => 0.4,
        _ => 0.7,
    };

    // For streaming, we make the API call and then stream the response chunk by chunk
    // (SSE simulation — real token-by-token streaming needs server-sent events from API)
    let response = thaillm::send_chat(&state, messages, temp, 2048)
        .await
        .unwrap_or_else(|e| format!("ขอโทษค่ะ มีข้อผิดพลาด: {}", e));

    // Split into sentences/paragraphs for streaming effect
    let chunks: Vec<String> = response
        .split_inclusive(|c| c == '.' || c == '!' || c == '?' || c == '\n' || c == '\r')
        .map(|s| s.to_string())
        .filter(|s| !s.is_empty())
        .collect();

    let chunks = if chunks.is_empty() {
        vec![response]
    } else {
        chunks
    };

    let stream = stream::iter(chunks.into_iter().enumerate().map(move |(i, chunk)| {
        Ok(Event::default()
            .data(chunk)
            .event(if i == 0 { "start" } else { "chunk" }))
    }));

    Sse::new(stream).keep_alive(
        axum::response::sse::KeepAlive::new().interval(std::time::Duration::from_secs(5)),
    )
}

/// GET /api/styles
pub async fn styles_handler() -> Json<StyleList> {
    let raw = YanangStyle::all();
    let default_weights = [3.0, 0.0, 0.0, 2.0, 0.0]; // cheerful + friendly
    let styles: Vec<StyleItem> = raw
        .into_iter()
        .enumerate()
        .map(|(i, (style, name, desc))| StyleItem {
            id: style_id(&style),
            name,
            description: desc,
            default_weight: default_weights[i],
        })
        .collect();

    Json(StyleList { styles })
}

/// GET /api/personality — get current personality state
pub async fn personality_handler(State(_state): State<Arc<AppState>>) -> Json<PersonalityState> {
    let personality = YanangPersonality::new();
    let activations = personality.style_activations();
    let (dom_idx, dom_act) = personality.dominant_style();

    Json(PersonalityState {
        weights: personality.kernel.w,
        activations,
        dominant_style: personality::STYLE_NAMES[dom_idx].to_string(),
        dominant_activation: dom_act,
    })
}

/// POST /api/personality/set — set personality weights
pub async fn set_personality_handler(
    State(_state): State<Arc<AppState>>,
    Json(weights): Json<[f32; personality::NUM_STYLES]>,
) -> Json<PersonalityState> {
    let mut personality = YanangPersonality::new();
    personality.blend_styles(&weights);
    let activations = personality.style_activations();
    let (dom_idx, dom_act) = personality.dominant_style();

    Json(PersonalityState {
        weights: personality.kernel.w,
        activations,
        dominant_style: personality::STYLE_NAMES[dom_idx].to_string(),
        dominant_activation: dom_act,
    })
}

// ─── Helper functions ───

fn resolve_style(req: &ChatRequest) -> (YanangStyle, String) {
    let s = req.style.as_deref().unwrap_or("cheerful");
    let style = match s {
        "serious" => YanangStyle::Serious,
        "concise" => YanangStyle::Concise,
        "friendly" => YanangStyle::Friendly,
        "professional" => YanangStyle::Professional,
        _ => YanangStyle::Cheerful,
    };
    let key = match style {
        YanangStyle::Cheerful => "cheerful",
        YanangStyle::Serious => "serious",
        YanangStyle::Concise => "concise",
        YanangStyle::Friendly => "friendly",
        YanangStyle::Professional => "professional",
    };
    (style, key.to_string())
}

fn style_idx(key: &str) -> usize {
    match key {
        "serious" => personality::S_SERIOUS,
        "concise" => personality::S_CONCISE,
        "friendly" => personality::S_FRIENDLY,
        "professional" => personality::S_PROFESSIONAL,
        _ => personality::S_CHEERFUL,
    }
}

fn style_id(style: &YanangStyle) -> String {
    match style {
        YanangStyle::Cheerful => "cheerful",
        YanangStyle::Serious => "serious",
        YanangStyle::Concise => "concise",
        YanangStyle::Friendly => "friendly",
        YanangStyle::Professional => "professional",
    }
    .to_string()
}

#[cfg(test)]
mod voice_context_tests {
    use super::*;
    use proptest::prelude::*;

    // Feature: push-to-talk-voice-assistant, Property 19: Voice context is embedded into the system prompt (backend)
    proptest! {
        #![proptest_config(ProptestConfig { cases: 100, ..ProptestConfig::default() })]

        #[test]
        fn property_19_fragment_contains_location_and_projects(
            lat in -90.0f64..90.0,
            lng in -180.0f64..180.0,
            include_location in proptest::bool::ANY,
            project_names in proptest::collection::vec("[a-zA-Z ]{1,20}", 0..5),
        ) {
            let projects: Vec<NearbyProjectContext> = project_names
                .iter()
                .enumerate()
                .map(|(i, name)| NearbyProjectContext {
                    name: name.clone(),
                    road_name: format!("Road{}", i),
                    distance_m: (i as f64) * 100.0,
                    compliance_verdict: "pass".to_string(),
                })
                .collect();

            let ctx = Some(VoiceContext {
                location: if include_location { Some(GeoPoint { lat, lng }) } else { None },
                nearby_projects: if projects.is_empty() { None } else { Some(projects.clone()) },
            });

            let fragment = build_voice_context_prompt_fragment(&ctx);

            if !include_location && projects.is_empty() {
                // ไม่มีข้อมูลอะไรเลย -> None
                prop_assert!(fragment.is_none());
            } else {
                let text = fragment.expect("fragment should be Some when data is present");
                if include_location {
                    let lat_str = format!("{:.4}", lat);
                    let lng_str = format!("{:.4}", lng);
                    prop_assert!(text.contains(&lat_str));
                    prop_assert!(text.contains(&lng_str));
                }
                for p in &projects {
                    let distance_str = format!("{:.0}", p.distance_m);
                    prop_assert!(text.contains(&p.name));
                    prop_assert!(text.contains(&distance_str));
                }
            }
        }
    }

    // Feature: push-to-talk-voice-assistant, Property 20: Requests without voice context process identically to today (backend)
    proptest! {
        #![proptest_config(ProptestConfig { cases: 100, ..ProptestConfig::default() })]

        #[test]
        fn property_20_none_voice_context_produces_no_fragment(
            style_seed in 0u8..5,
            intent_seed in 0u8..6,
        ) {
            let styles = [
                YanangStyle::Cheerful,
                YanangStyle::Serious,
                YanangStyle::Concise,
                YanangStyle::Friendly,
                YanangStyle::Professional,
            ];
            let intents = [
                "การนำทาง — ผู้ใช้ต้องการเส้นทาง",
                "สถานที่ — ผู้ใช้ถามเกี่ยวกับสถานที่",
                "จราจร — ผู้ใช้สอบถามสภาพการจราจร",
                "อากาศ — ผู้ใช้สอบถามสภาพอากาศ",
                "อาหาร — ผู้ใช้ถามเกี่ยวกับร้านอาหาร",
                "ทั่วไป — ผู้ใช้ต้องการพูดคุย",
            ];
            let style = styles[style_seed as usize];
            let intent_context = intents[intent_seed as usize];

            let baseline_prompt = build_guardrailed_prompt(&style, intent_context);

            // จำลองสิ่งที่ chat_handler ทำเมื่อ voice_context เป็น None
            let ctx: Option<VoiceContext> = None;
            let mut system_prompt = build_guardrailed_prompt(&style, intent_context);
            if let Some(fragment) = build_voice_context_prompt_fragment(&ctx) {
                system_prompt.push_str("\n\n");
                system_prompt.push_str(&fragment);
            }

            prop_assert!(build_voice_context_prompt_fragment(&ctx).is_none());
            prop_assert_eq!(system_prompt, baseline_prompt);
        }
    }

    /// Smoke test: backward-compat ที่ระดับ wire format
    ///
    /// หมายเหตุ: ไม่ได้ boot axum router จริงแล้วยิง POST เพราะ chat_handler เรียก ThaiLLM API
    /// จริงผ่าน network (ไม่มี mock layer สำหรับ thaillm::send_chat ในโค้ดปัจจุบัน) การยิง network
    /// call จริงในเทสต์จะ flaky/พึ่งพา external service ที่ควบคุมไม่ได้ จึงตรวจสอบที่จุดเสี่ยงจริง
    /// ของ backward-compat แทน: payload แบบเดิม (ไม่มี field `voice_context` เลย) ต้อง deserialize
    /// เป็น ChatRequest ได้สำเร็จเหมือนก่อนมี field นี้
    #[test]
    fn smoke_legacy_payload_without_voice_context_deserializes() {
        let legacy_json = r#"{
            "message": "พาไปสยาม",
            "style": "cheerful",
            "history": [{"role": "user", "content": "สวัสดี"}]
        }"#;

        let parsed: Result<ChatRequest, _> = serde_json::from_str(legacy_json);
        assert!(
            parsed.is_ok(),
            "legacy payload without voice_context must still deserialize: {:?}",
            parsed.err()
        );
        let req = parsed.unwrap();
        assert!(req.voice_context.is_none());
        assert_eq!(req.message, "พาไปสยาม");
    }

    #[test]
    fn smoke_payload_with_voice_context_deserializes() {
        let voice_json = r#"{
            "message": "มีงานก่อสร้างข้างหน้าไหม",
            "style": "concise",
            "history": [],
            "voice_context": {
                "location": {"lat": 13.7563, "lng": 100.5018},
                "nearby_projects": [
                    {"name": "Test Project", "road_name": "Test Road", "distance_m": 250.0, "compliance_verdict": "fail"}
                ]
            }
        }"#;

        let parsed: Result<ChatRequest, _> = serde_json::from_str(voice_json);
        assert!(parsed.is_ok(), "voice payload must deserialize: {:?}", parsed.err());
        let req = parsed.unwrap();
        assert!(req.voice_context.is_some());
    }
}
