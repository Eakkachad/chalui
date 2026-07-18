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

    let system_prompt = build_guardrailed_prompt(&style, intent_context);

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
