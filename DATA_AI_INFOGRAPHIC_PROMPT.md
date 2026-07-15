# Data & AI — Single-Page Infographic + Image Prompt

> รวมเนื้อหา Data & AI ทั้งหมดเป็น **หน้าเดียว** แบ่ง 7 partition
> ใช้สำหรับ generate รูปด้วย AI (Midjourney / DALL·E / Ideogram) หรือทำเองใน Figma/Canva

---

## ⚠️ ข้อควรรู้ก่อน generate
- โมเดลสร้างรูป **เขียนข้อความไทยเพี้ยน** — แนะนำ 2 ทาง:
  1. generate เฉพาะ **layout + visual** (ไอคอน/สี/กราฟ) แล้วพิมพ์ข้อความไทยทับเองใน Figma/Canva
  2. ใช้ **Ideogram** (จัดการ text ดีสุด) + ใช้ label ภาษาอังกฤษ
- Aspect ratio แนะนำ **16:9** (แทรกใน deck) หรือ **4:5** (โปสเตอร์)

---

## Layout Blueprint (7 partitions)

```
┌──────────────────────────────────────────────┐
│  HEADER: Data & AI in Chalui — modelless/edge │
├───────────────┬───────────────┬──────────────┤
│ P1 Rule Engine│ P2 KARC        │ P3 Hodge     │
├───────────────┴───────────────┴──────────────┤
│ P4 ย่านาง (ThaiLLM) │ P5 ActionBridge          │
├────────────────────────────────────────────── ┤
│ P6 Closed Loop (flow ครบวงจร)                  │
├──────────────────────────────────────────────┤
│ FOOTER: 0 model file · 4 signals · 100% verify│
└──────────────────────────────────────────────┘
```

---

## เนื้อหาในแต่ละ partition (ไว้พิมพ์ทับ)

**HEADER** — Data & AI in Chalui · 🧠 modelless · 📱 edge-first · runs in browser

**P1 · Rule Engine** 🛡️ (icon: shield + checklist)
- ตรวจ **8 กฎ DOH** (กรวย/ป้าย/ไฟ/แบริเออร์) · deterministic · Audit hash 🔒
- visual: รูป → 8 checkbox → score gauge 0-100

**P2 · KARC** 🔮 (icon: line chart / crystal ball)
- พยากรณ์ความเร็ว · **0 model file · <1ms · fit ทุก 2s**
- visual: จุดความเร็ว → เส้นโค้งทำนายพุ่งไปข้างหน้า

**P3 · Hodge** 📐 (icon: network graph)
- แยกชนิดรถติด: 🔴 คอขวด · 🟡 วนลูป · 🟢 ทางทะลุ
- visual: กราฟถนนแตกเป็น 3 flow สี

**P4 · ย่านาง** 💬 (icon: chat bubble + shield, purple)
- ThaiLLM + **Grounding Gate** (ห้ามมั่ว) · fallback ได้ · ล่าม ไม่ใช่ผู้ตัดสิน

**P5 · ActionBridge** 🎯 (icon: gauge/ranking)
- จัดอันดับเส้นทาง 0-100% (sigmoid)

**P6 · Closed Loop** 🔄
- ผู้รับเหมา → AI ตรวจ → ผู้ขับขี่เห็น → feedback ≥3 → re-audit

**FOOTER** — 0 model file · 4 signals fused · 100% verifiable + audit hash

---

## 🎨 MASTER PROMPT (ทั้งหน้า — layout + visual)

> ใช้กับ Midjourney / DALL·E 3 / Ideogram · แนะนำ generate visual ก่อน แล้วพิมพ์ข้อความทับ

```
A clean modern tech infographic poster, 16:9, dark navy background (#0b1120)
with teal-mint (#2dd4bf) and amber (#fbbf24) accents. Flat vector style,
soft rounded cards with subtle glow, thin line icons, generous spacing,
minimal text. Title bar at top. Below it a grid of 6 content cards arranged
in 3 columns on top row and 2 wide cards on second row, then one full-width
horizontal flow diagram near the bottom, and a slim stats footer.
Card 1: a shield with an 8-item checklist and a circular score gauge.
Card 2: a rising line chart / forecast curve with data dots (crystal-ball motif).
Card 3: a road network graph splitting into three colored flows (red, yellow, green).
Card 4: a purple chat bubble wrapped by a shield (guarded AI assistant).
Card 5: a speedometer / ranking gauge showing a percentage.
Bottom: a circular closed-loop flow diagram with 4 nodes and arrows.
Footer: three large bold numbers as stat highlights.
Professional government-tech aesthetic, high contrast, presentation slide,
crisp, uncluttered, no photorealism. --ar 16:9
```

---

## 🧩 PER-PARTITION PROMPTS (generate แยกทีละส่วน แล้วประกอบ)

**P1 · Rule Engine**
```
Flat vector icon card, dark navy bg, teal accent: a shield containing a
checklist of 8 ticked items, next to a circular progress gauge showing a
score. Clean, minimal, thin lines, soft glow. --ar 1:1
```

**P2 · KARC forecast**
```
Flat vector icon card, dark navy bg, teal accent: a line chart with scattered
speed data dots on the left transitioning into a smooth predicted curve
arrow pointing forward/right. Crystal-ball / forecasting motif. Minimal. --ar 1:1
```

**P3 · Hodge decomposition**
```
Flat vector icon card, dark navy bg: an abstract road-network node graph that
splits into three separate colored flow streams — red (bottleneck), yellow
(loop/circular), green (smooth transit). Topological, elegant, minimal. --ar 1:1
```

**P4 · ย่านาง (guarded AI)**
```
Flat vector icon card, dark navy bg, purple accent: a friendly chat speech
bubble protected by a shield outline, with small data-node connections
feeding into it. Represents a grounded, trustworthy AI assistant. --ar 1:1
```

**P5 · ActionBridge**
```
Flat vector icon card, dark navy bg, amber accent: a speedometer / gauge dial
pointing to a high percentage, with route lines ranked below. Minimal. --ar 1:1
```

**P6 · Closed Loop**
```
Flat vector horizontal flow diagram, dark navy bg, teal arrows: 4 connected
nodes in a cycle — worker/contractor, AI inspection shield, driver/map pin,
citizen feedback megaphone — arrows forming a continuous loop. Minimal. --ar 21:9
```

---

## 🚫 NEGATIVE PROMPT (ใส่ในช่อง negative ถ้า tool รองรับ)
```
photorealistic, 3d render, cluttered, busy, gibberish text, distorted text,
watermark, low contrast, dark muddy colors, realistic photo, human faces,
stock photo, noisy background, too many colors
```

---

## 🅰️ ถ้าต้องการข้อความในภาพ (ใช้ Ideogram — English labels)
ใช้ MASTER PROMPT ด้านบน แล้วเติมท้าย:
```
Include short English labels on each card: "RULE ENGINE", "KARC FORECAST",
"HODGE FLOW", "YANANG AI", "ACTIONBRIDGE", "CLOSED LOOP", and a title
"DATA & AI IN CHALUI". Bold clean sans-serif, correctly spelled.
```
> แล้วค่อยแปล/แทนเป็นข้อความไทยทีหลังใน Figma/Canva ตามหัวข้อใน "เนื้อหาแต่ละ partition"

---

## ✅ Workflow แนะนำ (ให้คุมผลลัพธ์ได้)
1. Generate **6 ไอคอนการ์ด** (P1–P6) แยกทีละใบด้วย per-partition prompt → ได้ visual สะอาด
2. วาง grid ใน **Figma/Canva** ตาม Layout Blueprint
3. พิมพ์ **ข้อความไทย** ทับตาม "เนื้อหาแต่ละ partition" (ฟอนต์ Sarabun)
4. ใส่ palette: bg `#0b1120`, teal `#2dd4bf`, amber `#fbbf24`, purple `#a78bfa`
5. Export เป็น PNG/SVG แทรกใน pitch deck

**Palette reference:** พื้นหลังกรมท่าเข้ม · เขียวมิ้นต์ (คณิต) · ม่วง (AI) · เหลืองอำพัน (เน้น)
