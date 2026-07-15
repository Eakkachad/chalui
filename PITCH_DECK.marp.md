---
marp: true
theme: default
paginate: true
size: 16:9
header: 'ฉลุย (Chalui) · DOH Hackathon 2026 · ทีม BDI BKK'
style: |
  section { font-family: 'Sarabun', 'Segoe UI', sans-serif; font-size: 26px; }
  h1 { color: #0f766e; }
  h2 { color: #0f766e; }
  strong { color: #dc2626; }
  table { font-size: 20px; }
  .small { font-size: 18px; color: #64748b; }
  section.lead { text-align: center; }
---

<!-- _class: lead -->
# ฉลุย (Chalui)

## รู้รอบก่อนเดินทาง — Data for Better Journey

ระบบนำทาง + แจ้งเตือนก่อสร้าง + คุมมาตรฐานงาน แบบ **Closed Loop**

ทีม **BDI BKK** · DOH Hackathon 2026

<!--
Speaker note: เปิดด้วย 1 ประโยค — "ยิ่งไม่ปลอดภัย ยิ่งต้องเตือน ไม่ใช่ซ่อน"
-->

---

# 1 · ปัญหา & กลุ่มเป้าหมาย

**3 ฝ่ายที่เจ็บปวดจากงานก่อสร้างบนถนน**

| 🚗 ผู้สัญจร | 🧑‍🔧 ผู้รับเหมา | 🛡️ กรมทางหลวง |
|---|---|---|
| ไม่เตือนก่อนถึงจุดก่อสร้าง | ไม่มีระบบ digital ส่งรายงาน | ไม่มี visibility real-time |
| ไม่รู้สถานะ real-time | ไม่มีช่องอัปเดต real-time | ไม่มี AI ตรวจมาตรฐาน |
| ไม่มีช่องทาง feedback | ไม่มี GPS + photo evidence | ไม่มี closed loop ข้อมูล |

**ต้นตอร่วม:** ข้อมูลกระจัดกระจาย ไม่ verify ไม่เชื่อมกัน → อุบัติเหตุซ้ำ

<span class="small">อ้างอิง: Thai Ombudsman เร่งรัดมาตรการความปลอดภัยไซต์ก่อสร้าง (2025); WHO Thailand Road Safety Profile 2023</span>

<!--
Speaker note: โยงข่าวอุบัติเหตุไซต์ก่อสร้างล่าสุด เพื่อสร้าง urgency
-->

---

# 1 · ขนาดปัญหา (ตัวเลข)

- ไทยเสียชีวิตจากอุบัติเหตุถนน **~18,000 ราย/ปี** (2021)
- อัตราสูงกว่าค่าเฉลี่ยภูมิภาคอย่างมีนัยสำคัญ
- งานก่อสร้าง/ซ่อมทางเป็นจุดเสี่ยงซ้ำที่ถูกร้องเรียน

**กลุ่มเป้าหมายหลัก:** กรมทางหลวง (ผู้กำกับ) + ผู้รับเหมา + ประชาชนผู้ใช้ถนน

<span class="small">อ้างอิง: Thailand Road Safety Profile 2025 (Asian Transport Observatory); WHO 2023</span>

---

# 2 · ทางแก้ & Value Proposition

**ฉลุย = Navigation + Compliance Enforcement บนข้อมูลชุดเดียว**

```
ผู้รับเหมาส่งงาน+รูป → AI ตรวจ 8 กฎ → ผ่าน/ไม่ผ่าน
        ↓ (ข้อมูลชุดเดียวกัน)
ผ่าน → หมุดเขียว        ไม่ผ่าน → หมุดแดง + เตือนอันตราย + ส่ง ทล.ลงตรวจ
        ↓
ประชาชน feedback ≥3 → re-audit อัตโนมัติ
```

**Moat:** ยิ่งไม่ปลอดภัย ยิ่งเตือน (ไม่ซ่อน) + ข้อมูลผ่าน compliance gate ก่อนขึ้นแผนที่

---

# 2 · ต่างจากคู่แข่งยังไง

| ความสามารถ | Waze | Google | WZDx (US) | **ฉลุย** |
|---|---|---|---|---|
| AI Compliance Gate (8 กฎ) | ❌ | ❌ | ❌ | ✅ |
| ไม่ผ่าน = เตือนมากขึ้น | ❌ | ❌ | ❌ | ✅ |
| Feedback → Re-audit | ❌ | ❌ | ❌ | ✅ |
| Closed Loop real-time | ❌ | ❌ | ❌ | ✅ |
| ทำงาน edge/offline | ❌ | ❌ | ❌ | ✅ |

**positioning:** "WZDx พิสูจน์ว่า open work-zone data ทำได้ → ฉลุยต่อยอดด้วย compliance + closed loop"

<span class="small">อ้างอิง: US DOT WZDx Spec (transportation.gov/av/data/wzdx)</span>

---

# 3 · Data & AI Approach (ภาพรวม)

**หลักการ: modelless + edge-first — คำนวณบน browser ไม่ต้องเทรน ไม่ต้อง GPU**

| โมดูล | ทำอะไร | เทคนิค |
|---|---|---|
| **Rule Engine** | ตรวจ 8 กฎ DOH deterministic | Constraint check + sigmoid severity |
| **KARC** | พยากรณ์ความเร็วสด | Chebyshev basis + Ridge Regression |
| **Hodge** | แยกรถติดคอขวด vs วนลูป | Discrete Exterior Calculus |
| **ย่านาง (AI)** | แชตไทยอ้างอิงข้อมูลจริง | ThaiLLM (typhoon) + grounding |
| **ActionBridge** | จัดอันดับเส้นทาง 0-100% | Sigmoid ranking |

---

# 3 · AI ที่กันการมั่ว (สำหรับกรรมการ LLM)

**ย่านาง = ThaiLLM ที่ถูกกำกับด้วย deterministic gate**

- LLM **ไม่ใช่ตัวตัดสิน** — เป็น "ล่าม" แปลผลจาก Rule Engine/KARC/Hodge เป็นภาษาไทย
- **Grounding:** ตอบได้เฉพาะตัวเลข/ถนนที่มีในบริบทจริง — ไม่มีข้อมูล = บอกตรงๆ
- **Fallback ฉลาด:** ThaiLLM ล่ม → ตอบจาก KARC/Hodge/data ต่อได้ ไม่ค้าง
- **Data sovereignty:** ข้อมูลไม่ออกนอกประเทศ (typhoon-s-8b)

<span class="small">3 ปัญหา LLM ที่แก้: hallucination · structured output · provenance</span>

<!--
Speaker note: จุดนี้คือ wow สำหรับกรรมการสาย LLM — โชว์ "AI จับ AI โกหก" ตอน demo ได้
-->

---

# 3 · Data Flow (Closed Loop)

```
CONTRACTOR          ADMIN                    TRAVELER
ส่งข้อมูล+รูป  ──►  AI ตรวจ 8 กฎ
                   ผ่าน ✅        ──────►   หมุดเขียว
                   ไม่ผ่าน ❌      ──────►   หมุดแดง + alert อันตราย
                   re-audit  ◄──────────   feedback ≥3 "ไม่มีกรวย"
KPI ลด  ◄──────────
```

**เชื่อมด้วย** BroadcastChannel (real-time cross-tab) + SHA-256 audit hash (tamper-evident)

---

# 4 · PoC Progress — 3 Roles ใช้ได้จริง

| Role | หน้า | ทำอะไรได้แล้ว |
|---|---|---|
| 🚗 Traveler | `/traveler` | แผนที่ + route + drive sim + alert 500ม. + ย่านาง chat |
| 🧑‍🔧 Contractor | `/contractor` | ฟอร์มส่งงาน + GPS + รูป + ส่งตรวจ |
| 🛡️ Admin | `/admin` | AI ตรวจ 8 กฎ + ระดับงาน 4 ระดับ + คิวอนุมัติ + KPI |

**สถานะ:** ใช้งานได้จริงบน browser (Astro 5 + Leaflet + OSM) — 15 โครงการตัวอย่าง

<span class="small">Stack: Astro (SSR) · Leaflet · OSRM · ThaiLLM API proxy · Vanilla CSS</span>

---

# 4 · Demo สั้น (Wow Moments)

1. **Admin** เลือกงาน → AI ตรวจ "❌ ไม่ผ่าน" → รายงาน 8 กฎ + score + audit hash
2. **Traveler** (อีก tab) → หมุดแดงกะพริบ **ทันที** (BroadcastChannel — ไม่ refresh!)
3. **Drive Simulation** → KARC พยากรณ์ความเร็ว real-time + alert 500ม.
4. **ถามย่านาง** "สุทธิสารติดปะ" → วิเคราะห์ Hodge (คอขวด/วนลูป) + แนะนำเลี่ยง
5. **Feedback ≥3** → zone ถูก flag re-audit อัตโนมัติ

<span class="small">แสดงระดับงาน: 🔴วิกฤต 4 · 🟠สูง 4 · 🟡ปานกลาง 5 · 🟢ทั่วไป 2</span>

<!--
Speaker note: เปิด 2 tab (admin + traveler) ค้างไว้ก่อนเริ่ม demo
-->

---

# 5 · Feasibility & Validation เบื้องต้น

**สิ่งที่พิสูจน์แล้ว (ของจริง):**
- Rule Engine deterministic — input เดิม ได้ผลเดิมทุกครั้ง (ตรวจสอบได้)
- KARC fit/forecast ทำงานสดบน browser (Ridge Regression closed-form)
- Hodge decomposition แยก 3 องค์ประกอบได้จริง
- ย่านาง ต่อ ThaiLLM API ผ่าน server proxy สำเร็จ (ตอบไทยจริง)

**ข้อจำกัดที่พูดตรงๆ (สำคัญต่อความน่าเชื่อถือ):**
- Vision-LLM ยังเป็น **mock 3 scenario** (Rule Engine ของจริง)
- ยังไม่มี benchmark accuracy กับ sensor จริง
- BroadcastChannel = same-device (production ใช้ WebSocket)

---

# 5 · เทคมีที่มา (อ้างอิงงานวิจัย)

| เทค | งานวิจัยรองรับ |
|---|---|
| KARC | Kolmogorov-Arnold Networks (arXiv:2404.19756, 2024) + Reservoir Computing |
| Hodge | Hodge Decomposition for Urban Traffic Flow (arXiv:2509.17203, 2025); Nature Sci.Rep. 2022 |
| Rule Engine | MUTCD Part 6 + UNESCAP Asian Highway Standards |
| WZDx | US DOT Work Zone Data Exchange Spec |

<span class="small">รายละเอียดเต็ม + คำถามโหด 12 ข้อ ดู APPENDIX_QA.md</span>

<!--
Speaker note: ชูว่าไม่ได้คิดเอง — ทุกเทคมี paper/มาตรฐานรองรับ
-->

---

# 6 · ทีม & Next Steps

**ทีม BDI BKK**
- _(ใส่ชื่อสมาชิก + บทบาท: Dev / Data / Design / Domain)_

**Roadmap ถ้าเข้ารอบต่อไป:**
1. ต่อ Vision-LLM จริง (Qwen2-VL / Gemini) → แทน mock
2. Backend จริง (WebSocket + PostgreSQL) → sync ข้าม device
3. เชื่อม sensor จริง (BMA loop detectors / TomTom) → วัด accuracy KARC
4. Calibrate 8 กฎ กับเจ้าหน้าที่ DOH จริง
5. Deploy production (Netlify/Cloudflare) + BLAKE3 audit chain

---

<!-- _class: lead -->
# Q&A

**เตรียมคำตอบ 12 คำถามโหดไว้แล้ว** → `APPENDIX_QA.md`

กฎ 8 ข้อ · Vision mock · KARC vs LSTM · Hodge จริงไหม · WZDx · ThaiLLM
BroadcastChannel · SHA-256 · accuracy · ActionBridge · 4 ระดับงาน · offline

**"ฉลุย เชื่อม 3 ฝ่ายด้วยข้อมูลชุดเดียว — ครบวงจร ไม่มีจุดหลุด"**

---

# Appendix · Reference (ย่อ)

<span class="small">

1. Liu et al., Kolmogorov-Arnold Networks, arXiv:2404.19756 (2024)
2. Hodge Decomposition for Urban Traffic Flow, arXiv:2509.17203 (2025)
3. Urban Spatial Structures via Hodge-Kodaira, Nature Sci.Rep. (2022)
4. US DOT, Work Zone Data Exchange (WZDx) Spec
5. WHO Thailand Road Safety Country Profile (2023)
6. UNESCAP Asian Highway Safety Standards (2018)
7. FHWA MUTCD Part 6 – Temporary Traffic Control
8. โค้ดฉลุย: karc.js · hodge.js · ai-auditor.js · script.js

</span>
