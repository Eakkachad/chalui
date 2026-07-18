//! Simplified SalienceTriGate for ย่านาง AI
//! Decides whether to Speak / Stay Silent / Delegate
//! Based on the katgpt SalienceTriGate primitive (Plan 303)

use katgpt_personality::sigmoid::sigmoid;

/// Decision outcome
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SpeakDecision {
    /// Respond to the user
    Speak,
    /// Stay silent (user may be thinking or talking to someone else)
    Silent,
    /// Delegate to another skill/system
    Delegate,
}

/// Configuration for the salience gate
pub struct SalienceConfig {
    /// Threshold for speaking (0..1). Higher = less responsive
    pub speak_threshold: f32,
    /// Minimum message length to consider speaking
    pub min_msg_length: usize,
    /// Maximum silence turns before forced response
    pub max_silent_turns: u32,
}

impl Default for SalienceConfig {
    fn default() -> Self {
        Self {
            speak_threshold: 0.3,
            min_msg_length: 1,
            max_silent_turns: 3,
        }
    }
}

/// The Salience Gate — decides when ย่านาง should speak
pub struct YanangSalienceGate {
    pub config: SalienceConfig,
    silent_turns: u32,
}

impl YanangSalienceGate {
    pub fn new(config: SalienceConfig) -> Self {
        Self {
            config,
            silent_turns: 0,
        }
    }

    /// Decide whether to speak based on message analysis
    pub fn decide(
        &mut self,
        message: &str,
        is_question: bool,
        has_greeting: bool,
        is_direct_address: bool,
    ) -> SpeakDecision {
        let len = message.trim().len();

        // Always respond to direct address or questions
        if is_direct_address || (is_question && len >= self.config.min_msg_length) {
            self.silent_turns = 0;
            return SpeakDecision::Speak;
        }

        // Compute salience score
        let mut salience = 0.5; // base

        // Longer messages get more attention
        let len_factor = (len as f32 / 100.0).min(1.0);
        salience += len_factor * 0.2;

        // Greetings increase salience
        if has_greeting {
            salience += 0.15;
        }

        // Questions strongly increase salience
        if is_question {
            salience += 0.25;
        }

        // Apply sigmoid gate
        let gate = sigmoid((salience - self.config.speak_threshold) * 5.0);

        if gate > 0.5 {
            self.silent_turns = 0;
            SpeakDecision::Speak
        } else if self.silent_turns >= self.config.max_silent_turns {
            // Force response after too many silences
            self.silent_turns = 0;
            SpeakDecision::Speak
        } else {
            self.silent_turns += 1;
            SpeakDecision::Silent
        }
    }

    /// Check if a message is a question (contains question words in Thai)
    pub fn is_question(text: &str) -> bool {
        let q_words = [
            "?",
            "ไหม",
            "หรือ",
            "อะไร",
            "ที่ไหน",
            "เมื่อไหร่",
            "อย่างไร",
            "ทำไม",
            "ใคร",
            "ยังไง",
            "เหรอ",
            "รึเปล่า",
            "มั้ย",
            "ป่ะ",
            "ใช่ไหม",
            "เท่าไหร่",
            "กี่",
        ];
        let text_lower = text.to_lowercase();
        if text_lower.contains('?') || text_lower.contains('？') {
            return true;
        }
        q_words.iter().any(|&w| text_lower.contains(w))
    }

    /// Check if the user is directly addressing the AI
    pub fn is_direct_address(text: &str) -> bool {
        let addr = [
            "ย่านาง",
            "นาง",
            "AI",
            "Ai",
            "ไอ",
            "คุณย่านาง",
            "ได้ยิน",
            "ตอบ",
            "ฟัง",
        ];
        addr.iter().any(|&a| text.contains(a))
    }
}
