# Appendix: คำถาม-คำตอบเชิงลึก (Q&A for Judges)

> **DOH Hackathon 2026** | ทีม BDI BKK | แอป **ฉลุย (Chalui)**
> เอกสารนี้เตรียมไว้สำหรับคำถามจากกรรมการในทุกมิติ: กฎหมาย, เทค, ตัวเลข, ข้อจำกัด
> ทุกคำตอบมีแหล่งอ้างอิง (ดู Reference List ด้านล่าง)

---

## Q1: "8 กฎ DOH มาจากไหน ใครกำหนด มีกฎหมายรองรับจริงหรือเปล่า?"

**คำตอบ:**
กฎ 8 ข้อสังเคราะห์จาก 3 แหล่ง:

- **คู่มือการเตือนจราจรในเขตก่อสร้างของกรมทางหลวง** (ทช. ทล.) — กรวยเว้นระยะ ≤5 ม., ป้ายเตือนล่วงหน้า ≥50 ม., ไฟกะพริบยามค่ำคืน
- **MUTCD Part 6 – Temporary Traffic Control** ของ FHWA สหรัฐ ซึ่ง DOH Thailand ใช้เป็น reference [Ref 14]
- **Asian Highway Design Standard** ของ UNESCAP ที่ไทยเป็นสมาชิก [Ref 1]

ใน POC จำลองเป็น 6 กฎ baseline (`DOH-BASE-001` ถึง `006`) + 2 กฎ permit-specific เข้มขึ้นสำหรับทางโค้ง (`PERMIT-042-001/002`)

**⚠️ ข้อจำกัดที่ต้องพูดตรงๆ:** กฎเหล่านี้เป็น representation ที่สมเหตุสมผลตาม reference — ยังไม่ใช่กฎที่ประกาศราชกิจจาอย่างเป็นทางการ ใน production ต้อง calibrate กับเจ้าหน้าที่ DOH จริง

**อ้างอิง:** [1], [2], [3], [14]

---

## Q2: "Vision-LLM เป็น mock — แล้วจะบอกว่า AI ตรวจจริงได้ยังไง?"

**คำตอบ:**
ใน POC ใช้ mock fixtures 3 scenario (**ต้องพูดตรงๆ**) แต่สถาปัตยกรรมป้องกันปัญหา "ถ่ายมุมสวย" 4 ชั้น:

1. **Rule Engine เป็น deterministic** — ไม่ว่า vision model ใดส่งผลตรวจจับมา ถ้าจำนวน/ระยะห่างกรวยไม่ผ่านก็ไม่ผ่าน (ไม่ใช่ LLM ตัดสิน)
2. **Multi-signal fusion** — ภาพคือ 1 ใน 4 สัญญาณ (ภาพ + feedback ประชาชน + KARC speed anomaly + admin override) ถึงถ่ายมุมสวย ≥3 feedback จากคนจริงก็ trigger re-audit
3. **Human-in-the-loop** — AI เสนอ verdict เท่านั้น admin ยืนยันหรือ override ทุกครั้ง ระบบเก็บสถิติ AI ถูก/ผิด (`getAiAccuracyStats()`)
4. **Tamper-evident hash** — ทุกรายงานมี SHA-256 hash ปลอมแปลงย้อนหลังไม่ได้

**Production path:** ต่อ Qwen2-VL หรือ Gemini Vision API → ส่ง structured detection → ป้อนเข้า Rule Engine เดิม

**อ้างอิง:** [15] โค้ดจริง `ai-auditor.js`

---

## Q3: "KARC คืออะไร มีงานวิจัยรองรับไหม ทำไมไม่ใช้ LSTM?"

**คำตอบ:**
**KARC = Kolmogorov-Arnold Reservoir Computing** — ผสม 2 หลักการ:
- **Kolmogorov-Arnold Representation Theorem** (1957) — ฟังก์ชันต่อเนื่องทุกตัวแทนด้วยผลรวมของฟังก์ชันตัวแปรเดียวได้ เราใช้ Chebyshev polynomials เป็น univariate basis [Ref 6]
- **Reservoir Computing** — Echo State Networks ที่ train แค่ output layer ด้วย Ridge Regression แบบ closed-form [Ref 7]

**เปรียบเทียบ LSTM vs KARC:**

| | LSTM | KARC |
|---|---|---|
| Training | GPU + epochs | Closed-form: solve `(HᵀH+λI)W = HᵀY` ทีเดียวจบ |
| Runtime | ต้องมี model file | ไม่มี model file (weights คำนวณสด) |
| ขนาด | MB ขึ้นไป | 0 bytes (runtime computation) |
| Deploy | ต้องมี server | **รันบน browser ล้วน** |
| Latency | ms per inference | <1ms (zero-alloc dot product K×M=16) |

**จุดขาย:** ไม่ต้องเทรนล่วงหน้า ไม่ต้อง model file ไม่ต้อง GPU — learn สดจากข้อมูลความเร็วระหว่างขับ fit ใหม่ทุก 2 วินาที

**อ้างอิง:** [6], [7], [8], [15] โค้ด `karc.js`

---

## Q4: "Hodge Decomposition มีคนใช้กับ traffic จริงๆ หรือเป็น buzzword?"

**คำตอบ:**
มีงานวิจัยตรงๆ:
- **"Hodge Decomposition for Urban Traffic Flow"** (arXiv 2025) — วิเคราะห์ flow บนกราฟถนนเมือง [Ref 8]
- **"Urban Spatial Structures from Human Flow by Hodge-Kodaira Decomposition"** (Nature Scientific Reports, 2022) — commuting flow ในเมืองจริง [Ref 9]

หลักการในฉลุย:
```
Traffic Flow = Exact (คอขวด/gradient) + Coexact (รถวนลูป) + Harmonic (ทางทะลุ)
```
- **Exact** = ความดันจราจรจากจุดก่อสร้าง (มีต้น-ปลาย)
- **Coexact** = รถวนหาทางเลี่ยงในซอย (ไม่ไปไหน) → ยิ่งสูง = ยิ่ง penalty เส้นทาง
- **Harmonic** = กระแสหลักที่ไหลผ่านได้ → แนะนำให้ใช้ทาง harmonic

**ต่างจาก Waze/Google:** เขาใช้ edge weight แบบ flat (ระยะทาง+เวลา) — เราแยก "ติดแบบคอขวด" กับ "ติดแบบวน" ออกจากกันได้

**อ้างอิง:** [8], [9], [10], [15] โค้ด `hodge.js`

---

## Q5: "WZDx (สหรัฐ) มีอยู่แล้ว — ต่างกันตรงไหน?"

**คำตอบ:**
WZDx = **data format specification** ของ US DOT ให้หน่วยงานรัฐ publish ข้อมูล work zone เป็น GeoJSON — แต่แค่ publish **ไม่มี compliance enforcement**

| | WZDx (US) | ฉลุย |
|---|---|---|
| ใครส่งข้อมูล | หน่วยงานรัฐเท่านั้น | ผู้รับเหมา + รัฐ + ประชาชน |
| ตรวจมาตรฐาน | ❌ ไม่มี | ✅ AI Rule Engine 8 กฎ |
| ไม่ผ่าน → ? | ❌ ไม่มีกลไก | เตือนผู้ขับขี่ + ส่ง ทล. ลงตรวจ + KPI ลด |
| Feedback loop | ❌ ไม่มี | ≥3 report = re-audit อัตโนมัติ |
| AI/ML | ❌ ไม่มี | KARC + Hodge + NLU (ย่านาง) |

**positioning:** "WZDx พิสูจน์ว่า open work zone data เป็นไปได้ → ฉลุยต่อยอดด้วย compliance gate + closed loop"

**อ้างอิง:** [4], [5]

---

## Q6: "ทำไมต้อง ThaiLLM ใช้ GPT/Gemini ไม่ได้เหรอ?"

**คำตอบ:**
ใช้ได้ (ระบบมี Gemini fallback อยู่) แต่เลือก ThaiLLM เพราะ:

1. **Data sovereignty** — API endpoint ในประเทศ ไม่ส่งข้อมูลจราจร/ตำแหน่งผู้ใช้ไปต่างประเทศ
2. **ภาษาไทย** — โมเดล `typhoon-s-8b` เทรนบน corpus ไทยจริง เข้าใจชื่อถนน/แยก/ซอยได้ดี
3. **โครงสร้างพื้นฐานดิจิทัลของรัฐ** — ตรงกับธีม DOH Hackathon (รัฐ + เทคไทย)
4. **ต้นทุนต่ำ** — GPT-4o ≈ $5-15/1M tok, typhoon-s-8b ฟรี/ถูกมากสำหรับ POC

**สำคัญ:** LLM ไม่ใช่ตัวตัดสิน — เป็นแค่ "ล่าม" (Rule Engine ตัดสิน deterministic) ถ้า ThaiLLM ล่ม → local fallback (KARC/Hodge/data) ตอบได้เลยไม่ค้าง

---

## Q7: "BroadcastChannel ใช้ได้แค่บน browser เดียวกัน ถ้าหลาย device ทำไง?"

**คำตอบ:**
ถูกต้อง — BroadcastChannel ทำงานแค่ same-origin same-device (cross-tab) ใน POC จำลอง Closed Loop เพื่อ demo real-time sync โดยไม่ต้องมี backend

**Production path (Round 2):**
- เปลี่ยนเป็น **WebSocket** หรือ **Server-Sent Events (SSE)** → push update จาก server ไปทุก client
- DB: PostgreSQL + `LISTEN/NOTIFY` หรือ Redis pub/sub
- BroadcastChannel ยังเก็บไว้เป็น local-optimistic update (แสดงผลทันทีก่อน server confirm — UX pattern เดียวกับ Figma)

**อ้างอิง:** [12]

---

## Q8: "SHA-256 ไม่ใช่ blockchain — จะป้องกันปลอมแปลงจริงๆ ได้ยังไง?"

**คำตอบ:**
ไม่ใช่ blockchain — SHA-256 hash ใน POC เป็น **tamper-evident** (รู้ว่าถูกแก้) ไม่ใช่ **tamper-proof** (ป้องกันแก้) ตัวเดียว

ป้องกันจริงต้อง:
1. **Append-only log** — hash ของรายงาน N รวม hash ของ N-1 (Merkle chain)
2. **Third-party anchor** — hash root publish ไปที่ public ledger / timestamping authority
3. **Production:** ใช้ BLAKE3 (เร็วกว่า SHA-256 3× + tree-hash mode สำหรับ Merkle)

**ใน POC:** SHA-256 เพียงพอสำหรับ demo — แก้ report 1 ตัวอักษร hash เปลี่ยนทั้ง string (สาธิตสดได้)

**อ้างอิง:** [11]

---

## Q9: "ตัวเลข accuracy ของ KARC เท่าไหร่ มี benchmark ไหม?"

**คำตอบ:**
**ใน POC ไม่มี benchmark accuracy กับ ground truth จริง** (ไม่มีข้อมูลความเร็วจริงจาก sensor) — ต้องพูดตรงๆ

แต่สิ่งที่พิสูจน์ได้สดหน้ากรรมการ:
- กด Drive → KARC observe 12+ จุด → `fit()` → `forecast()` ให้ค่าที่ converge ใกล้ pattern ของ input
- Ridge Regression มี theoretical guarantee: minimizes `‖Hw − y‖² + λ‖w‖²` — closed-form optimal สำหรับ linear model

**Production (Roadmap):**
- ต่อ real sensor data (loop detectors ของ BMA / TomTom Speed API)
- วัด MAE/RMSE เทียบ persistence baseline
- RC ทั่วไปบน traffic ให้ MAE ~3-5 km/h สำหรับ 5-min forecast (literature)

**อ้างอิง:** [7], [15] โค้ด `karc.js → solveRidge()`

---

## Q10: "ActionBridge Sigmoid คืออะไร มีที่มาจากไหน?"

**คำตอบ:**
Route ranking function ที่แปลงคะแนนดิบเป็นค่าความน่าเชื่อถือ 0-100%:

```
ActionBridge(route) = 1 / (1 + e^(-utility/scale))
utility = −(total_delay + KARC_penalty + Hodge_penalty)
scale = 25
```

**ที่มา:** Boltzmann/softmax policy ในทฤษฎี decision making — sigmoid คือ special case ของ softmax สำหรับ binary choice ใช้ในงาน reward shaping ของ RL ทั่วไป

**ผลลัพธ์:** route delay น้อย → score ใกล้ 100%, delay สูง → score ต่ำ ผู้ใช้เห็นเป็น % เข้าใจง่ายทันที

---

## Q11: "ทำไม 4 ระดับงาน ไม่ใช่ 3 หรือ 5?"
