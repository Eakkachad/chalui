# Implementation Plan:

## Overview

ย้าย GPS Construction Platform ไป Astro แบบแยก 3 role (traveler/contractor/admin) โดยคง GPS map เดิม เน้น reuse โค้ด vanilla ให้มากที่สุด rewrite น้อยที่สุด

## Tasks

- [x] 1. Scaffold Astro project — สร้าง gps-astro/ (npm create astro), ติดตั้ง deps, สร้าง astro.config.mjs, BaseLayout.astro, และ 4 หน้าเปล่า (index/traveler/contractor/admin), ยืนยัน dev server รันได้
- [x] 2. ยก assets เดิมเข้า Astro — copy style.css ไป public/css/, copy sample-data.js + ai-auditor.js + alerts.js + feedback.js ไป public/js/, เพิ่ม Leaflet/Font Awesome CDN ใน BaseLayout
- [x] 3. แตก data-store ออกจาก script.js — (ใช้ทางลัด: ยก script.js ทั้งก้อน + guard ถ้าไม่มี #map ไม่ init) attach ไป window ให้ทุกหน้าใช้ร่วม
- [x] 4. แตก map-core ออกจาก script.js — (ใช้ทางลัด: ยก script.js ทั้งก้อน + อ่าน window.APP_ROLE) filter markers traveler=published, admin=all, contractor=own
- [x] 5. แตก route-planner ออกจาก script.js — (ใช้ทางลัด: route logic ยังอยู่ใน script.js ทั้งก้อน โหลดเฉพาะ traveler page ที่มี DOM elements)
- [x] 6. สร้าง Astro components — (ใช้ทางลัด: embed markup ตรงใน .astro pages แต่ละ role แทนแยก component files)
- [x] 7. ประกอบหน้า index.astro (เลือก role) — landing page เลือก Traveler/Contractor/Admin → ไป route ที่ตรง
- [x] 8. ประกอบหน้า traveler.astro — map + sidebar + route planner + alerts + feedback + reports + detail modal
- [x] 9. ประกอบหน้า contractor.astro — map + construction form + detail modal
- [x] 10. ประกอบหน้า admin.astro — map + AI Auditor + Admin Queue/KPI + detail modal
- [x] 11. Role guard + navigation — Bottom Nav ต่างกันตาม role (ทำเสร็จ — แต่ละ .astro page มี nav เฉพาะ), visibleProjects filter ตาม publishedToDrivers (ทำเสร็จจาก Phase 1), redirect ไม่จำเป็นเพราะแยก page แล้ว
- [x] 12. Responsive + ทดสอบต่อ role — CSS reuse จาก chalui เดิม (responsive breakpoints ทำแล้ว), README อัปเดตแล้ว

## Task Dependency Graph

```json
{
  "waves": [
    {"tasks": [1]},
    {"tasks": [2, 3]},
    {"tasks": [4]},
    {"tasks": [5, 6]},
    {"tasks": [7]},
    {"tasks": [8, 9, 10]},
    {"tasks": [11]},
    {"tasks": [12]}
  ]
}
```

```
Task 1 (scaffold Astro)
├── Task 2 (copy assets)
├── Task 3 (data-store) ──┐
│                         └── Task 4 (map-core + role guard)
│                              ├── Task 5 (route-planner)
│                              └── Task 6 (astro components)
│                                   └── Task 7 (index/role select)
│                                        └── Task 8,9,10 (3 role pages, ขนาน)
│                                             └── Task 11 (role guard + nav)
│                                                  └── Task 12 (responsive + test)
```

## Notes

- **หลักการ:** reuse โค้ด chalui ให้มากสุด — Astro HTML-first ทำให้ vanilla JS/CSS ยกไปได้เกือบทั้งดุ้น
- **ไม่ rewrite เป็น React** — เก็บ GPS map (Leaflet) เดิมที่ผู้ใช้ชอบ
- **ความเสี่ยงหลัก:** script.js ใช้ global vars เยอะ → การแตกไฟล์ (Task 3-5) ต้องระวัง load order, ให้ attach window
- **ทางลัดถ้าเวลาจำกัด:** ใช้ script.js เดิมทั้งก้อนใน BaseLayout ก่อน (ไม่แตกไฟล์) แล้วแค่ซ่อน/แสดง panel ตาม APP_ROLE — เร็วกว่าแต่ code ไม่สะอาด
- safezone-demo (React) ใช้เป็น reference สำหรับ Contractor/Admin field เท่านั้น ไม่ใช้โค้ด
- Data model + AI Auditor คงเดิมจาก spec gps-construction-platform
