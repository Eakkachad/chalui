# Data & AI Specification — ฉลุย (Chalui)

> รายละเอียด Data Models + AI/Math Modules ทั้งหมดในระบบ
> อ้างอิงจากโค้ดจริงใน `gps-astro/public/js/` (ระบุไฟล์+ฟังก์ชันทุกส่วน)

---

# PART A — DATA MODELS

## A1. Project (Construction Zone)
แหล่ง: `script.js` (client) + `src/pages/api/projects.js` (server) — 15 โครงการตัวอย่าง

**ฟิลด์ตั้งต้น (จากผู้รับเหมา/ระบบ):**
| ฟิลด์ | ชนิด | ตัวอย่าง | ความหมาย |
|---|---|---|---|
| `id` | number | `1` | รหัสโครงการ |
| `name` | string | `"Bangkok Pink Line Extension"` | ชื่องาน |
| `province` | string | `"Bangkok"` | จังหวัด |
| `contractor` | string | `"Siam Infra JV"` | ผู้รับเหมา |
| `status` | enum | `in-progress` \| `delayed` \| `planned` \| `completed` | สถานะงาน |
| `workLevel` | enum | `critical`\|`high`\|`medium`\|`routine` | ระดับงาน (ความเข้มตรวจ) |
| `start` / `end` | ISO date | `"2026-01-15"` | ช่วงงาน |
| `lat` / `lng` | number | `13.8952 / 100.5792` | พิกัด GPS |
| `roadName` | string | `"Chaeng Watthana Road"` | ถนน |
| `radiusKm` | number | `0.42` | รัศมีพื้นที่งาน |

**ฟิลด์ที่ระบบเติมตอน runtime (จาก AI audit + admin + closed loop):**
| ฟิลด์ | ชนิด | ความหมาย |
|---|---|---|
| `aiVerdict` | `pass`\|`fail` | ผล AI เสนอ (ไม่ถูกเขียนทับ) |
| `aiConfidence` | 0-100 | ความมั่นใจ AI |
| `aiScore` / `complianceScore` | 0-100 | คะแนนตรวจ |
| `complianceReportId` | string | `CR-xxxxxxxx` |
| `complianceVerdict` | `pass`\|`fail` | ผลปัจจุบัน |
| `adminDecision` | `pending`\|`confirmed`\|`overridden` | สถานะ human-in-loop |
| `verified` | bool | admin ยืนยันแล้วหรือยัง |
| `aiWasWrong` | bool | AI ผิดไหม (track accuracy) |
| `isDangerous` | bool | ไม่ผ่าน = เตือนอันตราย |
| `needsDohInspection` | bool | flag ส่ง ทล.ลงตรวจ |
| `needsReaudit` | bool | flag re-audit (จาก feedback ≥3) |
| `publishedToDrivers` | bool | แสดงบนแผนที่ผู้ขับขี่ |

โค้ด: `ai-auditor.js → applyComplianceVerdict()`, `adminConfirmVerdict()`, `adminOverrideVerdict()`

---

## A2. Work Level (ระดับงาน 4 ระดับ)
แหล่ง: `script.js → WORK_LEVEL_META`

| level | code | label | ความเข้มตรวจ | ตัวอย่าง |
|---|---|---|---|---|
| `critical` | ระดับ 1 | วิกฤต 🔴 | Permit strict | ทางด่วน/สะพาน/ทางแยกใหญ่ |
| `high` | ระดับ 2 | สูง 🟠 | 8 กฎเต็ม | ถนนสายหลัก ปิดช่องจราจร |
| `medium` | ระดับ 3 | ปานกลาง 🟡 | Baseline | ผิวทาง/ระบายน้ำ ถนนรอง |
| `routine` | ระดับ 4 | ทั่วไป 🟢 | ตรวจพื้นฐาน | ทางเท้า/ป้าย งานเล็ก |

**การกระจาย (15 โครงการ):** critical 4 · high 4 · medium 5 · routine 2

---

## A3. SceneDetection (Input ของ Rule Engine — Vision mock)
แหล่ง: `ai-auditor.js → MOCK_DETECTIONS` (3 scenario: pass / fail / critical)

```json
{
  "detectedObjects": [
    { "objectType": "traffic_cone", "count": 12,
      "positionsM": [0, 2.5, 5, ...], "confidence": 0.94 },
    { "objectType": "warning_sign", "count": 2,
      "positionsM": [-60, -45], "confidence": 0.91 }
  ],
  "capturedAt": "2026-07-09T...",
  "sceneConfidence": 0.93
}
```
objectType: `traffic_cone` · `warning_sign` · `barrier` · `speed_limit_sign` · `flashing_light`

**หมายเหตุ:** ใน POC เป็น mock — production ต่อ Qwen2-VL/Gemini Vision ส่ง schema เดียวกัน

---

## A4. 8 กฎ DOH (Compliance Rules)
แหล่ง: `ai-auditor.js → BASELINE_RULES (6) + PERMIT_RULES (2)`

| Rule ID | หมวด | เงื่อนไข | severity |
|---|---|---|---|
| DOH-BASE-001 | TrafficDevices | กรวยเว้นระยะ ≤ 5 ม. | moderate |
| DOH-BASE-002 | SignageWarning | ป้ายเตือน ≤ 50 ม.ก่อนถึง | critical |
| DOH-BASE-003 | Lighting | ไฟกะพริบ ≥ 2 จุด (กลางคืน) | critical |
| DOH-BASE-004 | TrafficDevices | แบริเออร์ ≥ 1 | moderate |
| DOH-BASE-005 | SignageWarning | ป้ายจำกัดความเร็ว ≥ 1 | moderate |
| DOH-BASE-006 | PPE | คนงานใส่เสื้อสะท้อนแสง | warning |
| PERMIT-042-001 | TrafficDevices | กรวยเว้นระยะ ≤ 3 ม. (ทางโค้ง) | critical |
| PERMIT-042-002 | Lighting | ไฟกะพริบ ≥ 4 จุด (ทางโค้ง) | critical |

condition type: `MaxSpacing` · `MinObjectCount` · `RequiredWithinDistance` · `Custom`

---

## A5. ComplianceReport (Output ของ Rule Engine)
แหล่ง: `ai-auditor.js → runComplianceAudit()`

```json
{
  "reportId": "CR-a1b2c3d4",
  "overallStatus": "pass | pass_with_warnings | fail | critical_fail",
  "overallScore": 0-100,
  "aiConfidence": 0-100,
  "ruleResults": [ { "ruleId", "passed", "actualValue",
                     "requiredValue", "severity", "recommendation",
                     "rejectConfidence" } ],
  "recommendations": [ "..." ],
  "reportHash": "SHA-256 hex",
  "inspectedAt": "ISO",
  "detectedObjects": [ ... ]
}
```

## A6. Citizen Report
แหล่ง: `src/pages/api/reports.js` + `feedback.js`
`{ type, reporterName, title, description, lat, lng, timestamp, image, status }`
type: `Construction`·`Road Damage`·`Accident`·`Traffic`·`Other`

## A7. Feedback (Compliance signal)
แหล่ง: `feedback.js → PROBLEM_TYPES`
`{ problemType, zoneId, lat, lng, description, status: pending|resolved }`
problemType: `no_cones`·`no_sign`·`data_mismatch`·`heavy_traffic`·`other`
- Rate limit: 5 ครั้ง/10 นาที/session · desc ≤ 500 ตัวอักษร
- ผูก zone ใกล้สุด (`findNearestZone`) · ≥3 ประเภทเดียว → `needsReaudit`

## A8. Alert (Proximity)
แหล่ง: `alerts.js → triggerAlert()`
`{ zoneId, projectName, roadName, closedLanes, speedLimit, distanceM, triggeredAt, isDangerous }`
- รัศมี 500 ม. · suppress 5 นาที · แสดง 6 วินาที

## A9. Hodge Network (mock road graph)
แหล่ง: `hodge.js → HodgeDecomposition`
- **8 nodes** (แยกจริง กทม.): ห้าแยกลาดพร้าว, รัชโยธิน, สุทธิสาร, สะพานควาย, วิภาวดี-สุทธิสาร, รัชดา-ลาดพร้าว, เกษตร, อนุสาวรีย์ชัย
- **12 edges** (ถนน directed): พหลโยธิน, รัชดาภิเษก, สุทธิสารวินิจฉัย, วิภาวดีรังสิต ฯลฯ
- **2 faces** (loop): ห่วงรัชดา-สุทธิสาร-วิภาวดี, ห่วงลาดพร้าว-รัชดา-วิภาวดี

## A10. KPI ผู้รับเหมา
แหล่ง: `admin.js → renderAdminKpi()`
```
score = max(0, 100 − (failed × 15) − (feedback × 5))
เกรด: ≥80 🟢ดี · ≥60 🟡พอใช้ · <60 🔴ต้องปรับปรุง
```
รวมต่อผู้รับเหมา: จำนวนโครงการ, ผ่าน, ไม่ผ่าน, feedback

---

# PART B — AI / MATH MODULES

## B1. Rule Engine (AI Compliance Auditor)
ไฟล์: `ai-auditor.js`

**Pipeline:** SceneDetection → `evaluateSingleRule()` ต่อกฎ → รวมคะแนน → verdict → SHA-256 hash

**การให้คะแนน:**
- เริ่ม 100 หัก severity: `warning −5` · `moderate −15` · `critical −35`
- verdict: ไม่มี fail=`pass` · warning=`pass_with_warnings` · moderate=`fail` · critical=`critical_fail`
- confidence threshold ตรวจจับ ≥ 0.50 จึงนับ

**reject confidence (sigmoid, สำหรับ MaxSpacing):**
```
rejectConfidence = min(1, 1 − 1 / (spacing / maxSpacing))
```
**aiConfidence** = (sceneConfidence×0.5 + decisiveness×0.5)×100, decisiveness = |score−50|/50

deterministic → input เดิม ผลเดิมทุกครั้ง (ตรวจสอบได้)

---

## B2. KARC — Kolmogorov-Arnold Reservoir Computing
ไฟล์: `karc.js → class KarcForecaster` · พารามิเตอร์: `K=4, M=4, λ=1e-4`

**ขั้นตอน:**
1. `observe(zoneId, speed)` — ring buffer เก็บความเร็วล่าสุด K=4 ค่า/โซน
2. `evaluateBasis(x)` — Chebyshev recurrence `T₀=1, T₁=x, Tₙ=2x·Tₙ₋₁−Tₙ₋₂` (normalize x→[-1,1])
3. `expandFeatures()` — กาง K×M = 16 มิติ
4. `solveRidge(H,Y)` — closed-form `(HᵀHᵀ+λI)W = HᵀY` ด้วย Gaussian elimination + partial pivoting
5. `fit(zoneId)` — ต้องมี history ≥ 5 ตัวอย่าง
6. `forecast(zoneId)` — dot product `W·features` clamp [10,120] km/h

**จุดขาย:** ไม่มี model file · ไม่ backprop · <1ms · fit ใหม่ทุก ~2 วิ ระหว่าง drive
**การใช้:** popup marker, drive readout, ย่านาง chat, route penalty

---

## B3. Hodge Decomposition (DEC)
ไฟล์: `hodge.js → decomposeFlow(edgeFlows)`

```
Flow = Exact (คอขวด) + Coexact (วนลูป) + Harmonic (ทางผ่าน)
```
1. Exact: solve `d0ᵀd0·φ = d0ᵀw` (Laplacian บน node, ตรึง node0=0) → `w_exact = d0·φ`
2. Coexact: solve `d1d1ᵀ·ψ = d1w` (Laplacian บน face) → `w_coexact = d1ᵀ·ψ`
3. Harmonic = `w − w_exact − w_coexact`
- linear solver: Jacobi iteration (maxIter 100, tol 1e-6)
- edge flow input: base 5.0 + งาน delayed +35 / in-progress +18

**routing:** `getHodgeAdjustedCost()` — coexact > 10 → penalty `×1.5` (ดัน user เลี่ยงลูป)

---

## B4. ย่านาง — Thai LLM Advisor
ไฟล์: `script.js → triggerThaiLLMQuery()` + `src/pages/api/chat.js` (server proxy)

**Pipeline 3 ชั้น:**
1. **ThaiLLM API** (หลัก) — เรียก `/api/chat` (same-origin) → server proxy ไป `typhoon-s-thaillm-8b-instruct` (แก้ CORS + ซ่อน key)
2. **Gemini fallback** — ถ้ามี `window.GEMINI_API_KEY`
3. **localSmartAnswer** (offline) — entity matching + KARC/Hodge จริง

**Context (grounding) — `buildTrafficContext()`:** โครงการทั้งหมด + KARC forecast จริง + Hodge snapshot + route + ระดับงาน

**กันมั่ว (system prompt):** ใช้เฉพาะตัวเลข/ถนนในบริบท · ไม่มีข้อมูล = บอกตรงๆ · temp 0.4

**helper:** `karcForecastFor()` (warm-up), `computeHodgeSnapshot()`, `findProjectByText()`

---

## B5. ActionBridge — Sigmoid Route Ranking
ไฟล์: `script.js → scoreRoute()`
```
utility = −(delay + KARC_penalty + Hodge_penalty)
ActionBridge = 1 / (1 + e^(−utility/25))   → 0-100%
```
KARC penalty = เวลาต่างจากพยากรณ์ + 5 นาที · Hodge penalty = coexact ใกล้เส้นทาง

## B6. Proximity Alert
ไฟล์: `alerts.js` — Haversine distance, รัศมี 500 ม., เฉพาะ zone ที่ published
`isZonePublished()`: completed / fail (เตือน!) / publishedToDrivers → แสดง

## B7. Integrity & Sync
- **Audit hash:** `computeAuditHash()` — SHA-256 ของ ruleResults (production: BLAKE3)
- **Cross-tab sync:** BroadcastChannel `"gps-compliance-sync"` → admin ↔ traveler real-time
- **Persistence:** localStorage `gpsComplianceState`

---

## สรุปหลักการ
**modelless + edge-first** — Rule Engine / KARC / Hodge / ActionBridge คำนวณบน browser ล้วน ไม่เทรน ไม่ GPU ไม่มี model file · LLM เป็น "ล่าม" ไม่ใช่ "ผู้ตัดสิน"
