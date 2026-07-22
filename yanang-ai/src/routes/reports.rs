//! Citizen report submission — Traveler → (future) Admin_Backend
//!
//! สอดคล้องกับ `Feedback` ใน DATA_AND_AI.md (A7): problemType (5 ค่า), zoneId, description,
//! status. Validation logic ในไฟล์นี้เป็น pure function ล้วน (ไม่ผูกกับ Axum/HTTP) เพื่อให้
//! property test ได้ตรงๆ ตามที่ design.md กำหนด (Property 3, 4, 5, 6)

use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::api::backend::BackendError;
use crate::routes::construction::ConstructionProject;
use crate::AppState;

/// 5 ค่าที่ยอมรับสำหรับ problem_type — ตรงกับ `Feedback.problemType` ใน DATA_AND_AI.md
pub const PROBLEM_TYPES: [&str; 5] = ["no_cones", "no_sign", "data_mismatch", "heavy_traffic", "other"];

/// ความยาวสูงสุดของ description หลัง trim (นับตาม char/codepoint ไม่ใช่ byte — ข้อความไทยต้องไม่ขาดกลาง codepoint)
pub const DESCRIPTION_MAX_CHARS: usize = 500;

/// จำนวนครั้งสูงสุดที่อนุญาตให้ส่งรายงานต่อ session ใน rolling window
pub const RATE_LIMIT_MAX: usize = 5;

/// ขนาด rolling window สำหรับ rate limit (10 นาที, เป็น milliseconds)
pub const RATE_LIMIT_WINDOW_MS: u64 = 10 * 60 * 1000;

/// bucket ที่ใช้เมื่อ client ไม่ส่ง header X-Session-Id มาเลย (ยังคง rate-limit ได้บ้าง
/// ดีกว่าไม่จำกัดเลย — แต่ client ทุกตัวที่ไม่ส่ง session id จะแชร์ bucket เดียวกัน)
const NO_SESSION_BUCKET: &str = "__no_session__";

// ─── Request / response wire types ───

#[derive(Debug, Deserialize)]
pub struct CitizenReportRequest {
    pub problem_type: String,
    pub lat: f64,
    pub lng: f64,
    pub description: Option<String>,
    /// base64 data URL — ไม่มี storage จริงในเวอร์ชันนี้ (Scope Cut ตาม design.md), รับไว้เฉยๆ
    pub photo_data_url: Option<String>,
}

/// รายงานที่ผ่านการตรวจสอบแล้ว พร้อมส่งต่อให้ ConstructionBackend adapter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CitizenReport {
    pub id: String,
    pub zone_id: Option<u32>,
    pub problem_type: String,
    pub description: String,
    pub lat: f64,
    pub lng: f64,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ReportAck {
    pub report_id: String,
    pub queued: bool,
}

#[derive(Debug, Serialize)]
pub struct ErrorBody {
    pub error: String,
}

// ─── Pure field validation (Property 3) ───

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum FieldValidationError {
    InvalidProblemType,
    InvalidCoords,
}

/// Pure — total function ของ (problem_type, lat, lng). ไม่ panic ไม่ว่า input จะเป็นอะไร
pub fn validate_fields(problem_type: &str, lat: f64, lng: f64) -> Result<(), FieldValidationError> {
    if !PROBLEM_TYPES.contains(&problem_type) {
        return Err(FieldValidationError::InvalidProblemType);
    }
    if !validate_coords(lat, lng) {
        return Err(FieldValidationError::InvalidCoords);
    }
    Ok(())
}

/// Pure — lat/lng ต้องเป็นค่าจำกัด (finite) และอยู่ในช่วงพิกัดโลกที่ถูกต้อง
pub fn validate_coords(lat: f64, lng: f64) -> bool {
    lat.is_finite() && lng.is_finite() && (-90.0..=90.0).contains(&lat) && (-180.0..=180.0).contains(&lng)
}

/// Pure — ตัด description ให้ยาวไม่เกิน DESCRIPTION_MAX_CHARS ตัวอักษร (นับ char ไม่ใช่ byte)
/// เสมอ (ไม่ใช่ reject) ตาม Requirement 2.4 — idempotent สำหรับสตริงที่สั้นกว่า cap อยู่แล้ว (Property 5)
pub fn truncate_description(s: &str) -> String {
    let trimmed = s.trim();
    if trimmed.chars().count() <= DESCRIPTION_MAX_CHARS {
        trimmed.to_string()
    } else {
        trimmed.chars().take(DESCRIPTION_MAX_CHARS).collect()
    }
}

// ─── Pure rate limiting (Property 4) — timestamps เป็น u64 ms เพื่อให้ proptest ได้ตรงๆ ───

#[derive(Debug, Clone, PartialEq)]
pub enum RateLimitDecision {
    Allowed { updated_timestamps: Vec<u64> },
    Rejected { retry_after_ms: u64 },
}

/// Pure — sliding-window rate limit เดียวกับ `canSubmitFeedback()` ใน gps-construction/js/feedback.js
/// แต่ทำงานบน timestamp ms ธรรมดา (ไม่ผูกกับ std::time::Instant) เพื่อให้ property test ได้ตรงไปตรงมา
pub fn evaluate_rate_limit(existing_ms: &[u64], now_ms: u64) -> RateLimitDecision {
    let mut kept: Vec<u64> = existing_ms
        .iter()
        .copied()
        .filter(|&t| now_ms.saturating_sub(t) < RATE_LIMIT_WINDOW_MS)
        .collect();
    kept.sort_unstable();

    if kept.len() < RATE_LIMIT_MAX {
        kept.push(now_ms);
        RateLimitDecision::Allowed { updated_timestamps: kept }
    } else {
        let oldest = kept[0];
        let retry_after_ms = RATE_LIMIT_WINDOW_MS.saturating_sub(now_ms.saturating_sub(oldest));
        RateLimitDecision::Rejected { retry_after_ms }
    }
}

/// Wrapper ที่เก็บ state จริง (per-session timestamps) หลัง mutex — ตัว logic จริงอยู่ใน
/// `evaluate_rate_limit()` ข้างบนซึ่งเป็น pure function ทดสอบได้เดี่ยวๆ
pub struct ReportRateLimiter {
    sessions: tokio::sync::Mutex<HashMap<String, Vec<u64>>>,
}

impl ReportRateLimiter {
    pub fn new() -> Self {
        Self {
            sessions: tokio::sync::Mutex::new(HashMap::new()),
        }
    }

    pub async fn try_record(&self, session_id: &str, now_ms: u64) -> RateLimitDecision {
        let mut map = self.sessions.lock().await;
        let existing = map.get(session_id).cloned().unwrap_or_default();
        let decision = evaluate_rate_limit(&existing, now_ms);
        if let RateLimitDecision::Allowed { updated_timestamps } = &decision {
            map.insert(session_id.to_string(), updated_timestamps.clone());
        }
        decision
    }
}

impl Default for ReportRateLimiter {
    fn default() -> Self {
        Self::new()
    }
}

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

// ─── Nearest-zone linking (Property 6) ───

/// Pure — Haversine distance ในเมตร (สูตรเดียวกับ alerts.js/feedback.js)
pub fn haversine_m(lat1: f64, lng1: f64, lat2: f64, lng2: f64) -> f64 {
    const R: f64 = 6_371_000.0;
    let to_rad = |d: f64| d.to_radians();
    let d_lat = to_rad(lat2 - lat1);
    let d_lng = to_rad(lng2 - lng1);
    let a = (d_lat / 2.0).sin().powi(2) + to_rad(lat1).cos() * to_rad(lat2).cos() * (d_lng / 2.0).sin().powi(2);
    R * 2.0 * a.sqrt().atan2((1.0 - a).sqrt())
}

/// Pure — โครงการที่ใกล้ที่สุด (Haversine ต่ำสุด, tie-break ด้วย id ต่ำสุด) หรือ None ถ้า list ว่าง
pub fn find_nearest_zone(lat: f64, lng: f64, projects: &[ConstructionProject]) -> Option<u32> {
    let mut best: Option<(u32, f64)> = None;
    for p in projects {
        let d = haversine_m(lat, lng, p.lat, p.lng);
        best = match best {
            None => Some((p.id, d)),
            Some((best_id, best_d)) => {
                if d < best_d || (d == best_d && p.id < best_id) {
                    Some((p.id, d))
                } else {
                    Some((best_id, best_d))
                }
            }
        };
    }
    best.map(|(id, _)| id)
}

// ─── Route handler ───

/// POST /api/reports
pub async fn submit_report_handler(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<CitizenReportRequest>,
) -> Result<(StatusCode, Json<ReportAck>), (StatusCode, Json<ErrorBody>)> {
    // ── 1. Field validation (problem_type, coords) ──
    if let Err(e) = validate_fields(&req.problem_type, req.lat, req.lng) {
        let msg = match e {
            FieldValidationError::InvalidProblemType => "ประเภทปัญหาไม่ถูกต้อง",
            FieldValidationError::InvalidCoords => "พิกัดตำแหน่งไม่ถูกต้อง",
        };
        return Err((StatusCode::UNPROCESSABLE_ENTITY, Json(ErrorBody { error: msg.to_string() })));
    }

    // ── 2. Rate limit (per session) ──
    let session_id = headers
        .get("X-Session-Id")
        .and_then(|v| v.to_str().ok())
        .filter(|s| !s.is_empty())
        .unwrap_or(NO_SESSION_BUCKET);

    match state.report_rate_limiter.try_record(session_id, now_ms()).await {
        RateLimitDecision::Rejected { retry_after_ms } => {
            let retry_after_s = retry_after_ms / 1000;
            return Err((
                StatusCode::UNPROCESSABLE_ENTITY,
                Json(ErrorBody {
                    error: format!("ส่งรายงานได้สูงสุด {} ครั้ง/10 นาที — รออีก {} วินาที", RATE_LIMIT_MAX, retry_after_s),
                }),
            ));
        }
        RateLimitDecision::Allowed { .. } => {}
    }

    // ── 3. Truncate description, find nearest zone ──
    let description = truncate_description(req.description.as_deref().unwrap_or(""));

    let projects = state
        .construction_backend
        .list_projects()
        .await
        .unwrap_or_default(); // list_projects ไม่ควร Err เลย (Property 1/2) แต่ป้องกันไว้อีกชั้น
    let zone_id = find_nearest_zone(req.lat, req.lng, &projects);

    let report = CitizenReport {
        id: format!("fb-{}-{:06x}", now_ms(), rand::random::<u32>() & 0xFFFFFF),
        zone_id,
        problem_type: req.problem_type.clone(),
        description,
        lat: req.lat,
        lng: req.lng,
        status: "pending".to_string(),
        created_at: chrono_like_iso8601_now(),
    };

    // ── 4. Submit via adapter (real backend, or queue fallback) ──
    match state.construction_backend.submit_report(report.clone()).await {
        Ok(ack) => {
            let status = if ack.queued { StatusCode::ACCEPTED } else { StatusCode::CREATED };
            Ok((status, Json(ack)))
        }
        Err(BackendError::Unreachable(_)) | Err(BackendError::UpstreamError(_)) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorBody { error: "ไม่สามารถบันทึกรายงานได้ กรุณาลองใหม่อีกครั้ง".to_string() }),
        )),
    }
}

/// ISO 8601 timestamp แบบไม่ต้องพึ่ง crate `chrono` (ยังไม่มีใน Cargo.toml ของโปรเจกต์นี้)
fn chrono_like_iso8601_now() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // Unix epoch → calendar (UTC), แบบพอเพียงสำหรับ timestamp เก็บลง log/JSON ไม่ใช่ library เต็มรูป
    format_unix_secs_as_iso8601(secs)
}

fn format_unix_secs_as_iso8601(secs: u64) -> String {
    let days = secs / 86400;
    let rem = secs % 86400;
    let (hour, minute, second) = (rem / 3600, (rem % 3600) / 60, rem % 60);

    // Civil calendar algorithm (Howard Hinnant's days_from_civil, inverse) — no external deps
    let z = days as i64 + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year_base = yoe as i64 + era * 400;
    let year = if month <= 2 { year_base + 1 } else { year_base };

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hour, minute, second
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    fn sample_project(id: u32, lat: f64, lng: f64) -> ConstructionProject {
        ConstructionProject {
            id,
            name: format!("Project {}", id),
            province: "Bangkok".to_string(),
            contractor: "Test Co".to_string(),
            status: "in-progress".to_string(),
            start: "2026-01-01".to_string(),
            end: "2026-12-31".to_string(),
            lat,
            lng,
            road_name: "Test Road".to_string(),
            radius_km: 0.3,
            compliance_verdict: "pass".to_string(),
            closed_lanes: "none".to_string(),
            speed_limit: 60,
        }
    }

    // Feature: yanang-traveler-integration, Property 3: Report validation is a total function
    proptest! {
        #![proptest_config(ProptestConfig { cases: 200, ..ProptestConfig::default() })]

        #[test]
        fn property_3_validate_fields_never_panics_and_is_deterministic(
            problem_type in "[a-zA-Z_]{0,20}",
            lat in -1000.0f64..1000.0,
            lng in -1000.0f64..1000.0,
        ) {
            let r1 = validate_fields(&problem_type, lat, lng);
            let r2 = validate_fields(&problem_type, lat, lng);
            prop_assert_eq!(r1, r2);
        }

        #[test]
        fn property_3_known_problem_types_with_valid_coords_always_accepted(
            idx in 0usize..PROBLEM_TYPES.len(),
            lat in -90.0f64..=90.0,
            lng in -180.0f64..=180.0,
        ) {
            let pt = PROBLEM_TYPES[idx];
            prop_assert!(validate_fields(pt, lat, lng).is_ok());
        }

        #[test]
        fn property_3_unknown_problem_type_always_rejected(
            pt in "[a-zA-Z_]{1,15}",
            lat in -90.0f64..=90.0,
            lng in -180.0f64..=180.0,
        ) {
            prop_assume!(!PROBLEM_TYPES.contains(&pt.as_str()));
            prop_assert_eq!(validate_fields(&pt, lat, lng), Err(FieldValidationError::InvalidProblemType));
        }
    }

    // Feature: yanang-traveler-integration, Property 5: Description truncation is idempotent and length-preserving
    proptest! {
        #![proptest_config(ProptestConfig { cases: 200, ..ProptestConfig::default() })]

        #[test]
        fn property_5_truncate_never_exceeds_cap(s in ".*") {
            let out = truncate_description(&s);
            prop_assert!(out.chars().count() <= DESCRIPTION_MAX_CHARS);
        }

        #[test]
        fn property_5_truncate_is_idempotent(s in ".*") {
            let once = truncate_description(&s);
            let twice = truncate_description(&once);
            prop_assert_eq!(once, twice);
        }

        #[test]
        fn property_5_short_strings_preserved_after_trim(s in "[a-zA-Zก-๙ ]{0,499}") {
            let out = truncate_description(&s);
            if s.trim().chars().count() <= DESCRIPTION_MAX_CHARS {
                prop_assert_eq!(out, s.trim().to_string());
            }
        }
    }

    // Feature: yanang-traveler-integration, Property 4: Rate limiting is monotonic and window-correct
    proptest! {
        #![proptest_config(ProptestConfig { cases: 200, ..ProptestConfig::default() })]

        #[test]
        fn property_4_never_allows_more_than_max_within_window(
            now_ms in 0u64..1_000_000_000,
            count in 0usize..10,
        ) {
            // ทุก timestamp เดิมอยู่ในหน้าต่างเดียวกัน (ภายใน window ล่าสุด)
            let existing: Vec<u64> = (0..count)
                .map(|i| now_ms.saturating_sub(i as u64 * 1000))
                .collect();
            let decision = evaluate_rate_limit(&existing, now_ms);
            let is_rejected = matches!(decision, RateLimitDecision::Rejected { .. });
            let is_allowed = matches!(decision, RateLimitDecision::Allowed { .. });
            if count >= RATE_LIMIT_MAX {
                prop_assert!(is_rejected);
            } else {
                prop_assert!(is_allowed);
            }
        }

        #[test]
        fn property_4_submission_outside_window_always_accepted(
            now_ms in RATE_LIMIT_WINDOW_MS..1_000_000_000,
        ) {
            // 5 timestamps ทั้งหมดเก่ากว่า window แล้ว (นอก rolling window)
            let old_ts = now_ms - RATE_LIMIT_WINDOW_MS - 1;
            let existing: Vec<u64> = vec![old_ts; RATE_LIMIT_MAX];
            let decision = evaluate_rate_limit(&existing, now_ms);
            let is_allowed = matches!(decision, RateLimitDecision::Allowed { .. });
            prop_assert!(is_allowed);
        }
    }

    // Feature: yanang-traveler-integration, Property 6: Nearest-zone linking consistent with Haversine ordering
    proptest! {
        #![proptest_config(ProptestConfig { cases: 200, ..ProptestConfig::default() })]

        #[test]
        fn property_6_nearest_zone_matches_min_haversine(
            lat in -85.0f64..85.0,
            lng in -175.0f64..175.0,
            offsets in proptest::collection::vec((-1.0f64..1.0, -1.0f64..1.0), 1..8),
        ) {
            let projects: Vec<ConstructionProject> = offsets
                .iter()
                .enumerate()
                .map(|(i, (dlat, dlng))| sample_project(i as u32 + 1, lat + dlat, lng + dlng))
                .collect();

            let result = find_nearest_zone(lat, lng, &projects);

            // brute-force expected: min haversine distance, tie-break by lowest id
            let mut expected: Option<(u32, f64)> = None;
            for p in &projects {
                let d = haversine_m(lat, lng, p.lat, p.lng);
                expected = match expected {
                    None => Some((p.id, d)),
                    Some((eid, ed)) => {
                        if d < ed || (d == ed && p.id < eid) {
                            Some((p.id, d))
                        } else {
                            Some((eid, ed))
                        }
                    }
                };
            }

            prop_assert_eq!(result, expected.map(|(id, _)| id));
        }

        #[test]
        fn property_6_empty_list_returns_none(lat in -90.0f64..90.0, lng in -180.0f64..180.0) {
            prop_assert_eq!(find_nearest_zone(lat, lng, &[]), None);
        }
    }

    #[test]
    fn unit_validate_coords_rejects_nan_and_infinite() {
        assert!(!validate_coords(f64::NAN, 100.0));
        assert!(!validate_coords(13.0, f64::INFINITY));
        assert!(!validate_coords(13.0, f64::NEG_INFINITY));
    }

    #[test]
    fn unit_validate_coords_rejects_out_of_range() {
        assert!(!validate_coords(91.0, 100.0));
        assert!(!validate_coords(-91.0, 100.0));
        assert!(!validate_coords(13.0, 181.0));
        assert!(!validate_coords(13.0, -181.0));
    }

    #[test]
    fn unit_validate_coords_accepts_boundaries() {
        assert!(validate_coords(90.0, 180.0));
        assert!(validate_coords(-90.0, -180.0));
        assert!(validate_coords(0.0, 0.0));
    }
}
