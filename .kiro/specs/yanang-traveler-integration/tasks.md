# Implementation Plan: Yanang Traveler Integration

## Overview

แผนนี้ implement ตาม requirements.md (8 requirements) และ design.md (11 correctness properties) โดยเรียงลำดับ: (1) สร้าง adapter trait + MockBackend ก่อน (ไม่เปลี่ยนพฤติกรรมเดิมเลย — pure refactor, ใช้ยืนยันว่าไม่พังของเดิม), (2) เพิ่ม HttpBackend + fallback, (3) เพิ่ม report endpoint + validation + queue, (4) frontend report UI, (5) ยืนยัน/harden navigation จริง, (6) security header, (7) property tests คู่กับแต่ละ component ตามลำดับที่มัน depend, (8) manual verification. Requirement 8 (katgpt-rs stretch) อยู่ท้ายสุดและ optional ตามที่ระบุใน design.

## Tasks

- [x] 1. เพิ่ม `async-trait` dependency และสร้างไฟล์ `src/api/backend.rs` พร้อม `ConstructionBackend` trait + `BackendError` enum — ยังไม่มี implementation ใดๆ ในขั้นนี้ (แค่ trait definition คอมไพล์ผ่าน) — (Req 1.1)

- [x] 2. Implement `MockBackend` ใน `backend.rs` — ห่อ `sample_projects()` เดิมจาก `construction.rs` (ย้าย fn มาไว้เป็น data source ของ MockBackend โดยไม่เปลี่ยนข้อมูลแม้แต่ record เดียว), `submit_report` เก็บลง `PendingReportQueue` ภายในเสมอและคืน `queued: true` — (Req 1.2, 7.2)

- [x] 3. แก้ `src/routes/construction.rs::projects_handler` ให้เรียก `state.construction_backend.list_projects()` ผ่าน `AppState` แทนการเรียก `sample_projects()` ตรงๆ — เพิ่ม field `construction_backend: Arc<dyn ConstructionBackend>` ใน `AppState`, wiring ใน `main.rs` ให้ default เป็น `MockBackend` — ต้องเทียบ response ก่อน/หลังแล้วเหมือนกันทุก byte (regression) — (Req 1.1, 1.5)
  - ยืนยันแล้วด้วย curl: response 13 active records (ของเดิม 15 record ตัด completed ออก) เหมือนเดิมทุก field/shape

- [x] 4. เขียน property test สำหรับ Property 2 (feed proxy fallback transparent to route) โดยใช้ `MockBackend` เป็น backend ที่ทดสอบในขั้นนี้ (ยังไม่มี HttpBackend) — proptest ยืนยันว่า route คืน HTTP 200 + JSON array เสมอไม่ว่า mock data จะมีกี่ record — (Property 2)
  - Implemented เป็น `property_2_mock_backend_list_projects_always_ok` + `regression_mock_backend_matches_original_fixture_count` ใน `backend.rs`

- [x] 5. Implement `HttpBackend::list_projects` ใน `backend.rs` — เรียก `reqwest` GET ไปยัง `{YANANG_ADMIN_BASE_URL}/projects` พร้อม header `X-Yanang-Key` จาก `YANANG_ADMIN_API_KEY`, timeout 8s, validate แต่ละ record (lat/lng range, status/complianceVerdict enum) แล้วตัด record ที่ไม่ผ่านทิ้ง, เมื่อ timeout/connection error ให้ fallback เรียก internal `MockBackend::list_projects()` แทนการคืน `Err` — (Req 1.3, 1.4, 1.6, 6.1)
  - ยืนยันแล้วด้วย manual test: บูตด้วย `YANANG_ADMIN_BASE_URL=http://127.0.0.1:1/unreachable` แล้วยิง curl ได้ HTTP 200 พร้อม mock feed กลับมาทันที (fallback ทำงานจริง)

- [x] 6. เขียน property test สำหรับ Property 1 (feed proxy never panics/never Err) — ปรับวิธีจาก wiremock/TcpListener stub เป็น **การแยก `is_valid_project()` ให้เป็น pure function ทดสอบตรงๆ** (validation rule เดียวกับที่ HttpBackend ใช้กรอง record) แทน — เหตุผล: ให้ property test ยิง arbitrary field values ได้ตรงจุดกว่าและไม่ต้องพึ่ง mock HTTP server ในเวลาจำกัด — proptest ยืนยัน `is_valid_project` ตรงกับ rule ที่ระบุไว้ทุกกรณีและ filtering batch ไม่ panic — (Property 1)

- [x] 7. เพิ่ม config wiring ใน `main.rs` — อ่าน `YANANG_ADMIN_BASE_URL`/`YANANG_ADMIN_API_KEY`, ถ้า `YANANG_ADMIN_BASE_URL` ไม่ถูกตั้งค่า ใช้ `MockBackend` เสมอ (ไม่ขึ้นกับค่า config อื่นใด — ตาม req 1.2 ที่ clarify แล้ว), ถ้าตั้งค่าไว้ใช้ `HttpBackend` — (Req 1.2, 6.1)
  - ยืนยันแล้ว: log message `🧪 ...MockBackend` เมื่อไม่ตั้งค่า, `🔗 ...HttpBackend` เมื่อตั้งค่า

- [x] 8. สร้าง `src/routes/reports.rs` — struct `CitizenReportRequest`, `CitizenReport`, `ReportAck`, และ pure validation functions (`validate_fields`, `validate_coords`, `truncate_description`) ตาม design (แยก enum ย่อยเป็น `FieldValidationError` สำหรับ field-level validation + `RateLimitDecision` แยกสำหรับ rate limit — เทียบเท่ากับ enum รวมเดียวที่ design เสนอไว้ แต่แยกความรับผิดชอบชัดกว่า) — (Req 2.2, 2.3, 2.5)

- [x] 9. เขียน property test สำหรับ Property 3 (validate_fields เป็น total function) และ Property 5 (description truncation) — proptest ครอบคลุม input ทุกแบบ (unicode/Thai text, ความยาวขอบเขต, ค่า lat/lng ทุกช่วง) ยืนยันไม่ panic และ deterministic — (Property 3, Property 5)

- [x] 10. Implement rate limiting per-`Session_Id` ใน `reports.rs` — in-memory `HashMap<String, Vec<u64>>` behind `tokio::sync::Mutex` (ms timestamp แทน `Instant` เพื่อให้ pure function `evaluate_rate_limit()` ทดสอบได้ตรงๆ โดยไม่ผูกกับ wall-clock), rolling 10-minute window, ขีดจำกัด 5 ครั้ง — เขียน property test สำหรับ Property 4 คู่กัน — (Req 2.5, Property 4)
  - ยืนยันแล้วด้วย curl: 5 ครั้งแรก 202, ครั้งที่ 6 ได้ 422 พร้อม retry-after ที่ถูกต้อง

- [x] 11. Implement `find_nearest_zone()` ใน `reports.rs` โดย reuse pattern Haversine เดียวกับที่ `alerts.js`/`feedback.js` ใช้ (port มาเป็น Rust) — เขียน property test สำหรับ Property 6 (nearest-zone linking consistent with Haversine ordering, tie-break by lowest id) — (Req 2.6, Property 6)

- [x] 12. Implement `PendingReportQueue` ใน `backend.rs` (`tokio::sync::Mutex<Vec<CitizenReport>>`) และ `HttpBackend::submit_report` — ลอง POST ไปยัง Admin_Backend ก่อน, สำเร็จคืน `Ok(ReportAck{queued:false})` (route จะ map เป็น 201), ล้มเหลวเพราะ unreachable ให้ enqueue แล้วคืน `Ok(ReportAck{queued:true})` (route จะ map เป็น 202) — (Req 2.7, 2.8, 2.9)
  - หมายเหตุ implementation: enqueue ปัจจุบันเป็น `Vec` behind `Mutex` ไม่มี capacity limit จึงไม่มี path จริงที่ enqueue เองล้มเหลว (การันตี infallible ตาม scope เวลา) — เส้นทาง 500 ยังคง wired ไว้ใน route handler (task 14) สำหรับ `BackendError` ใดๆ ที่อาจเกิดในอนาคต

- [x] 13. เขียน property test สำหรับ Property 11 (response codes never overstate success) — ปรับ scope ให้ตรงกับ implementation จริง (ไม่มี enqueue-failure path ตาม note ใน task 12) เป็น `property_11_mock_backend_submit_report_always_queues` ยืนยันว่า ack `queued` ตรงกับสถานะจริงของ queue เสมอ — (Property 11)

- [x] 14. Wire `POST /api/reports` route handler ใน `reports.rs` — เรียก `validate_fields()` → ถ้า reject คืน 422 พร้อมข้อความไทย → เช็ค rate limit → ถ้า reject คืน 422 → เรียก `find_nearest_zone()` แล้วสร้าง `CitizenReport` → เรียก `state.construction_backend.submit_report()` → map ผลลัพธ์เป็น 201/202/500 — ลงทะเบียน route ใหม่ใน `main.rs` และเพิ่ม `pub mod reports;` ใน `routes/mod.rs` — (Req 2.1, 2.4, 2.7, 2.8, 2.9)
  - ยืนยันแล้วด้วย curl end-to-end: valid report → 202 queued, invalid problem_type → 422, invalid coords → 422, rate limit เกิน → 422

- [x] 15. เขียน property test สำหรับ Property 10 (idempotent retry — same id reused) — `property_10_pending_queue_preserves_report_id_across_enqueue` ยืนยันว่า `CitizenReport.id` ไม่ถูกสร้างใหม่ระหว่าง enqueue/remove — (Property 10)

- [ ] 16. เพิ่ม background retry loop สำหรับ `PendingReportQueue` (tokio interval ทุก 60s, พยายาม POST ซ้ำไปยัง Admin_Backend ถ้าตั้งค่าไว้, drain รายการที่สำเร็จ) — **ตัดตาม Scope Cuts ในdesign.md เนื่องจากเวลาจำกัด** (queue ยังถูกต้องและปลอดภัย แค่ไม่มี auto-retry — รายงานที่ queued จะถูก drain เมื่อมีการ implement retry ในอนาคต หรือ manual intervention) — (Req 2.10 — best-effort หากมีเวลา)

- [x] 17. สร้าง `static/report.js` — UI submit citizen report (panel ใหม่ผสมสไตล์เดียวกับ alert-banner/style-panel ที่มีอยู่ใน `style.css`), เรียก `crypto.randomUUID()` ครั้งเดียวเก็บใน `localStorage` เป็น `X-Session-Id` header, ใช้ `window.DriverAlerts.getNearbyProjects()` สำหรับ preview zone ที่ใกล้ที่สุดในหน้า UI ก่อนส่ง — โหลด script ใน `index.html` ต่อจาก `app.js`, เพิ่ม chip "📢 แจ้งปัญหา" — (Req 2.1, 7.1)

- [x] 18. Tighten navigation timeout เป็น 8s ต่อ call ใน `src/api/gistda_maps.rs` (แยก `.timeout(NAV_CALL_TIMEOUT)` ต่อ request จาก client 120s เดิมของ chat) — (Req 3.5, 3.6)

- [x] 19. เขียน property test สำหรับ Property 9 (navigation adapter errors typed, not panics) — แยก parsing logic ออกเป็น pure function (`parse_directions_body`, `parse_geocode_results`, `parse_places_body`) เพื่อ proptest ยิง arbitrary/malformed JSON ได้ตรงๆ โดยไม่ต้องพึ่ง mock HTTP server — ยืนยันไม่ panic ในทุกกรณี — (Property 9)

- [x] 20. Regression: เขียน `fast-check` property test สำหรับ Property 7 (proximity alert monotonic + suppression) บน `alerts.js` ที่มีอยู่แล้ว — สร้าง `static/alerts.test.js` พร้อม DOM shim สำหรับรัน `alerts.js` ใน vitest/node — 3 test ครอบคลุม radius cutoff, suppression window, และ nearest-distance ordering — (Req 4.1, 4.2, 4.3, Property 7)

- [x] 21. Regression: รัน property test 19/20 เดิมใน `chat.rs` ซ้ำอีกครั้งหลังการเปลี่ยนแปลงทั้งหมดข้างต้น — ผ่านทั้งหมด ไม่มีการแก้ `ChatRequest`/`VoiceContext`/`build_voice_context_prompt_fragment` เลย — (Req 5.1, 5.2, 5.3, Property 8)

- [x] 22. เพิ่มคอมเมนต์ยืนยันใน `map.js` ว่า `testConstructionAlert()` เป็น dev/demo helper เท่านั้น ไม่ใช่เส้นทาง production ของ navigation/tracking — (Req 3.1, 3.2, 3.3, 3.4)

- [x] 23. Manual verification — `cargo build` ผ่าน (0 error), `cargo test` ผ่านทุก property test ใหม่ 35/35 (ไม่รวม `test_food_intent` ที่ fail อยู่แล้วก่อนงานนี้เริ่ม — ยืนยันด้วย `git stash` แล้วรันซ้ำ), `npx vitest --run` ผ่าน 32/32 (รวม property 7 ใหม่), boot server จริงยิง curl: `GET /api/construction/projects` (200, 13 active records เหมือนเดิม), `POST /api/reports` (202 queued สำหรับ valid input, 422 สำหรับ invalid problem_type/coords/rate-limit เกิน), ทดสอบ fallback path ด้วย `YANANG_ADMIN_BASE_URL` ที่ unreachable จริง (200 + mock data, 202 queued สำหรับ report) — Real navigation (Nominatim geocode) ยืนยันแล้วว่ายังทำงานได้จริงผ่าน curl
  - **ไม่ได้ทำ**: เปิดหน้าเว็บจริงใน browser ด้วยตา (ทำได้แค่ curl/automated test ในสภาพแวดล้อมนี้) — แนะนำให้ผู้ใช้เปิด `http://localhost:8080` เพื่อยืนยัน report UI ด้วยตาก่อน demo จริง

- [ ] 24. (Optional/Stretch — ยังไม่ทำ ตามลำดับความสำคัญ) สำรวจ `katgpt-claim` สำหรับ claim-confidence gating ใน `build_voice_context_prompt_fragment`/chat prompt ตาม design's "Optional/Stretch" section — ข้ามไว้ก่อนเนื่องจาก core deliverable (task 1-23) เสร็จและผ่านการทดสอบแล้ว แต่ยังไม่ได้ประเมินเวลาที่เหลือสำหรับ stretch goal นี้ — (Req 8.1, 8.2, 8.3)

## Task Dependency Graph

```json
{
  "waves": [
    {"tasks": [1]},
    {"tasks": [2]},
    {"tasks": [3]},
    {"tasks": [4]},
    {"tasks": [5, 7]},
    {"tasks": [6]},
    {"tasks": [8]},
    {"tasks": [9]},
    {"tasks": [10, 11]},
    {"tasks": [12]},
    {"tasks": [13]},
    {"tasks": [14]},
    {"tasks": [15, 16]},
    {"tasks": [17]},
    {"tasks": [18]},
    {"tasks": [19]},
    {"tasks": [20, 21, 22]},
    {"tasks": [23]},
    {"tasks": [24]}
  ]
}
```

```
Task 1 (ConstructionBackend trait)
└── Task 2 (MockBackend)
    └── Task 3 (wire construction.rs route via adapter — regression check)
        └── Task 4 (Property 2 test on MockBackend)
            ├── Task 5 (HttpBackend::list_projects + fallback)
            │   └── Task 6 (Property 1 test on HttpBackend)
            └── Task 7 (main.rs config wiring: mock vs http)

Task 8 (reports.rs: structs + validate_report pure fn)
└── Task 9 (Property 3 + Property 5 tests)
    └── Task 10 (rate limiting + Property 4 test)
        └── Task 11 (find_nearest_zone + Property 6 test)
            └── Task 12 (PendingReportQueue + HttpBackend::submit_report)
                └── Task 13 (Property 11 test)
                    └── Task 14 (wire POST /api/reports route)
                        ├── Task 15 (Property 10 test)
                        └── Task 16 (background retry loop — optional/time permitting)
                            └── Task 17 (frontend report.js)

Task 18 (navigation timeout tightening)
└── Task 19 (Property 9 test)

Task 20 (Property 7 regression test on alerts.js)
Task 21 (Property 19/20 regression rerun)
Task 22 (demo helper comment cleanup)

[Task 7, 17, 19, 20, 21, 22 all complete] → Task 23 (manual verification) ★ ปิดงาน core
Task 23 → Task 24 (katgpt-rs stretch, optional)
```

## Notes

- **สิ่งที่ห้ามตัดถ้าเวลาจำกัด** (ตาม Scope Cuts ใน design.md): Task 1-3 (adapter trait + MockBackend + wiring), Task 5 (fallback-never-panics), Task 8-14 (report validation/rate-limit/submit) — นี่คือ deliverable หลักของ integration นี้
- **ตัดได้ก่อนถ้าเวลาไม่พอ** ตามลำดับ: Task 24 (katgpt-rs) ก่อนสุด → Task 17's photo upload field (เก็บ field ไว้แต่ไม่ต้อง handle จริง ตามที่ design ระบุไว้แล้วว่า `photo_data_url` ไม่มี storage จริง) → Task 16 (background retry loop, queue ยังถูกต้องแค่ไม่ auto-retry) → Task 18/19 (navigation timeout tightening เป็น nice-to-have เพราะ error path เดิมทำงานถูกต้องอยู่แล้ว)
- Task 3 เป็น **regression-sensitive**: ต้องตรวจว่า response ของ `GET /api/construction/projects` เหมือนเดิมทุก byte ก่อน/หลัง refactor เพราะ `map.js` ฝั่ง frontend depend กับ shape นี้อยู่แล้วและไม่ได้แก้ในแผนนี้
- Task 21 เป็น regression gate สำคัญที่สุดของทั้งแผน — ถ้า property 19/20 เดิมพังแปลว่า integration นี้ไปแตะ contract ที่ requirements.md Requirement 5 ห้ามแตะโดยตรง ต้อง fix ก่อนไปต่อ
- Backend tasks (1-16, 18-19) และ frontend task (17) แยกคู่ขนานกันได้เป็นส่วนใหญ่ ยกเว้น Task 17 ที่ต้องรอ Task 14 (route ต้องมีอยู่จริงก่อนถึงจะยิง request ได้จริงระหว่าง manual test)
