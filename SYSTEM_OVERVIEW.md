# GPS Construction Platform — System Overview

> **DOH Hackathon 2026** | Theme: Data for Better Journey / รู้รอบก่อนเดินทาง  
> **ทีม:** BDI BKK  
> **Last Updated:** 2026-07-09

---

## Landing Page (`/`)

| | |
|---|---|
| **หน้าที่** | เลือก Role (3 ทางเข้า) |
| **Input** | กดเลือก: Traveler / Contractor / Admin |
| **Output** | Redirect ไปหน้าตาม role |

---

## 🚗 Traveler — ผู้เดินทาง (`/traveler`)

> **ใครใช้:** ประชาชนทั่วไป คนขับรถ ผู้ใช้ถนน

| ฟีเจอร์ | Input | Output |
|---------|-------|--------|
| **แผนที่** | เปิดหน้า | แผนที่ Leaflet + หมุดโครงการก่อสร้าง (ผ่าน=เขียว, ไม่ผ่าน=แดงกะพริบ) |
| **ค้นหา** | พิมพ์ชื่อถนน/จังหวัด/ผู้รับเหมา | Zoom ไปหมุดที่ match + highlight |
| **Route Planner** | ต้นทาง + ปลายทาง | เส้นทางบนแผนที่ + ระยะ/เวลา + จำนวนโซนก่อสร้างที่ขวาง + ActionBridge score |
| **Drive Simulation** | กด Drive + เลือก speed | รถจำลองวิ่ง + alert popup 500m ก่อนถึงโซน + KARC forecast real-time |
| **Proximity Alert** | รถเข้าใกล้โซน 500m | Banner เตือน: ชื่อ, ถนน, เลนปิด, ความเร็วจำกัด — ไม่ผ่านมาตรฐาน=แดงเตือนอันตราย |
| **ThaiLLM Chat** | กดปุ่มม่วง → พิมพ์ถามเป็นไทย | วิเคราะห์ KARC (ความเร็ว) + Hodge (ไหลวน) + แนะนำเส้นเลี่ยง |
| **Report (แจ้งปัญหา)** | ประเภท + พิกัด + รูป + คำอธิบาย | บันทึก + ผูก zone ใกล้สุด → สะสม ≥3 = trigger re-audit |
| **Marker Popup** | คลิกหมุด | ข้อมูลโครงการ + 🔮 KARC Forecast ความเร็ว |

**Output รวม:** ผู้ขับขี่รู้ล่วงหน้าว่าจะเจอก่อสร้างตรงไหน ได้มาตรฐานหรือไม่ ควรเลี่ยงเส้นทางไหน

---

## 🧑‍🔧 Contractor — ผู้รับเหมา (`/contractor`)

> **ใครใช้:** บริษัทผู้รับเหมาก่อสร้างทางหลวง

| ฟีเจอร์ | Input | Output |
|---------|-------|--------|
| **เพิ่มโครงการ** | ชื่องาน + ประเภท + ถนน + พิกัด GPS + วันเริ่ม/สิ้นสุด + ขอบเขต(เมตร) + สถานะ + รูป | หมุดขึ้นบนแผนที่ + เข้าคิว Admin อนุมัติ |
| **อัปโหลดรูปหน้างาน** | เลือกไฟล์ภาพ | แสดงใน detail + พร้อมส่ง AI ตรวจ |
| **ส่งงานให้ AI ตรวจ** | เลือกโครงการ + อัปรูป | ส่งต่อไป Admin เพื่อ run AI Audit |

**Output รวม:** ข้อมูลโครงการก่อสร้างเข้าสู่ระบบ → ผ่าน verification → กลายเป็น data ที่ Traveler เห็น

---

## 🛡️ Admin — เจ้าหน้าที่กรมทางหลวง (`/admin`)

> **ใครใช้:** เจ้าหน้าที่ ทล. ผู้มีอำนาจอนุมัติ

| ฟีเจอร์ | Input | Output |
|---------|-------|--------|
| **AI Compliance Audit** | เลือกโครงการ + scenario/รูป + กด "ตรวจสอบ" | Compliance Report: verdict + score/100 + รายกฎ 8 ข้อ + recommendations + SHA-256 hash |
| **Closed Loop** | audit verdict | **ผ่าน:** หมุดเขียวปกติ / **ไม่ผ่าน:** หมุดแดงกะพริบ + alert อันตราย + flag "ทล.ลงตรวจ" — sync ข้าม tab ทันที |
| **คิวอนุมัติ** | ✓ อนุมัติ / ✕ ปฏิเสธ (เหตุผล ≥10 ตัวอักษร) | Zone เปลี่ยนสถานะ + Broadcast ไป Traveler |
| **Feedback จากประชาชน** | ดู report + กด "ดำเนินการแล้ว" | อัปเดตสถานะ → ≥3 report = flag re-audit อัตโนมัติ |
| **KPI ผู้รับเหมา** | เปิดดู | Score: audit pass/fail + feedback → เกรด 🟢ดี / 🟡พอใช้ / 🔴ต้องปรับปรุง |

**Output รวม:** Compliance enforcement — ไม่ได้มาตรฐาน = เตือนประชาชน + ส่งเจ้าหน้าที่ลงตรวจ + KPI ผู้รับเหมาลด

---

## 🔄 Data Flow

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│ CONTRACTOR  │         │    ADMIN     │         │  TRAVELER   │
│             │         │              │         │             │
│ ส่งข้อมูล    ├────────►│ AI ตรวจ 8 กฎ  │         │ เห็นแผนที่    │
│ + รูปหน้างาน  │         │              │         │ + alert     │
│             │         │   ผ่าน ✅     ├────────►│ หมุดเขียว    │
│             │         │              │         │             │
│             │         │   ไม่ผ่าน ❌   ├────────►│ หมุดแดงกะพริบ │
│             │         │ +ส่ง ทล.ลงตรวจ │         │ +alert อันตราย│
│             │         │              │         │             │
│             │         │              │◄────────┤ Feedback ≥3 │
│             │         │  re-audit    │         │ "ไม่มีกรวย"   │
│ KPI ลด ◄───┤         │              │         │             │
└─────────────┘         └──────────────┘         └─────────────┘
                              │
                    BroadcastChannel
                    (real-time cross-tab sync)
```

---

## 🧠 AI/Math Modules (ทำงานเบื้องหลัง)

| Module | Input | Output | ใช้ตรงไหน |
|--------|-------|--------|-----------|
| **Rule Engine** (8 กฎ DOH) | SceneDetection (วัตถุ + จำนวน + ตำแหน่ง) | ComplianceReport (score, verdict, hash) | Admin → AI Audit |
| **KARC Forecaster** (Reservoir Computing) | Speed observations ทุก frame ขณะ Drive | ความเร็วคาดการณ์ X กม./ชม. | Popup, drive readout, chat, route score |
| **Hodge Decomposition** (DEC) | Edge flows (base + construction penalty) | Exact(คอขวด) + Coexact(ไหลวน) + Harmonic(ทางผ่าน) | Route scoring, ThaiLLM chat |
| **ThaiLLM / Gemini API** | คำถามไทย + context (projects + KARC + Hodge) | คำตอบแนะนำ + อ้างอิงข้อมูลจริง | Chat panel (Traveler) |
| **BroadcastChannel** | Compliance state update | Sync ข้าม tab ทันที (ไม่ต้อง refresh) | Admin ↔ Traveler closed loop |
| **ActionBridge** (Sigmoid ranking) | Route score (delay + penalties) | ค่าความน่าเชื่อถือ 0-100% | Route recommendation |

---

## 🎯 Demo Moments (เรียงตามลำดับ pitch)

| # | เวลา | สิ่งที่โชว์ | Wow Factor |
|---|------|-----------|-----------|
| 1 | 0:00 | เปิด Admin + Traveler 2 tab | Setup |
| 2 | 0:30 | Admin: AI ตรวจ → ❌ ไม่ผ่าน | หมุดแดงกะพริบทันทีบน Traveler (ไม่ refresh!) |
| 3 | 1:00 | Admin: AI ตรวจ → ✅ ผ่าน | หมุดกลับเป็นเขียวปกติ |
| 4 | 1:30 | Traveler: Drive Simulation เริ่ม | รถวิ่ง + KARC forecast แสดง real-time |
| 5 | 2:30 | รถเข้าใกล้โซนไม่ผ่าน 500m | 🚨 Alert แดงเตือนอันตราย + "ทล.แจ้งลงตรวจแล้ว" |
| 6 | 3:00 | กดปุ่มม่วง → ถาม "สุทธิสารติดปะ" | Hodge: Exact/Coexact/Harmonic + แนะนำเลี่ยงซอย |
| 7 | 3:45 | ถาม "รัชโยธินเป็นยังไง" | KARC: predicted speed + delay + Chebyshev basis |
| 8 | 4:15 | Traveler: ส่ง feedback 3 ครั้ง | Zone flag re-audit อัตโนมัติ |
| 9 | 4:45 | สรุป: Triple Accountability | ผู้รับเหมา → AI → ประชาชน → ครบวงจร |

---

## 📐 Technical Differentiation

| เรา | Waze | Google Maps | WZDx (US) |
|-----|------|-------------|-----------|
| AI Compliance Gate (8 กฎ deterministic) | ❌ | ❌ | ❌ |
| ไม่ผ่าน = เตือนมากขึ้น (ไม่ใช่ซ่อน) | ❌ | ❌ | ❌ |
| Citizen Feedback → Re-audit trigger | ❌ | ❌ | ❌ |
| KARC speed forecasting (client-side) | ❌ | ❌ | ❌ |
| Hodge Flow traffic decomposition | ❌ | ❌ | ❌ |
| Cross-tab real-time sync (BroadcastChannel) | ❌ | ❌ | ❌ |
| Tamper-evident audit hash (SHA-256) | ❌ | ❌ | ❌ |
| KPI ผู้รับเหมา (data-driven grading) | ❌ | ❌ | ❌ |
| ทำงาน offline/edge (ไม่ต้องมี GPU/server) | ❌ | ❌ | ❌ |

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Astro 5 (SSR + static assets) |
| Map | Leaflet.js + OpenStreetMap + OSRM routing |
| AI Logic | Deterministic Rule Engine (ported จาก Rust) |
| Forecasting | KARC (Kolmogorov-Arnold Reservoir Computing) |
| Traffic Analysis | Hodge Decomposition (Discrete Exterior Calculus) |
| NLP | ThaiLLM API (typhoon-s-8b) + Gemini fallback |
| Integrity | SHA-256 audit hash (production: BLAKE3) |
| Sync | BroadcastChannel API (cross-tab) + server polling |
| State | Browser memory + localStorage |
| Icons | Font Awesome 6 |
| Styling | Vanilla CSS (mobile-first, responsive) |

---

*"ยิ่งไม่ปลอดภัย ยิ่งต้องเตือน ไม่ใช่ซ่อน — นี่คือ Closed Loop ที่แท้จริง"*
