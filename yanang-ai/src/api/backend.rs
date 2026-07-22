//! Construction_Backend_Adapter — seam ระหว่าง route handler ของ yanang-ai กับแหล่งข้อมูล
//! โครงการก่อสร้าง + citizen report จริง (Admin_Backend) หรือ mock data (ของเดิม)
//!
//! Route handler (`routes::construction`, `routes::reports`) เรียกผ่าน trait นี้เท่านั้น —
//! ไม่รู้เลยว่ากำลังคุยกับ MockBackend หรือ HttpBackend การสลับไปใช้ Admin_Backend จริงเมื่อทีมนั้น
//! สร้างเสร็จ คือการตั้งค่า env var `YANANG_ADMIN_BASE_URL` เท่านั้น ไม่ต้องแก้ route เลย

use async_trait::async_trait;
use std::sync::Arc;
use std::time::Duration;

use crate::routes::construction::ConstructionProject;
use crate::routes::reports::{CitizenReport, ReportAck};

#[derive(Debug, Clone)]
pub enum BackendError {
    /// Admin_Backend ตอบกลับมาแต่ non-2xx หรือ body แปลงไม่ได้
    UpstreamError(String),
    /// Admin_Backend เข้าถึงไม่ได้เลย (timeout, connection refused, DNS)
    Unreachable(String),
}

/// Adapter seam — ห้าม implementation ใด panic ไม่ว่า input จากภายนอกจะเป็นอย่างไร
/// (network/parse failure ต้องรายงานผ่าน BackendError เท่านั้น)
#[async_trait]
pub trait ConstructionBackend: Send + Sync {
    /// คืนโครงการก่อสร้างที่ active ปัจจุบัน — ห้าม Err สำหรับ MockBackend (infallible โดย design)
    /// HttpBackend ต้อง fallback ไป MockBackend ภายในเองเมื่อ upstream ไม่ตอบ (ดู Property 1, 2)
    async fn list_projects(&self) -> Result<Vec<ConstructionProject>, BackendError>;

    /// ส่ง citizen report ไปยัง Admin_Backend หรือ queue ไว้ถ้าเข้าไม่ถึง
    async fn submit_report(&self, report: CitizenReport) -> Result<ReportAck, BackendError>;
}

// ─── MockBackend ───

/// ข้อมูล hardcoded เดิม (ย้ายมาจาก routes::construction::sample_projects — ไม่เปลี่ยนแม้แต่ record เดียว)
pub fn sample_projects() -> Vec<ConstructionProject> {
    crate::routes::construction::sample_projects_data()
}

/// Mock implementation — ใช้เมื่อยังไม่ตั้งค่า YANANG_ADMIN_BASE_URL (ค่าเริ่มต้นเสมอ)
pub struct MockBackend {
    queue: PendingReportQueue,
}

impl MockBackend {
    pub fn new() -> Self {
        Self { queue: PendingReportQueue::new() }
    }
}

impl Default for MockBackend {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ConstructionBackend for MockBackend {
    async fn list_projects(&self) -> Result<Vec<ConstructionProject>, BackendError> {
        Ok(sample_projects())
    }

    async fn submit_report(&self, report: CitizenReport) -> Result<ReportAck, BackendError> {
        // ไม่มี Admin_Backend จริงให้คุยด้วยในโมด mock — เก็บลง queue ภายในเสมอและ ack ว่า queued
        let report_id = report.id.clone();
        self.queue.enqueue(report).await;
        Ok(ReportAck { report_id, queued: true })
    }
}

// ─── PendingReportQueue ───

/// ที่เก็บ citizen report ชั่วคราวในหน่วยความจำ เมื่อ Admin_Backend ยังไม่พร้อมรับข้อมูล
/// ไม่ persist ลง disk (hackathon timeline — Scope Cut ตาม design.md)
pub struct PendingReportQueue {
    items: tokio::sync::Mutex<Vec<CitizenReport>>,
}

impl PendingReportQueue {
    pub fn new() -> Self {
        Self { items: tokio::sync::Mutex::new(Vec::new()) }
    }

    pub async fn enqueue(&self, report: CitizenReport) {
        self.items.lock().await.push(report);
    }

    pub async fn len(&self) -> usize {
        self.items.lock().await.len()
    }

    pub async fn snapshot(&self) -> Vec<CitizenReport> {
        self.items.lock().await.clone()
    }

    /// ลบรายงานที่ id ตรงกันออกจาก queue (เรียกหลัง retry สำเร็จ)
    pub async fn remove(&self, id: &str) {
        self.items.lock().await.retain(|r| r.id != id);
    }
}

impl Default for PendingReportQueue {
    fn default() -> Self {
        Self::new()
    }
}

// ─── HttpBackend ───

/// ค่าที่ยอมรับได้สำหรับ status/complianceVerdict — ใช้กรอง record ที่ไม่ผ่าน validation
/// ออกจาก payload ของ Admin_Backend จริง (Property 1: record เสียไม่ทำให้ทั้ง feed ล้มเหลว)
const VALID_STATUSES: [&str; 4] = ["in-progress", "delayed", "planned", "completed"];
const VALID_VERDICTS: [&str; 3] = ["pass", "fail", "pending"];

/// ตรวจสอบว่า record จาก Admin_Backend ผ่าน validation พื้นฐานหรือไม่ (pure — ใช้ใน property test ได้ตรงๆ)
pub fn is_valid_project(p: &ConstructionProject) -> bool {
    p.lat.is_finite()
        && p.lng.is_finite()
        && (-90.0..=90.0).contains(&p.lat)
        && (-180.0..=180.0).contains(&p.lng)
        && VALID_STATUSES.contains(&p.status.as_str())
        && VALID_VERDICTS.contains(&p.compliance_verdict.as_str())
}

/// Real HTTP client implementation — เรียก Admin_Backend จริงผ่าน YANANG_ADMIN_BASE_URL
/// พร้อม fallback ไป MockBackend เมื่อ upstream ไม่ตอบสนอง
pub struct HttpBackend {
    client: reqwest::Client,
    base_url: String,
    api_key: Option<String>,
    fallback: MockBackend,
    queue: PendingReportQueue,
}

impl HttpBackend {
    pub fn new(base_url: String, api_key: Option<String>) -> Self {
        Self {
            client: reqwest::Client::builder()
                .timeout(Duration::from_secs(8))
                .build()
                .expect("สร้าง HTTP client สำหรับ HttpBackend ล้มเหลว"),
            base_url,
            api_key,
            fallback: MockBackend::new(),
            queue: PendingReportQueue::new(),
        }
    }

    fn attach_auth(&self, req: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        match &self.api_key {
            Some(key) if !key.is_empty() => req.header("X-Yanang-Key", key),
            _ => req,
        }
    }
}

#[async_trait]
impl ConstructionBackend for HttpBackend {
    async fn list_projects(&self) -> Result<Vec<ConstructionProject>, BackendError> {
        let url = format!("{}/projects", self.base_url.trim_end_matches('/'));
        let resp = self.attach_auth(self.client.get(&url)).send().await;

        let raw: Vec<ConstructionProject> = match resp {
            Ok(r) if r.status().is_success() => match r.json().await {
                Ok(v) => v,
                Err(_) => {
                    // body แปลงไม่ได้ — fallback แทนการคืน Err (feed ต้องไม่พังทั้งหมด)
                    return self.fallback.list_projects().await;
                }
            },
            _ => {
                // timeout / connection refused / non-2xx — fallback เสมอ (Property 1, 2)
                return self.fallback.list_projects().await;
            }
        };

        let filtered: Vec<ConstructionProject> = raw.into_iter().filter(is_valid_project).collect();
        Ok(filtered)
    }

    async fn submit_report(&self, report: CitizenReport) -> Result<ReportAck, BackendError> {
        let url = format!("{}/reports", self.base_url.trim_end_matches('/'));
        let resp = self.attach_auth(self.client.post(&url).json(&report)).send().await;

        match resp {
            Ok(r) if r.status().is_success() => Ok(ReportAck { report_id: report.id, queued: false }),
            _ => {
                // Admin_Backend ไม่ตอบ — เก็บลง queue ภายในแทนแล้วยังคง ack สำเร็จ (queued: true)
                let report_id = report.id.clone();
                self.queue.enqueue(report).await;
                Ok(ReportAck { report_id, queued: true })
            }
        }
    }
}

/// สร้าง ConstructionBackend ตาม env var — ไม่ตั้งค่า YANANG_ADMIN_BASE_URL = MockBackend เสมอ
/// (ไม่ขึ้นกับ config อื่นใด ตาม Requirement 1.2)
pub fn build_construction_backend() -> Arc<dyn ConstructionBackend> {
    match std::env::var("YANANG_ADMIN_BASE_URL") {
        Ok(url) if !url.is_empty() => {
            let api_key = std::env::var("YANANG_ADMIN_API_KEY").ok();
            println!("🔗 Construction_Backend_Adapter: ใช้ HttpBackend → {}", url);
            Arc::new(HttpBackend::new(url, api_key))
        }
        _ => {
            println!("🧪 Construction_Backend_Adapter: ใช้ MockBackend (YANANG_ADMIN_BASE_URL ไม่ได้ตั้งค่า)");
            Arc::new(MockBackend::new())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::routes::construction::ConstructionProject;
    use proptest::prelude::*;

    fn arb_project() -> impl Strategy<Value = ConstructionProject> {
        (
            0u32..1000,
            -200.0f64..200.0,  // lat — deliberately wider than valid range to exercise filtering
            -400.0f64..400.0,  // lng — deliberately wider than valid range
            prop_oneof![
                Just("in-progress".to_string()),
                Just("delayed".to_string()),
                Just("planned".to_string()),
                Just("completed".to_string()),
                Just("bogus-status".to_string()),
            ],
            prop_oneof![
                Just("pass".to_string()),
                Just("fail".to_string()),
                Just("pending".to_string()),
                Just("bogus-verdict".to_string()),
            ],
        )
            .prop_map(|(id, lat, lng, status, verdict)| ConstructionProject {
                id,
                name: format!("P{}", id),
                province: "Bangkok".to_string(),
                contractor: "C".to_string(),
                status,
                start: "2026-01-01".to_string(),
                end: "2026-12-31".to_string(),
                lat,
                lng,
                road_name: "R".to_string(),
                radius_km: 0.3,
                compliance_verdict: verdict,
                closed_lanes: "none".to_string(),
                speed_limit: 60,
            })
    }

    // Feature: yanang-traveler-integration, Property 1 (partial — pure filter): is_valid_project
    // matches exactly the documented validation rules, never panics on any field combination.
    proptest! {
        #![proptest_config(ProptestConfig { cases: 200, ..ProptestConfig::default() })]

        #[test]
        fn property_1_is_valid_project_matches_documented_rules(p in arb_project()) {
            let expected = p.lat.is_finite()
                && p.lng.is_finite()
                && (-90.0..=90.0).contains(&p.lat)
                && (-180.0..=180.0).contains(&p.lng)
                && VALID_STATUSES.contains(&p.status.as_str())
                && VALID_VERDICTS.contains(&p.compliance_verdict.as_str());
            prop_assert_eq!(is_valid_project(&p), expected);
        }

        #[test]
        fn property_1_filtering_a_batch_never_panics_and_only_keeps_valid(
            projects in proptest::collection::vec(arb_project(), 0..20)
        ) {
            let filtered: Vec<ConstructionProject> = projects.into_iter().filter(is_valid_project).collect();
            for p in &filtered {
                prop_assert!(is_valid_project(p));
            }
        }
    }

    // Feature: yanang-traveler-integration, Property 2: MockBackend.list_projects is infallible and always Ok
    #[tokio::test]
    async fn property_2_mock_backend_list_projects_always_ok() {
        let backend = MockBackend::new();
        let result = backend.list_projects().await;
        assert!(result.is_ok());
        assert!(!result.unwrap().is_empty());
    }

    // Feature: yanang-traveler-integration, Property 2: MockBackend data matches the original fixture exactly
    // (regression — the demo's known-good 13-record active feed must not silently change)
    #[tokio::test]
    async fn regression_mock_backend_matches_original_fixture_count() {
        let backend = MockBackend::new();
        let projects = backend.list_projects().await.unwrap();
        assert_eq!(projects.len(), 13);
        assert_eq!(projects[0].id, 1);
        assert_eq!(projects[0].name, "Bangkok Pink Line Extension");
    }

    // Feature: yanang-traveler-integration, Property 11: MockBackend.submit_report never overstates success —
    // it always enqueues (never silently drops) and always returns queued:true, matching "no real admin in mock mode"
    #[tokio::test]
    async fn property_11_mock_backend_submit_report_always_queues() {
        let backend = MockBackend::new();
        let report = CitizenReport {
            id: "fb-test-1".to_string(),
            zone_id: None,
            problem_type: "other".to_string(),
            description: "test".to_string(),
            lat: 13.0,
            lng: 100.0,
            status: "pending".to_string(),
            created_at: "2026-01-01T00:00:00Z".to_string(),
        };
        let ack = backend.submit_report(report.clone()).await.unwrap();
        assert!(ack.queued);
        assert_eq!(ack.report_id, report.id);
        assert_eq!(backend.queue.len().await, 1);
    }

    // Feature: yanang-traveler-integration, Property 10: Idempotent retry — same id reused, not regenerated
    #[tokio::test]
    async fn property_10_pending_queue_preserves_report_id_across_enqueue() {
        let queue = PendingReportQueue::new();
        let report = CitizenReport {
            id: "fb-fixed-id".to_string(),
            zone_id: Some(3),
            problem_type: "no_sign".to_string(),
            description: "desc".to_string(),
            lat: 13.5,
            lng: 100.5,
            status: "pending".to_string(),
            created_at: "2026-01-01T00:00:00Z".to_string(),
        };
        queue.enqueue(report.clone()).await;
        let snapshot = queue.snapshot().await;
        assert_eq!(snapshot.len(), 1);
        assert_eq!(snapshot[0].id, "fb-fixed-id");

        queue.remove("fb-fixed-id").await;
        assert_eq!(queue.len().await, 0);
    }
}
