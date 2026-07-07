# GPS Construction Platform — DOH Hackathon 2026

> **ธีม:** Data for Better Journey / รู้รอบก่อนเดินทาง  
> **ทีม:** BDI BKK  
> **เป้าหมาย:** ระบบนำทาง + แจ้งเตือนก่อสร้าง + คุมมาตรฐานงาน (Closed Loop)

---

## แนวคิดหลัก (Moat)

ระบบที่เชื่อม **navigation** กับ **compliance enforcement** บนข้อมูลชุดเดียว:

```
ผู้รับเหมาส่งงาน+รูป → AI ตรวจมาตรฐาน (Rule Engine)
        ↓                        ↓
  ผ่าน → หมุดขึ้นบนแผนที่    ไม่ผ่าน → ซ่อนจากคนขับ
        ↓
  คนขับเข้าใกล้ → alert       คนขับ feedback "ไม่มีกรวย"
        ↓                        ↓
  ≥3 feedback → re-audit      KPI ผู้รับเหมาลด
```

**ต่างจาก Waze:** ข้อมูลไม่ใช่ crowdsourced ที่ไม่ verify — มาจากผู้รับเหมาที่ต้องผ่าน AI audit ก่อนเข้าระบบ  
**ต่างจาก WZDx (US):** ไม่ใช่แค่รัฐ publish data — ผูก compliance enforcement เข้ากับ navigation data โดยตรง

---

## โครงสร้าง Repository

```
GPS chalui/
├── README.md                          ← คุณอยู่ที่นี่
├── Phase1_GPS_Construction_Mockup.md  ← แผน Phase 1 เดิม (vanilla JS)
│
├── gps-construction/                  ← Prototype v1 (vanilla JS — all-in-one page)
│   ├── index.html                     │  ใช้ได้เลย: node dev-server.cjs → :5177
│   ├── css/style.css                  │
│   ├── js/
│   │   ├── script.js                  │  แผนที่ + markers + route + drive sim (2000 LOC)
│   │   ├── ai-auditor.js             │  AI Compliance Auditor (Rule Engine port จาก Rust)
│   │   ├── alerts.js                  │  Driver alerts (proximity 500m)
│   │   ├── feedback.js                │  Citizen feedback → compliance signal
│   │   └── admin.js                   │  DOH Admin approval + KPI
│   └── dev-server.cjs                 │  Static server (0.0.0.0:5177)
│
├── gps-astro/                         ← Prototype v2 (Astro — role-separated pages)
│   ├── package.json                   │  deps: astro ^5.7.0 | run: pnpm dev → :4321
│   ├── astro.config.mjs               │
│   ├── src/
│   │   ├── layouts/BaseLayout.astro   │  CDN imports + role-aware script loading
│   │   └── pages/
│   │       ├── index.astro            │  Landing: เลือก role (3 cards)
│   │       ├── traveler.astro         │  แผนที่เต็มจอ + sidebar + route + alerts
│   │       ├── contractor.astro       │  Mobile card page (safezone style)
│   │       └── admin.astro            │  Mobile card page + AI Audit + KPI
│   └── public/
│       ├── css/style.css              │  Reuse จาก v1 + mobile card styles
│       └── js/                        │  Copy จาก v1 (null-safe สำหรับ multi-page)
│
└── .kiro/specs/                       ← Spec documents (requirements → design → tasks)
    ├── gps-construction-platform/     │  Spec เดิม (requirements + design + tasks)
    └── astro-role-migration/          │  Spec สำหรับ Astro migration
```

---

## Quick Start

### Prototype v1 (vanilla — ใช้ทดสอบเร็ว)
```bash
cd gps-construction
node dev-server.cjs
# เปิด http://localhost:5177
```

### Prototype v2 (Astro — role-separated, ใช้จริง)
```bash
cd gps-astro
pnpm install
pnpm dev
# เปิด http://localhost:4321
```

---

## 3 Roles / 3 Pages

| Role | URL | เหมาะใช้บน | หน้าที่หลัก |
|------|-----|-----------|------------|
| **Traveler** (ผู้เดินทาง) | `/traveler` | มือถือ | แผนที่ GPS + แจ้งเตือนก่อสร้าง + route planner |
| **Contractor** (ผู้รับเหมา) | `/contractor` | มือถือ/แท็บเล็ต | ส่งรายงานพื้นที่ + รูปหน้างาน |
| **Admin** (เจ้าหน้าที่ ทล.) | `/admin` | แท็บเล็ต/จอใหญ่ | AI ตรวจมาตรฐาน + อนุมัติ + KPI |

---

## ฟีเจอร์หลัก (สถานะ)

| Feature | สถานะ | ไฟล์ |
|---------|--------|------|
| แผนที่ Leaflet + 15 sample zones | ✅ ใช้ได้ | script.js |
| Marker 4 สถานะ + popup + clustering | ✅ | script.js |
| Route planner + drive simulation | ✅ | script.js |
| Geolocation + current position | ✅ | script.js |
| Search + Sidebar project list | ✅ | script.js |
| Construction form (contractor) | ✅ | script.js / contractor.astro |
| **AI Compliance Auditor** | ✅ | ai-auditor.js |
| **Closed Loop (verdict → marker)** | ✅ | ai-auditor.js + script.js |
| Driver alerts (500m proximity) | ✅ | alerts.js |
| Citizen feedback → re-audit trigger | ✅ | feedback.js |
| Admin approval queue + KPI | ✅ | admin.js / admin.astro |
| Compliance state persistence (localStorage) | ✅ | ai-auditor.js |
| Tamper-evident audit hash (SHA-256) | ✅ | ai-auditor.js |
| Role-separated Astro pages | ✅ | gps-astro/ |
| Mobile card UI (safezone-style) | ✅ | contractor.astro + admin.astro |

---

## Demo Script — Wow Moments

### Wow #1: AI Compliance Audit (admin)
1. เปิด `/admin` → อยู่ที่แท็บ "🧠 AI ตรวจ"
2. เลือกโครงการ + scenario "❌ ไม่ผ่าน"
3. กด "ตรวจสอบมาตรฐาน" → loading 1.5s → **Compliance Report** เด้ง:
   - Verdict badge, Score gauge, วัตถุที่ตรวจพบ, ผลรายกฎ 8 ข้อ, Audit Hash

### Wow #2: Closed Loop (traveler เห็นผลทันที)
4. เปิด `/traveler` อีก tab → สังเกตว่า **หมุดของโครงการที่ไม่ผ่านหายจากแผนที่**
5. กลับไป `/admin` → เลือก "✅ ผ่าน" → ตรวจอีกรอบ → **หมุดกลับมา**

### Bonus: Citizen Feedback → Re-audit
6. ใน `/traveler` → Reports → ส่ง report 3 ครั้งเกี่ยวกับ zone เดียว → system flag re-audit

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Astro 5 (static output) |
| Map | Leaflet.js + OpenStreetMap |
| Icons | Font Awesome 6 |
| Styling | Vanilla CSS (mobile-first, responsive) |
| AI Logic | Deterministic Rule Engine (port จาก Rust `compliance-auditor`) |
| Hash | SHA-256 (fallback — production ใช้ BLAKE3) |
| State | Browser memory + localStorage |
| Server | Astro dev server / static |

---

## AI / katgpt-rs เกี่ยวอะไร

Rule Engine ใน `ai-auditor.js` port มาจาก Rust crate `DOH_hack/src/compliance-auditor/` ซึ่งออกแบบตามแนวคิด [katgpt-rs](https://github.com/katopz/katgpt-rs):

| katgpt concept | ใช้ในระบบนี้ |
|---|---|
| `ConstraintPruner::is_valid()` | `evaluateSingleRule()` — deterministic rule check |
| `reject_confidence` (sigmoid) | graded severity per rule |
| `merkle_octree` / BLAKE3 | `computeAuditHash()` — tamper-evident report |
| modelless / edge-first | Rule Engine ไม่ต้องเทรน รันบน browser |

**ข้อควรระวัง:** Vision-LLM ใช้ **mock fixtures** (3 scenarios) ใน POC — ยังไม่ต่อ API จริง Rule Engine logic เป็นของจริง

---

## Specs (สำหรับ Agent อื่นๆ)

อ่าน spec ก่อนทำต่อ:

1. **`.kiro/specs/gps-construction-platform/requirements.md`** — 8 requirements (ภาษาไทย + EARS) ครอบคลุม map, AI audit, closed loop, alerts, feedback, admin, out-of-scope
2. **`.kiro/specs/gps-construction-platform/design.md`** — system architecture + data models + file structure
3. **`.kiro/specs/gps-construction-platform/tasks.md`** — 16 tasks (Phase 1 + Phase 2 hardening) + dependency graph
4. **`.kiro/specs/astro-role-migration/design.md`** — Astro multi-page architecture + role mapping
5. **`.kiro/specs/astro-role-migration/tasks.md`** — 12 tasks (scaffold → role pages → responsive)

---

## Known Issues / TODO

| Issue | Priority | Note |
|-------|----------|------|
| Vision-LLM เป็น mock | 🟡 | ต่อ Qwen-VL/Gemini API เมื่อเข้า Round 2 |
| Closed loop ต้องเปิด 2 tab (admin+traveler) | 🟡 | ถ้ามี backend จะ sync ข้าม client |
| Admin ยัง basic (prompt → เปลี่ยนเป็น modal ใน v1 แล้ว) | 🟢 | polish ต่อได้ |
| Contractor ยังไม่ validate ครบ (กม. range, พิกัดไทย) | 🟢 | เพิ่มตาม req 3 |
| Forecasting / "Know Before You Go" | ⬜ Roadmap | KARC (katgpt) — Phase 2 |
| Carbon features | ⬜ Roadmap | เก็บไว้ใน DOH_hack (CarbonWay) |

---

## สำหรับ Agent ที่จะทำต่อ

**สิ่งที่ต้องทำถัดไป (เรียงตามสำคัญ):**

1. **ทดสอบใน browser จริง** — เปิด 3 pages, ดู console, แก้ runtime error ที่เจอ
2. **เพิ่ม validation ใน contractor form** (req 3) — กม.เริ่ม < สิ้นสุด, พิกัดในไทย
3. **ปรับ admin audit ให้ closed-loop reflect ทันทีบน traveler** (ตอนนี้ต้อง refresh)
4. **Connect real Vision-LLM** — เปลี่ยน mock → API call (Qwen-VL / Gemini)
5. **Deploy** — Astro static build → Netlify/Vercel/Cloudflare Pages

**อย่าแก้ไฟล์ใน DOH_hack** — เก็บไว้เป็น knowledge base เท่านั้น ทำทุกอย่างใน `GPS chalui/`

---

## License

MIT (POC for DOH Hackathon 2026)
