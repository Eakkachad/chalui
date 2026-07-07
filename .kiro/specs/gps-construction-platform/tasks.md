# Implementation Plan:

## Overview

แผนการ implement GPS Construction Platform ตาม requirements และ design ที่กำหนด แบ่งเป็น 10 tasks เรียงตามลำดับ dependency โดยเน้น demo-ability และ wow moments (AI Audit + Closed Loop)

## Tasks

- [x] 1. สร้างโครงสร้างไฟล์และ HTML skeleton — สร้าง index.html พร้อม CDN imports (Leaflet, MarkerCluster, Font Awesome, js-blake3), css/style.css (responsive, Thai font), js/data-store.js (central state), js/sample-data.js (25 zones ทั่วไทย), js/app.js (init + tab routing)
- [x] 2. Map Component + Markers + Geolocation — สร้าง js/map.js: initMap() center ไทย zoom 6, loadMarkers() สี 4 สถานะ, popup, clustering 40px, geolocation + user marker, floating buttons 44x44px, status legend, error/loading states
- [x] 3. Sidebar + Search + Bottom Navigation — สร้าง js/sidebar.js: renderZoneList(), search filter, click-to-zoom level 15, mobile toggle, empty state, scrollable >20 items; Bottom Nav 5 tabs + routing ภายใน 500ms + AI placeholder
- [ ] 4. Contractor Reporting Module — สร้าง js/contractor.js: form wizard 4 steps (โครงการ/ตำแหน่ง/รูป/ยืนยัน), validation (กม.เริ่ม<สิ้นสุด, พิกัดไทย, ฟิลด์ครบ), photo File API + preview + metadata, overlap detection, create zone → data-store → refresh map
- [x] 5. AI Auditor Module (Wow #1) — สร้าง js/ai-auditor.js: upload UI + ปุ่มตรวจสอบ, 3 mock fixtures, Rule Engine port (MinObjectCount/MaxSpacing/RequiredWithinDistance/TimeWindow), score deduction, BLAKE3 hash, Report display (verdict/score/per-rule/hash), mock delay 1.5s, 6+2 baseline rules
- [x] 6. Closed Loop (Wow #2) — verdict Pass → publish marker, Fail → hide + notify, auto-trigger audit on submit, re-audit on edit, re-audit on ≥3 feedback, zone complete → withdraw, single source of truth verification
- [x] 7. Driver Alerts + Proximity Detection — สร้าง js/alerts.js: watchPosition, Haversine 500m threshold, alert toast UI, multi-zone nearest-first, suppression 5min/exit-radius, alert history newest-first, timeout 3s
- [x] 8. Feedback Module — สร้าง js/feedback.js: form (type required, description ≤500 chars, photo optional), auto-fill location + nearest zone, validation, rate limit 5/10min, บันทึก → data-store + link contractor
- [x] 9. Admin Module — สร้าง js/admin.js: 3 sub-views (approval queue + feedback queue + KPI), approve→publish, reject ≥10 chars, admin override + log, feedback mark resolved, KPI 0-100 (baseline 100), concurrency version check, empty states
- [x] 10. ขัดเกลา Responsive และ Demo Prep — responsive ทุก breakpoint, ARIA + keyboard + contrast ≥4.5:1, E2E test flows (Pass + Fail → re-audit), UI polish, README, เตรียม demo scenarios 2 wow moments

### Phase 2 — Integration Hardening & Demo Polish

- [ ] 11. รัน dev server + smoke test ใน browser และแก้ integration bugs — เปิด index.html ผ่าน dev-server.cjs, เปิด console หา JS errors, ตรวจว่าทุกแท็บ (Home/Alerts/AI/Reports/Admin) เปิด-ปิดถูก, AI panel แสดงผลถูก layout, ยืนยัน closed loop ซ่อน/แสดง marker จริง (Req 1, 5, 6) — **รอผู้ใช้ทดสอบใน browser**
- [x] 12. รวม panel/nav routing เป็น router เดียว — สร้าง window.PanelRouter ใน script.js, เอา nav handler ซ้ำออกจาก ai-auditor.js, กดแท็บหนึ่งปิดอีกแท็บอัตโนมัติ (Req 1)
- [x] 13. ให้ AI audit ผูกกับ zone ที่เลือกได้ — เพิ่ม dropdown #aiZoneSelect ในแท็บ AI, closed loop apply verdict กับ zone ที่เลือก (Req 4, 5)
- [x] 14. Persist compliance state + ผูกรูปที่อัปโหลด — persistComplianceState/loadComplianceState → localStorage, เรียกใน applyComplianceVerdict + admin approve/reject + init (Req 3, 4)
- [x] 15. แทน prompt() ของ admin ด้วย modal — reject-reason modal (validate ≥10 chars) + บันทึก actor + timestamp (Req 7)
- [x] 16. อัปเดต README + demo script — 2 wow moments, วิธีรัน, mapping ไป requirements, หมายเหตุขอบเขต (Req 8)

## Task Dependency Graph

```json
{
  "waves": [
    {"tasks": [1]},
    {"tasks": [2]},
    {"tasks": [3]},
    {"tasks": [4, 9]},
    {"tasks": [5]},
    {"tasks": [6]},
    {"tasks": [7, 8]},
    {"tasks": [10]},
    {"tasks": [11]},
    {"tasks": [12, 13]},
    {"tasks": [14, 15]},
    {"tasks": [16]}
  ]
}
```

```
Task 1 (skeleton + data-store)
├── Task 2 (map + markers)
│   └── Task 3 (sidebar + nav)
│       ├── Task 4 (contractor reporting)
│       │   └── Task 5 (AI auditor) ★ Wow #1
│       │       └── Task 6 (closed loop) ★ Wow #2
│       │           ├── Task 7 (alerts)
│       │           └── Task 8 (feedback)
│       └── Task 9 (admin)
└── Task 10 (polish + demo) — depends on all above

Phase 2 (Integration Hardening):
Task 11 (smoke test + fix bugs) — depends on 1-10
├── Task 12 (unified panel router)
├── Task 13 (AI audit → selectable zone)
│   └── Task 14 (persist state + link image)
│   └── Task 15 (admin reject modal)
└── Task 16 (README + demo script) — last
```

## Notes

- Tasks 1-3 = Phase 1 Foundation (ทำเร็วที่สุด เพื่อให้มี canvas สำหรับ wow)
- Task 5 = จุดว้าวหลัก ต้องเห็นผลบนจอใน 30 วินาที
- Task 6 = จุดว้าวรอง (closed loop demo)
- ถ้าเวลาจำกัด ตัด Task 9 (admin) ลงเป็น minimal, มุ่ง Tasks 5+6 ให้ demo ได้
- Vision-LLM ใช้ mock fixtures ใน POC (ไม่ต้อง call API จริง)
- Rule Engine logic เป็นของจริง port จาก Rust compliance-auditor
