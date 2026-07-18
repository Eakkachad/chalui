//! Personality engine for ย่านาง AI
//! Wraps katgpt-personality's PersonalityWeightedComposition<5, 32>
//! for real-time style blending with sigmoid gating.

use katgpt_personality::sigmoid::sigmoid;
use katgpt_personality::{LayerDirectionSource, PersonalityConfig, PersonalityWeightedComposition};

/// 5 style dimensions
pub const NUM_STYLES: usize = 5;
pub const STYLE_DIM: usize = 32;

/// Style indices
pub const S_CHEERFUL: usize = 0;
pub const S_SERIOUS: usize = 1;
pub const S_CONCISE: usize = 2;
pub const S_FRIENDLY: usize = 3;
pub const S_PROFESSIONAL: usize = 4;

/// Human-readable style names
pub const STYLE_NAMES: [&str; NUM_STYLES] =
    ["cheerful", "serious", "concise", "friendly", "professional"];
pub const STYLE_LABELS_TH: [&str; NUM_STYLES] = ["ร่าเริง", "จริงจัง", "กระชับ", "เป็นมิตร", "มืออาชีพ"];

/// A direction source that always returns the same fixed direction
struct FixedDirection {
    dir: [f32; STYLE_DIM],
}

impl LayerDirectionSource for FixedDirection {
    fn direction<'a>(&self, scratch: &'a mut [f32]) -> &'a [f32] {
        debug_assert_eq!(scratch.len(), STYLE_DIM);
        scratch.copy_from_slice(&self.dir);
        scratch
    }
}

/// The personality engine: owns the composition kernel + style directions
pub struct YanangPersonality {
    /// The katgpt personality composition kernel (5 styles × 32 dim)
    pub kernel: PersonalityWeightedComposition<NUM_STYLES, STYLE_DIM>,
    /// Per-style fixed direction vectors (deterministic from BLAKE3)
    style_dirs: [FixedDirection; NUM_STYLES],
}

impl YanangPersonality {
    /// Create with a default "cheerful-friendly" leaning
    pub fn new() -> Self {
        let config = PersonalityConfig {
            tau: 1.2,       // moderate sharpness
            alpha: 0.05,    // moderate plasticity
            w_max: 4.0,     // clamp bound
            ema_decay: 0.9, // longer memory
        };

        // Initial weights: cheerful + friendly high, rest neutral
        let initial_w = [2.5, 0.0, 0.0, 2.0, 0.0];

        // Generate deterministic direction vectors from style names
        let style_dirs = [
            FixedDirection {
                dir: make_direction("yanang-cheerful"),
            },
            FixedDirection {
                dir: make_direction("yanang-serious"),
            },
            FixedDirection {
                dir: make_direction("yanang-concise"),
            },
            FixedDirection {
                dir: make_direction("yanang-friendly"),
            },
            FixedDirection {
                dir: make_direction("yanang-professional"),
            },
        ];

        Self {
            kernel: PersonalityWeightedComposition::new(config, initial_w),
            style_dirs,
        }
    }

    /// Set style actively (override weights for a "pure" style)
    pub fn set_style(&mut self, style_idx: usize) {
        let mut w = [0.0; NUM_STYLES];
        w[style_idx.min(NUM_STYLES - 1)] = 3.0;
        self.kernel.w = w;
    }

    /// Blend multiple styles (N-d vector of blend strengths 0..3)
    pub fn blend_styles(&mut self, strengths: &[f32; NUM_STYLES]) {
        for i in 0..NUM_STYLES {
            self.kernel.w[i] =
                strengths[i].clamp(-self.kernel.config().w_max, self.kernel.config().w_max);
        }
    }

    /// Get the composed personality vector
    pub fn compose(&self) -> [f32; STYLE_DIM] {
        let mut out = [0.0; STYLE_DIM];
        let mut scratch = [0.0; STYLE_DIM];

        // Build array of references for each layer source
        let layers: [&dyn LayerDirectionSource; NUM_STYLES] = [
            &self.style_dirs[0],
            &self.style_dirs[1],
            &self.style_dirs[2],
            &self.style_dirs[3],
            &self.style_dirs[4],
        ];

        self.kernel.compose_into(&layers, &mut scratch, &mut out);
        out
    }

    /// Get sigmoid-normalized style activations (0..1)
    pub fn style_activations(&self) -> [f32; NUM_STYLES] {
        let mut act = [0.0; NUM_STYLES];
        for i in 0..NUM_STYLES {
            act[i] = sigmoid(self.kernel.w[i] / self.kernel.config().tau);
        }
        act
    }

    /// Get the dominant style name
    pub fn dominant_style(&self) -> (usize, f32) {
        let act = self.style_activations();
        let mut max_idx = 0;
        let mut max_val = act[0];
        for i in 1..NUM_STYLES {
            if act[i] > max_val {
                max_val = act[i];
                max_idx = i;
            }
        }
        (max_idx, max_val)
    }

    /// Apply reward-surprise drift to adapt personality
    pub fn drift(&mut self, reward: f32) {
        let layers: [&dyn LayerDirectionSource; NUM_STYLES] = [
            &self.style_dirs[0],
            &self.style_dirs[1],
            &self.style_dirs[2],
            &self.style_dirs[3],
            &self.style_dirs[4],
        ];
        self.kernel.drift(&layers, reward);
    }
}

/// Generate a deterministic f32 direction vector from a seed string
/// using BLAKE3 (half of the hash output)
fn make_direction(seed: &str) -> [f32; STYLE_DIM] {
    let hash = blake3::hash(seed.as_bytes());
    let bytes = hash.as_bytes();
    let mut dir = [0.0; STYLE_DIM];
    for i in 0..STYLE_DIM {
        // Convert 4 bytes to f32 in [-1, 1]
        let b0 = bytes[(i * 4) % 32] as f32;
        let b1 = bytes[(i * 4 + 1) % 32] as f32;
        let combined = (b0 + b1 * 256.0) / 65535.0; // [0, 1]
        dir[i] = combined * 2.0 - 1.0; // [-1, 1]
    }
    // Normalize to unit length
    let norm: f32 = dir.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm > 0.0 {
        for x in dir.iter_mut() {
            *x /= norm;
        }
    }
    dir
}

/// Convert personality activations to a descriptive Thai system prompt
pub fn activations_to_prompt(activations: &[f32; NUM_STYLES]) -> String {
    let mut traits = Vec::new();

    if activations[S_CHEERFUL] > 0.5 {
        traits.push("ร่าเริง สนุกสนาน เป็นกันเอง");
    }
    if activations[S_SERIOUS] > 0.5 {
        traits.push("จริงจัง ตรงประเด็น เน้นข้อมูล");
    }
    if activations[S_CONCISE] > 0.5 {
        traits.push("กระชับ สั้น ได้ใจความ");
    }
    if activations[S_FRIENDLY] > 0.5 {
        traits.push("เป็นมิตร อบอุ่น ให้คำแนะนำ");
    }
    if activations[S_PROFESSIONAL] > 0.5 {
        traits.push("มืออาชีพ ทางการ ละเอียด");
    }

    // Build prompt based on dominant traits
    let trait_desc = if traits.is_empty() {
        "สุภาพ เป็นกลาง".to_string()
    } else {
        traits.join(" และ ")
    };

    format!(
        r#"คุณคือ "ย่านาง AI" ผู้ช่วยนำทางอัจฉริยะ
บุคลิกการพูด: {trait_desc}

วิธีการพูด:
- ตอบเป็นภาษาไทยเท่านั้น
- ให้ข้อมูลที่เป็นประโยชน์และถูกต้อง
- ปรับน้ำเสียงตามบุคลิกที่กำหนด
- ใช้ภาษาไทยที่เหมาะสม

หากผู้ใช้ถามเกี่ยวกับ:
- เส้นทาง: แนะนำเส้นทาง ระยะทาง วิธีเดินทาง
- สถานที่: แนะนำสถานที่ ข้อมูลติดต่อ
- การจราจร: แจ้งสภาพการจราจร
- อากาศ: แจ้งสภาพอากาศ
- ทั่วไป: ตอบตามปกติ"#
    )
}
