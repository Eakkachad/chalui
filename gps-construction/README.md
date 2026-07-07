# GPS Construction Platform

แพลตฟอร์มนำทาง + แจ้งเตือนงานก่อสร้าง + คุมมาตรฐานงาน สำหรับ DOH Hackathon 2026
ภายใต้ธีม **"Data for Better Journey / รู้รอบก่อนเดินทาง"**

Interactive construction-project map for Thailand — HTML/CSS/vanilla JS + Leaflet.js + OpenStreetMap + Font Awesome.

## แนวคิดหลัก (Moat): Closed Loop บน Single Source of Truth

```
ผู้รับเหมาส่งงาน + รูป → AI ตรวจมาตรฐาน → ผ่าน/ไม่ผ่าน
        ↓ (ข้อมูลชุดเดียวกัน)
ผ่าน → แสดงหมุด + เตือนคนขับ    ไม่ผ่าน → ซ่อนจากคนขับ
        ↓
คนขับ feedback → ≥3 รายการ → re-audit
```

## โครงสร้างไฟล์

```
gps-construction/
├── index.html            # หน้าเดียว รวมทุก panel
├── css/style.css         # responsive, Thai UI
├── js/
│   ├── script.js         # แผนที่ + markers + sidebar + route + PanelRouter
│   ├── ai-auditor.js     # AI Compliance Auditor (Rule Engine port จาก Rust) + Closed Loop + persist
│   ├── alerts.js         # Driver alerts (proximity 500m + suppression)
│   ├── feedback.js       # Citizen feedback → compliance signal
│   └── admin.js          # DOH Admin: approval queue + KPI + reject modal
└── dev-server.cjs        # static server
```

## Run

```bash
node dev-server.cjs
```
เปิด `http://127.0.0.1:5177/` (ต้องมีอินเทอร์เน็ตสำหรับ Leaflet/OSM/Font Awesome CDN)

## Demo Script — 2 Wow Moments

### 🎬 Wow #1: Multimodal AI Audit
1. กดแท็บ **AI** (แถบล่าง)
2. เลือกโครงการที่จะตรวจ + เลือก scenario "❌ ไม่ผ่าน"
3. กด **"ตรวจสอบมาตรฐาน"** → รอ 1.5s → เห็น Compliance Report:
   - Verdict badge (ผ่าน/ไม่ผ่าน)
   - Score gauge (0-100)
   - วัตถุที่ตรวจพบ (กรวย/ป้าย/ไฟ)
   - ผลรายกฎ 8 ข้อ + ข้อเสนอแนะ
   - Audit Hash (tamper-evident)

### 🎬 Wow #2: Closed Loop
4. หลัง audit "ไม่ผ่าน" → **หมุดของโครงการนั้นหายจากแผนที่** + toast "ซ่อนจากผู้ขับขี่"
5. เลือก scenario "✅ ผ่าน" → ตรวจอีกรอบ → **หมุดกลับมา** + toast "เผยแพร่แล้ว"
6. (state คงอยู่แม้ refresh หน้า — localStorage)

### เพิ่มเติม
- แท็บ **Admin** → คิวอนุมัติ (อนุมัติ/ปฏิเสธพร้อม modal เหตุผล) + KPI ผู้รับเหมา
- แท็บ **Reports** → ส่ง citizen report → ป้อนเป็น compliance signal อัตโนมัติ
- แท็บ **Alerts** → ประวัติการแจ้งเตือน

## Mapping ไปยัง Requirements

| Feature | Requirement | ไฟล์ |
|---------|-------------|------|
| แผนที่ + หมุด + sidebar | Req 1, 2 | script.js |
| Contractor reporting | Req 3 | script.js (construction form) |
| AI Compliance Audit | Req 4 | ai-auditor.js |
| Closed Loop | Req 5 | ai-auditor.js + script.js |
| Driver alerts + feedback | Req 6 | alerts.js, feedback.js |
| Admin review + KPI | Req 7 | admin.js |

## หมายเหตุขอบเขต (POC — ต้องพูดตอน pitch)

- **Vision-LLM ใช้ mock fixtures** — ผลตรวจจับวัตถุจำลอง 3 scenario (ของจริงต่อ Qwen-VL/Gemini/GPT-4o)
- **Rule Engine เป็นของจริง** — port แบบ deterministic จาก Rust crate `doh-compliance-auditor` (แนวคิด katgpt ConstraintPruner)
- **Audit Hash ใช้ SHA-256 fallback** — production ใช้ BLAKE3 จริง (js-blake3)
- **นอกขอบเขต POC:** turn-by-turn navigation, forecasting (KARC), carbon features, backend/database

## อ้างอิง katgpt-rs

ตัว AI Auditor นำแนวคิดจาก [katgpt-rs](https://github.com/katopz/katgpt-rs) มาใช้:
- **ConstraintPruner** → deterministic rule engine ที่การันตี output ถูก schema
- **reject_confidence (sigmoid)** → graded severity
- **merkle/BLAKE3** → tamper-evident audit trail
- **modelless** → ไม่ต้องเทรน รันบน edge ได้
