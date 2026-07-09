# GPS Construction Platform — Pitch Playbook

> **DOH Hackathon 2026** | Theme: Data for Better Journey / รู้รอบก่อนเดินทาง
> **ทีม:** BDI BKK | **Last Updated:** 2026-07-09

---

## 1. Solution คืออะไร (One-liner)

> **"ระบบนำทางที่เชื่อม GPS Navigation เข้ากับ AI Compliance Enforcement —
> ผู้ขับขี่เห็นทุกจุดก่อสร้าง โดยจุดที่ไม่ผ่านมาตรฐานจะถูกเตือนเป็นพิเศษ
> และส่งเจ้าหน้าที่กรมทางหลวงลงตรวจอัตโนมัติ"**

ไม่ใช่แค่ "แผนที่บอกจุดก่อสร้าง" แต่เป็น **Closed Loop** ที่บังคับคุณภาพงานก่อสร้าง
ผ่านการเชื่อม 3 ฝ่าย: ผู้รับเหมา → AI + เจ้าหน้าที่ ทล. → ประชาชน

---

## 2. ทำอะไร / แก้อะไร (Problem → Solution)

### ปัญหาที่แก้

| ปัญหาจริง | ผลกระทบ |
|-----------|---------|
| ข้อมูลก่อสร้างบนทางหลวงกระจัดกระจาย ไม่ real-time | ผู้ขับขี่ไม่รู้ล่วงหน้า → อุบัติเหตุ |
| ผู้รับเหมาส่ง checklist กระดาษ ไม่มีใครตรวจจริง | หน้างานไม่ได้มาตรฐาน → อันตราย |
| ทล. คนไม่พอลงตรวจ 73,000+ กม. | ตรวจไม่ทั่วถึง จุดเสี่ยงหลุด |
| อุบัติเหตุจากเขตก่อสร้าง | VSL 17.2–39.9 ล้านบาท/ราย |

### Solution แก้ 3 ด้าน

**🚗 ประชาชน** — รู้ก่อน ระวังก่อน ถึงปลอดภัย
- แผนที่ + alert 500m + พยากรณ์ความเร็ว (KARC) + ถามภาษาไทย + แจ้งปัญหากลับ

**🧑‍🔧 ผู้รับเหมา** — ตรวจเร็ว แก้ไขได้ วัดผลชัด
- ส่งงาน + รูปครั้งเดียว, AI ตรวจทันที, รู้จุดที่ต้องแก้, KPI โปร่งใส

**🛡️ กรมทางหลวง** — ตรวจทั่ว จัดลำดับ กดดันคุณภาพ
- AI ตรวจ 24/7, จัดลำดับความเสี่ยงอัตโนมัติ, admin validate, KPI ผู้รับเหมา

---

## 3. ทำได้ยังไง (How — Architecture)

```
ผู้รับเหมา ──ส่งรูป+ข้อมูล──► AI Rule Engine ──เสนอผล──► เจ้าหน้าที่ ทล. ──ยืนยัน/แก้──► ประชาชน
                              (8 กฎ, score)    (confidence)  (human-in-loop)    (แผนที่+alert)
                                                                    │
                              ประชาชนแจ้งปัญหา ◄──────re-audit──────┘
```

### 5 เทคโนโลยีหลัก (ทำงานจริง 100%)

| เทคโนโลยี | ทำอะไร | สถานะ |
|-----------|--------|-------|
| **Rule Engine** (8 กฎ deterministic) | ตรวจจำนวน/ระยะห่าง/ป้าย/ไฟ — ผลเหมือนกันทุกครั้ง | ✅ จริง |
| **Human-in-the-Loop** | AI เสนอ + confidence → admin ยืนยัน/override | ✅ จริง |
| **KARC Forecaster** | พยากรณ์ความเร็วจราจรบน browser (Reservoir Computing) | ✅ จริง |
| **Hodge Decomposition** | แยกจราจร: คอขวด/ไหลวน/ทางผ่าน (DEC) | ✅ จริง |
| **Closed Loop + BroadcastChannel** | audit → แผนที่อัปเดต real-time ข้าม tab | ✅ จริง |
| **Vision-LLM** (ตรวจรูป) | "ตา" ป้อน input เข้า Rule Engine | ⚠️ Mock (Phase 2) |

**หลักการสำคัญ:** Vision-LLM เป็นแค่ "ตา" — "สมอง" คือ Rule Engine ที่ deterministic
ถ้า LLM hallucinate → Rule Engine จับได้ เพราะกฎตายตัว

---

## 4. อ้างอิงว่าทำได้จริง (Proof / References)

### ตัวเลขปัญหา (จาก DOH_hack knowledge base)
| ข้อมูล | ค่า | แหล่ง |
|--------|-----|-------|
| อุบัติเหตุเสียชีวิต (2023) | 5,807 ราย = 232,000 ล้านบาท | DOH / WHO |
| VSL ต่อราย | 17.2–39.9 ล้านบาท | TDRI / DOH Internal |
| ระยะทางเครือข่าย | 73,000+ กม. | DOH Open Data (data.doh.go.th) |
| แขวงทางหลวง | 104 แขวง | DOH |

### เทคโนโลยีมีที่มา (ไม่ได้คิดเอง)
- **Rule Engine + ConstraintPruner** — port มาจาก Rust crate `compliance-auditor` ออกแบบตาม [katgpt-rs](https://github.com/katopz/katgpt-rs) SymbolicValidator pattern
- **KARC** — Kolmogorov-Arnold Reservoir Computing (Chebyshev/Fourier basis + Ridge Regression) จาก katgpt Plan 308
- **Hodge Decomposition** — Discrete Exterior Calculus (Helmholtz-Hodge) จาก katgpt Plan 261/314
- **Routing** — OSRM (OpenStreetMap) — production-grade open routing engine
- **WZDx (US)** — Work Zone Data Exchange พิสูจน์ว่ารัฐบาลใช้ open construction data ได้จริง (เราต่อยอดด้วย compliance)

### Data ที่ใช้ได้จริง (ไม่ต้องขอข้อมูลภายใน)
- DOH Open Data: ปริมาณจราจร, ระยะทาง, ความเร็วสูงสุด
- OpenStreetMap + OSRM: แผนที่ + routing
- มาตรฐาน: คู่มือมาตรฐานอุปกรณ์ควบคุมจราจรในงานก่อสร้าง กรมทางหลวง

---

## 5. ลำดับการนำเสนอ (5 นาที)

| เวลา | ช่วง | เนื้อหา |
|------|------|---------|
| 0:00–0:30 | **Hook** | อุบัติเหตุเขตก่อสร้าง 1 ราย = 40 ล้านบาท / ข้อมูลไม่ real-time |
| 0:30–1:30 | **Problem** | 3 ฝ่ายเจ็บ: ประชาชนเสี่ยง, ผู้รับเหมาไม่ถูกตรวจ, ทล.คนไม่พอ |
| 1:30–2:00 | **Solution** | 3 ด้าน + Closed Loop diagram |
| 2:00–4:30 | **Live Demo** | (ดู §6) |
| 4:30–5:00 | **Impact + Roadmap** | VSL ที่ป้องกันได้ + Phase 1-3 + ปิดด้วย one-liner |

---

## 6. Live Demo Script (2.5 นาที)

**เตรียม:** เปิด 2 tab — `/admin` + `/traveler` | typing "สุทธิสารติดปะ" ไว้ copy

| # | Action | พูด |
|---|--------|-----|
| 1 | Admin → AI ตรวจ → scenario "ไม่ผ่าน" → ตรวจ | "AI ตรวจ 8 กฎ ภายในวินาที — พร้อมค่าความมั่นใจ" |
| 2 | สลับแท็บอนุมัติ → เห็นการ์ด confirm/override | "AI ไม่ตัดสินเอง — เจ้าหน้าที่ ทล.ยืนยัน หรือแก้ถ้า AI ผิด" |
| 3 | กด "✓ ยืนยันตาม AI" | "ยืนยันแล้ว — ดูที่จอผู้ขับขี่" |
| 4 | สลับ tab traveler → หมุดแดงกะพริบ | "ไม่ผ่าน = เตือนหนักขึ้น ไม่ใช่ซ่อน + ส่ง ทล.ลงตรวจ" |
| 5 | Calculate route → Drive | "พยากรณ์ความเร็วด้วย KARC บน browser ไม่ต้องมี server" |
| 6 | รถเข้าใกล้ → alert แดง | "เตือนอันตรายก่อนถึง 500 เมตร" |
| 7 | ปุ่มม่วง → "สุทธิสารติดปะ" | "ถามไทย → Hodge แยกคอขวด vs รถวนหาทางลัด → แนะนำเลี่ยง" |

---

## 7. จุดที่ควรพูด (Key Messages — กรรมการต้องจำ)

1. **"ไม่ผ่าน = เตือนหนักขึ้น ไม่ใช่ซ่อน"** — ยิ่งอันตราย ยิ่งต้องเตือน + ส่งคนลงตรวจ
2. **"AI เสนอ ทล.ตัดสิน"** — เร็วขึ้นแต่ยังมีคนรับผิดชอบ รองรับเคส AI ผิด
3. **"Deterministic ตรวจสอบได้ทางกฎหมาย"** — ต่างจาก ML ที่ตอบไม่เหมือนกัน + SHA-256 hash
4. **"ประชาชนเป็นเซนเซอร์"** — feedback 3 ครั้ง = re-audit ได้หูตาทั่วประเทศฟรี
5. **"ไม่ต้องมี hardware / server / ข้อมูลภายใน"** — รันบน browser ใช้ open data

---

## 8. จุดที่ยังพลาด (Known Weaknesses — เตรียมรับ)

| จุดอ่อน | วิธีบริหารความเสี่ยง |
|---------|---------------------|
| **Vision-LLM ยังเป็น mock** | อย่าชูเป็นพระเอก — ชู Rule Engine ที่ทำงานจริง พูดว่า Vision = Phase 2 "ตา" |
| **ThaiLLM API ต้องมี network** | มี fallback rule-based ตอบได้แม้ offline (demo ได้แม้เน็ตล่ม) |
| **ข้อมูลเป็น sample 15 โครงการ** | บอกชัดว่า POC — Phase 1 ต่อ DOH Open Data จริง |
| **Closed loop ต้องเปิด 2 tab** | ใช้ BroadcastChannel sync จริง — Phase 2 เป็น backend sync ข้าม device |
| **KPI/accuracy ยังเป็น session** | Phase 2 มี database เก็บถาวร |
| **ยังไม่มี auth จริง** | POC ไม่มี login — Phase 2 ต่อ ThaiID / DOH SSO |

**กฎเหล็กตอน demo:**
- อย่ากด scenario "critical" ถ้ายังไม่อธิบาย (score 0 ดูน่ากลัว)
- อย่า refresh traveler ระหว่าง demo (BroadcastChannel sync ให้เอง)
- ใช้ gps-astro เท่านั้น ไม่ใช่ gps-construction (v1)

---

## 9. จุดที่กรรมการจะถาม (Judge Q&A)

| คำถาม | คำตอบ |
|-------|-------|
| **"ตรวจรูปจริงได้ไหม"** | "Rule Engine พร้อมรับ input จาก Vision-LLM วันนี้ — POC ใช้ 3 scenario จำลอง เพื่อโชว์ logic ก่อน Phase 2 ต่อ Qwen-VL ซึ่ง architecture รองรับแล้ว" |
| **"ต่างจาก Waze/Google Maps ตรงไหน"** | "Waze = crowdsource ไม่ verify. ของเรา = ข้อมูลผ่าน AI compliance + ทล.ยืนยัน ก่อนถึงผู้ขับขี่ — และ enforce คุณภาพงานก่อสร้าง" |
| **"AI ตรวจผิดจะทำยังไง"** | "AI ไม่ตัดสินเอง — เจ้าหน้าที่ ทล.ยืนยันทุกครั้ง ถ้า AI ผิด override พร้อมเหตุผล ระบบวัดความแม่นยำ AI ตลอด" |
| **"ทำไมไม่ใช้ ML/Deep Learning เลย"** | "กฎหมายต้องการผล reproducible — ML ตอบไม่เหมือนกันทุกครั้ง ใช้เป็นหลักฐานไม่ได้ Rule Engine ให้ผลเดียวกัน 100%" |
| **"KARC/Hodge จำเป็นจริงหรือ"** | "Route ธรรมดาบอกแค่ระยะทาง — KARC บอกอีก 15 นาทีจะติดไหม, Hodge บอกจุดไหนรถวนหาทางลัด → แนะนำฉลาดกว่า" |
| **"ราคาคาร์บอน/งบจากไหน"** | (ถ้าถามเรื่องเงิน) "ระบบใช้ open data + browser ต้นทุนต่ำมาก ไม่ต้องซื้อ hardware/server" |
| **"scale ได้จริงไหม 73,000 กม."** | "Rule Engine เป็น O(rules) รันบน edge/browser — ยิ่งกระจาย ยิ่ง scale ได้ ไม่ต้องพึ่ง central GPU" |
| **"ใครจะใช้ ประชาชนโหลดแอปไหม"** | "เริ่มจาก LINE OA / เว็บ ไม่ต้องโหลดแอป — ผู้รับเหมา+ทล.ใช้เป็น workflow บังคับอยู่แล้ว ประชาชนเป็น bonus layer" |
| **"ข้อมูลผิดพลาด/มั่ว spam ล่ะ"** | "Feedback มี rate limit 5/10 นาที + ต้องสะสม 3 ครั้งประเภทเดียวถึง trigger + ทล.ยืนยันก่อน action" |
| **"ความเป็นส่วนตัว/รูปคน"** | "รูปเป็นหน้างานก่อสร้าง ไม่เก็บ PII — Phase 2 เพิ่ม blur ใบหน้า/ทะเบียนอัตโนมัติ" |

---

## 10. Roadmap (ตอบเรื่อง feasibility)

| Phase | เมื่อไหร่ | ทำอะไร |
|-------|---------|--------|
| **0 — POC** | ตอนนี้ | Prototype ครบ 3 role + AI + KARC/Hodge (มี demo) |
| **1 — Pilot** | Q3 2026 | ต่อ DOH Open Data จริง + 1 แขวงทางหลวง + backend |
| **2 — Validation** | Q4 2026–Q1 2027 | ต่อ Vision-LLM จริง + LINE OA + auth + database |
| **3 — Scale** | 2027+ | ขยาย 104 แขวง + integrate ระบบ ทล. |

---

## 11. One-liner ปิดการนำเสนอ

> **"เราไม่ได้แค่บอกประชาชนว่ามีก่อสร้างตรงไหน —
> เราทำให้ 'งานที่ไม่ได้มาตรฐาน' ถูกเห็น ถูกเตือน และถูกตรวจ
> โดยมี AI ช่วยเร่ง และมีเจ้าหน้าที่กรมทางหลวงเป็นผู้รับผิดชอบความถูกต้อง"**

*"ยิ่งไม่ปลอดภัย ยิ่งต้องเตือน ไม่ใช่ซ่อน"*
