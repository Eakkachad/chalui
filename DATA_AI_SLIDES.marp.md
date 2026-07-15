---
marp: true
theme: default
paginate: true
size: 16:9
style: |
  section { font-family: 'Sarabun','Segoe UI',sans-serif; font-size: 28px; background: #0b1120; color: #e2e8f0; }
  h1 { color: #2dd4bf; font-size: 46px; }
  h2 { color: #5eead4; }
  strong { color: #fbbf24; }
  .row { display:flex; gap:20px; justify-content:center; align-items:stretch; }
  .card { background:#1e293b; border-radius:18px; padding:22px; flex:1; border-top:5px solid #2dd4bf; }
  .big { font-size:64px; font-weight:800; color:#2dd4bf; line-height:1; }
  .muted { color:#94a3b8; font-size:20px; }
  .pill { display:inline-block; background:#334155; border-radius:999px; padding:4px 16px; margin:4px; font-size:22px; }
  .flow { font-size:30px; text-align:center; line-height:1.7; }
  section.lead { text-align:center; }
  section.divider { background:linear-gradient(135deg,#0f766e,#0b1120); }
---

<!-- _class: lead divider -->
# Data & AI ใน **ฉลุย**

## คณิตศาสตร์ระดับ research ที่รันบนมือถือ

<span class="pill">🧠 modelless</span> <span class="pill">📱 edge-first</span> <span class="pill">🚫 ไม่ต้องเทรน</span> <span class="pill">🚫 ไม่ต้อง GPU</span>

<!--
พูด: ทุกอย่างที่จะเห็นต่อไปนี้ คำนวณบน browser ล้วนๆ ไม่มี model file ไม่มี server GPU
นี่คือหัวใจ — AI ที่รันได้ทุกที่ แม้ offline
-->

---

# 5 เครื่องยนต์ AI

<div class="row">
<div class="card">🛡️<br><strong>Rule Engine</strong><br><span class="muted">ตรวจ 8 กฎ<br>deterministic</span></div>
<div class="card">🔮<br><strong>KARC</strong><br><span class="muted">พยากรณ์<br>ความเร็ว</span></div>
<div class="card">📐<br><strong>Hodge</strong><br><span class="muted">แยกชนิด<br>รถติด</span></div>
</div>
<br>
<div class="row">
<div class="card" style="border-top-color:#a78bfa">💬<br><strong>ย่านาง</strong><br><span class="muted">ThaiLLM<br>อ้างอิงข้อมูลจริง</span></div>
<div class="card" style="border-top-color:#a78bfa">🎯<br><strong>ActionBridge</strong><br><span class="muted">จัดอันดับ<br>เส้นทาง</span></div>
</div>

<!--
พูด: 5 ตัวนี้ทำงานร่วมกัน — 3 ตัวแรกเป็นคณิตศาสตร์ล้วน (เขียว), 2 ตัวหลังเป็น AI ที่คุยได้ (ม่วง)
ไล่ให้ดูทีละตัวครับ
-->

---

<!-- _class: divider -->
# 🛡️ Rule Engine

<div class="flow">
📷 รูปหน้างาน &nbsp;→&nbsp; 🔍 <strong>ตรวจ 8 กฎ</strong> &nbsp;→&nbsp; 📊 คะแนน 0–100
</div>
<br>
<div class="row">
<div class="card"><div class="big">8</div><span class="muted">กฎ DOH<br>(กรวย/ป้าย/ไฟ/แบริเออร์)</span></div>
<div class="card"><div class="big">100%</div><span class="muted">deterministic<br>input เดิม = ผลเดิม</span></div>
<div class="card"><div class="big">🔒</div><span class="muted">Audit hash<br>ปลอมไม่ได้</span></div>
</div>

<!--
พูด: หัวใจ compliance — ไม่ใช่ LLM เดา แต่เป็นกฎตายตัว กรวยห่างเกิน 5 เมตร = ไม่ผ่าน จบ
ตรวจสอบได้ทุกบรรทัด + มี hash กันแก้ย้อนหลัง
severity: critical −35, moderate −15, warning −5
-->

---

<!-- _class: divider -->
# 🔮 KARC — พยากรณ์ความเร็ว

<div class="flow">
🚗 ความเร็วสด &nbsp;→&nbsp; 📈 Chebyshev basis &nbsp;→&nbsp; ⚡ ทำนายข้างหน้า
</div>
<br>
<div class="row">
<div class="card"><div class="big">0</div><span class="muted">model file<br>(คำนวณสด)</span></div>
<div class="card"><div class="big">&lt;1ms</div><span class="muted">ต่อการพยากรณ์</span></div>
<div class="card"><div class="big">~2s</div><span class="muted">fit ใหม่<br>ระหว่างขับ</span></div>
</div>

<span class="muted">Kolmogorov-Arnold + Reservoir Computing · Ridge Regression closed-form</span>

<!--
พูด: แทน LSTM ที่ต้องเทรน+GPU — KARC เรียนรู้สดจากความเร็วขณะขับ แก้สมการทีเดียวจบ
ไม่มี model file เลย ทำนายว่าถึงโซนก่อสร้างจะวิ่งได้กี่ กม./ชม.
อ้างอิง: Kolmogorov-Arnold Networks (arXiv 2024)
-->

---

<!-- _class: divider -->
# 📐 Hodge — แยก "ชนิด" ของรถติด

<div class="row">
<div class="card" style="border-top-color:#ef4444"><div class="big">🔴</div><strong>Exact</strong><br><span class="muted">คอขวด<br>(มีต้น-ปลาย)</span></div>
<div class="card" style="border-top-color:#f59e0b"><div class="big">🟡</div><strong>Coexact</strong><br><span class="muted">วนลูป<br>รถวนหาทาง</span></div>
<div class="card" style="border-top-color:#22c55e"><div class="big">🟢</div><strong>Harmonic</strong><br><span class="muted">ทางทะลุ<br>ไหลลื่น</span></div>
</div>
<br>
<div class="flow"><strong>Waze/Google เห็นแค่ "ติด" — เราเห็นว่าติด<em>แบบไหน</em></strong></div>

<!--
พูด: นี่คือสิ่งที่คู่แข่งไม่มี — เราแยกได้ว่ารถติดเพราะคอขวด (แก้ด้วยเลี่ยงจุด)
หรือติดเพราะวนลูปหาทาง (แก้ด้วยดันให้ใช้ทางหลัก)
อ้างอิง: Hodge Decomposition for Urban Traffic Flow (arXiv 2025), Nature Sci.Rep. 2022
-->

---

<!-- _class: divider -->
# 💬 ย่านาง — AI ที่ห้ามมั่ว

<div class="flow">
คำถามไทย → 🤖 ThaiLLM → 🛡️ <strong>Grounding Gate</strong> → คำตอบ
</div>
<br>
<div class="row">
<div class="card" style="border-top-color:#a78bfa"><strong>อ้างอิงจริง</strong><br><span class="muted">ใช้ได้แค่ตัวเลข<br>ที่มีในระบบ</span></div>
<div class="card" style="border-top-color:#a78bfa"><strong>ไม่รู้ = บอกตรง</strong><br><span class="muted">ไม่แต่งตัวเลข</span></div>
<div class="card" style="border-top-color:#a78bfa"><strong>ล่มก็ตอบได้</strong><br><span class="muted">fallback KARC/Hodge</span></div>
</div>

<span class="muted">LLM เป็น "ล่าม" ไม่ใช่ "ผู้ตัดสิน" · typhoon-s-8b · ข้อมูลไม่ออกนอกประเทศ</span>

<!--
พูด: ปัญหาใหญ่สุดของ LLM คือมั่ว (hallucination) — ย่านางถูกล็อกให้ตอบจากข้อมูลจริงเท่านั้น
การตัดสินผ่าน/ไม่ผ่านเป็นของ Rule Engine (คณิตศาสตร์) ย่านางแค่แปลเป็นภาษาคน
-->

---

<!-- _class: divider -->
# 🔄 ทุกอย่างเชื่อมเป็น Closed Loop

<div class="flow" style="font-size:26px">
🧑‍🔧 ผู้รับเหมาส่งงาน<br>↓<br>
🛡️ <strong>Rule Engine</strong> ตรวจ → 🔮 KARC → 📐 Hodge<br>↓<br>
🚗 ผู้ขับขี่เห็นหมุด + 💬 ย่านางแนะนำ<br>↓<br>
📢 feedback ≥3 → <strong>re-audit อัตโนมัติ</strong>
</div>

<!--
พูด: ข้อมูลชุดเดียว วิ่งครบวงจร — ไม่มีจุดหลุด ผู้รับเหมา → AI → ประชาชน → กลับมาที่ ทล.
เชื่อม real-time ด้วย BroadcastChannel, กันแก้ด้วย SHA-256 hash
-->

---

<!-- _class: lead -->
# ทำไมพิเศษ

<div class="row">
<div class="card"><div class="big">0</div><span class="muted">model file<br>0 GPU</span></div>
<div class="card"><div class="big">4</div><span class="muted">สัญญาณหลอมกัน<br>(ภาพ+feedback+KARC+admin)</span></div>
<div class="card"><div class="big">100%</div><span class="muted">ตรวจสอบได้<br>+ audit hash</span></div>
</div>
<br>
<strong>คณิตศาสตร์ research-grade ที่รันบนมือถือได้จริง</strong>

<!--
พูด: ปิดด้วย — เราไม่ได้แค่เอา AI มาแปะ เราเอาคณิตศาสตร์มาทำให้ verify ได้ รันได้ทุกที่
-->
