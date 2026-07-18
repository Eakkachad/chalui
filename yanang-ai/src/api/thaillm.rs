//! ThaiLLM API client — OpenAI-compatible interface
//! Endpoint: http://thaillm.or.th/api/v1/chat/completions

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::AppState;

/// OpenAI-compatible chat message
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

/// Request body for chat completions
#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    max_tokens: u32,
    temperature: f32,
    top_p: f32,
}

/// Response from chat completions (OpenAI-compatible)
#[derive(Debug, Deserialize)]
pub struct ChatResponse {
    pub choices: Vec<Choice>,
}

/// A single choice from the API
#[derive(Debug, Deserialize)]
pub struct Choice {
    pub message: ChatMessage,
}

/// Send a chat message to ThaiLLM and get the response
pub async fn send_chat(
    state: &Arc<AppState>,
    messages: Vec<ChatMessage>,
    temperature: f32,
    max_tokens: u32,
) -> Result<String, String> {
    let request_body = ChatRequest {
        model: state.model.clone(),
        messages,
        max_tokens,
        temperature,
        top_p: 0.95,
    };

    let resp = state
        .client
        .post(&state.api_url)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", state.api_key))
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("เชื่อมต่อ ThaiLLM ไม่สำเร็จ: {}", e))?;

    let status = resp.status();
    let body = resp
        .text()
        .await
        .map_err(|e| format!("อ่าน response ไม่สำเร็จ: {}", e))?;

    if !status.is_success() {
        return Err(format!("ThaiLLM Error ({}): {}", status, body));
    }

    let parsed: ChatResponse =
        serde_json::from_str(&body).map_err(|e| format!("JSON parse error: {} — body: {}", e, body))?;

    parsed
        .choices
        .into_iter()
        .next()
        .map(|c| c.message.content)
        .ok_or_else(|| "ThaiLLM ไม่ได้ส่ง response กลับมา".to_string())
}

/// Free-text intent classification using ThaiLLM itself
#[allow(dead_code)]
pub async fn classify_intent(
    state: &Arc<AppState>,
    user_message: &str,
    conversation_history: &[ChatMessage],
) -> Result<String, String> {
    let system_prompt = r#"คุณคือตัวจำแนกเจตนา (Intent Classifier) สำหรับย่านาง AI ผู้ช่วยนำทาง
ตอบกลับด้วยคำเดียวเท่านั้น ใน list นี้: "navigate", "poi", "traffic", "weather", "chat", "food"
- "navigate" = ต้องการเส้นทาง/วิธีเดินทาง
- "poi" = ถามเกี่ยวกับสถานที่
- "traffic" = สภาพจราจร
- "weather" = สภาพอากาศ
- "food" = ร้านอาหาร/ร้านกาแฟ
- "chat" = ทั่วไป"#;

    let mut messages = vec![ChatMessage {
        role: "system".to_string(),
        content: system_prompt.to_string(),
    }];
    messages.extend_from_slice(conversation_history);
    messages.push(ChatMessage {
        role: "user".to_string(),
        content: user_message.to_string(),
    });

    send_chat(state, messages, 0.3, 50).await
}
