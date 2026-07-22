//! Construction zone data — served through Construction_Backend_Adapter
//!
//! ข้อมูล mock เดิม (ชุดเดียวกับ gps-astro/src/pages/api/projects.js) ยังอยู่ในไฟล์นี้ในฐานะ
//! data source ของ `MockBackend` (ดู `src/api/backend.rs`) — route handler ข้างล่างนี้ไม่รู้เลย
//! ว่าข้อมูลมาจาก mock หรือ Admin_Backend จริง เรียกผ่าน adapter เท่านั้น
//! (เมื่อทีม contractor/admin มี API จริงแล้ว ตั้งค่า env var YANANG_ADMIN_BASE_URL — ไม่ต้องแก้ไฟล์นี้)

use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConstructionProject {
    pub id: u32,
    pub name: String,
    pub province: String,
    pub contractor: String,
    pub status: String,
    pub start: String,
    pub end: String,
    pub lat: f64,
    pub lng: f64,
    pub road_name: String,
    pub radius_km: f64,
    /// pass | fail | pending — ผลตรวจมาตรฐาน AI Compliance Auditor
    pub compliance_verdict: String,
    pub closed_lanes: String,
    pub speed_limit: u32,
}

/// Data source สำหรับ `MockBackend` (src/api/backend.rs) — เดิมชื่อ `sample_projects`,
/// เก็บ record ทั้งหมดไว้เหมือนเดิมทุกตัวเพื่อไม่ทำให้ response ของ route เปลี่ยน (regression-sensitive)
pub fn sample_projects_data() -> Vec<ConstructionProject> {
    vec![
        ConstructionProject { id: 1, name: "Bangkok Pink Line Extension".into(), province: "Bangkok".into(), contractor: "Siam Infra JV".into(), status: "in-progress".into(), start: "2026-01-15".into(), end: "2027-05-30".into(), lat: 13.8952, lng: 100.5792, road_name: "Chaeng Watthana Road".into(), radius_km: 0.42, compliance_verdict: "pass".into(), closed_lanes: "ปิด 1 ช่องซ้าย".into(), speed_limit: 60 },
        ConstructionProject { id: 2, name: "Chaeng Watthana Utility Relocation".into(), province: "Bangkok".into(), contractor: "Metro Utility Works".into(), status: "delayed".into(), start: "2025-11-18".into(), end: "2026-12-10".into(), lat: 13.8897, lng: 100.5634, road_name: "Chaeng Watthana Road".into(), radius_km: 0.38, compliance_verdict: "fail".into(), closed_lanes: "ปิด 2 ช่องขวา".into(), speed_limit: 40 },
        ConstructionProject { id: 3, name: "Lak Si Drainage Cutover".into(), province: "Bangkok".into(), contractor: "Canal Civil".into(), status: "in-progress".into(), start: "2026-02-01".into(), end: "2026-11-20".into(), lat: 13.8793, lng: 100.5798, road_name: "Vibhavadi Rangsit Road".into(), radius_km: 0.36, compliance_verdict: "pass".into(), closed_lanes: "บางช่องจราจร".into(), speed_limit: 60 },
        ConstructionProject { id: 4, name: "Ram Inthra Pavement Renewal KM4".into(), province: "Bangkok".into(), contractor: "Bangkok Roadcare".into(), status: "in-progress".into(), start: "2025-08-22".into(), end: "2027-01-18".into(), lat: 13.8584, lng: 100.6435, road_name: "Ram Inthra Road".into(), radius_km: 0.44, compliance_verdict: "pass".into(), closed_lanes: "บางช่องจราจร".into(), speed_limit: 50 },
        ConstructionProject { id: 5, name: "Watcharapol Bridge Bearing Repair".into(), province: "Bangkok".into(), contractor: "Eastern Bridge Co.".into(), status: "planned".into(), start: "2026-09-01".into(), end: "2027-03-20".into(), lat: 13.8594, lng: 100.6734, road_name: "Ram Inthra Road".into(), radius_km: 0.32, compliance_verdict: "pending".into(), closed_lanes: "ยังไม่เริ่มปิดช่องจราจร".into(), speed_limit: 60 },
        ConstructionProject { id: 7, name: "Lat Phrao Junction Signal Upgrade".into(), province: "Bangkok".into(), contractor: "Signal Thai".into(), status: "delayed".into(), start: "2025-06-04".into(), end: "2027-08-30".into(), lat: 13.8067, lng: 100.5744, road_name: "Ratchadaphisek Road".into(), radius_km: 0.4, compliance_verdict: "fail".into(), closed_lanes: "ปิด 1 ช่องกลาง ไม่มีกรวยเตือน".into(), speed_limit: 40 },
        ConstructionProject { id: 8, name: "Bang Kapi Bus Lane Improvement".into(), province: "Bangkok".into(), contractor: "Urban Move".into(), status: "in-progress".into(), start: "2026-04-11".into(), end: "2027-01-09".into(), lat: 13.7668, lng: 100.6439, road_name: "Lat Phrao Road".into(), radius_km: 0.35, compliance_verdict: "pass".into(), closed_lanes: "บางช่องจราจร".into(), speed_limit: 50 },
        ConstructionProject { id: 9, name: "Hua Mak Stormwater Main".into(), province: "Bangkok".into(), contractor: "Waterline Thai".into(), status: "delayed".into(), start: "2025-07-14".into(), end: "2026-10-22".into(), lat: 13.7358, lng: 100.6418, road_name: "Srinagarindra Road".into(), radius_km: 0.34, compliance_verdict: "fail".into(), closed_lanes: "ปิด 2 ช่องซ้าย".into(), speed_limit: 40 },
        ConstructionProject { id: 10, name: "Khae Rai Intersection Resurfacing".into(), province: "Nonthaburi".into(), contractor: "North Metro Civil".into(), status: "in-progress".into(), start: "2026-03-03".into(), end: "2027-02-12".into(), lat: 13.8611, lng: 100.5158, road_name: "Ngam Wong Wan Road".into(), radius_km: 0.35, compliance_verdict: "pass".into(), closed_lanes: "บางช่องจราจร".into(), speed_limit: 60 },
        ConstructionProject { id: 11, name: "Pak Kret U-turn Closure".into(), province: "Nonthaburi".into(), contractor: "RiverSafe Engineering".into(), status: "planned".into(), start: "2026-10-15".into(), end: "2028-06-01".into(), lat: 13.9104, lng: 100.4977, road_name: "Tiwanon Road".into(), radius_km: 0.3, compliance_verdict: "pending".into(), closed_lanes: "ยังไม่เริ่มปิดช่องจราจร".into(), speed_limit: 60 },
        ConstructionProject { id: 12, name: "Min Buri Flyover Approach".into(), province: "Bangkok".into(), contractor: "East Gate Infra".into(), status: "in-progress".into(), start: "2025-10-01".into(), end: "2027-07-19".into(), lat: 13.8131, lng: 100.7332, road_name: "Suwinthawong Road".into(), radius_km: 0.45, compliance_verdict: "pass".into(), closed_lanes: "บางช่องจราจร".into(), speed_limit: 50 },
        ConstructionProject { id: 14, name: "Muang Thong Access Road Drainage".into(), province: "Nonthaburi".into(), contractor: "Lakefront Civil".into(), status: "in-progress".into(), start: "2026-01-05".into(), end: "2027-06-25".into(), lat: 13.9125, lng: 100.5485, road_name: "Bond Street Road".into(), radius_km: 0.34, compliance_verdict: "pass".into(), closed_lanes: "บางช่องจราจร".into(), speed_limit: 60 },
        ConstructionProject { id: 15, name: "Ratchayothin Bus Stop Rebuild".into(), province: "Bangkok".into(), contractor: "Transit Habitat".into(), status: "planned".into(), start: "2026-09-18".into(), end: "2027-12-18".into(), lat: 13.8309, lng: 100.5686, road_name: "Phahonyothin Road".into(), radius_km: 0.28, compliance_verdict: "pending".into(), closed_lanes: "ยังไม่เริ่มปิดช่องจราจร".into(), speed_limit: 60 },
    ]
}

/// GET /api/construction/projects — โครงการก่อสร้างที่ active (ไม่รวม completed)
///
/// เรียกผ่าน `state.construction_backend` เท่านั้น (Construction_Backend_Adapter) — ไม่รู้เลยว่า
/// กำลังใช้ MockBackend หรือ HttpBackend คืน HTTP 200 พร้อม JSON array เสมอ (Property 2)
pub async fn projects_handler(State(state): State<Arc<AppState>>) -> Json<Vec<ConstructionProject>> {
    let projects = state
        .construction_backend
        .list_projects()
        .await
        .unwrap_or_default(); // list_projects ไม่ควร Err เลยตาม contract ของ adapter แต่ป้องกันไว้อีกชั้น

    let active: Vec<ConstructionProject> = projects.into_iter().filter(|p| p.status != "completed").collect();
    Json(active)
}
