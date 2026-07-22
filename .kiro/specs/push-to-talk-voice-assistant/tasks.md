# Implementation Plan: Push-to-Talk Voice Assistant

## Overview

แผนการ implement push-to-talk voice interaction สำหรับย่านาง AI ตาม requirements.md (9 requirements) และ design.md (20 correctness properties) แบ่งเป็น infrastructure ก่อน (pure reducer, bridge, backend fields) แล้วค่อย wire-up จริงบน DOM สุดท้ายค่อย property/unit tests และ manual verification เพื่อให้แต่ละชั้นทดสอบแยกได้ก่อนต่อกันทั้งระบบ

## Tasks

- [x] 1. Backend: เพิ่ม VoiceContext data model ใน chat.rs — เพิ่ม struct `VoiceContext`, `GeoPoint`, `NearbyProjectContext` และ field `voice_context: Option<VoiceContext>` บน `ChatRequest` ที่มีอยู่ (ทุก field เดิมไม่เปลี่ยน, field ใหม่เป็น `Option` ทั้งหมด) — (Req 7.1, 7.4, 7.5)

- [x] 2. Backend: เขียน build_voice_context_prompt_fragment() แบบ pure function — รับ `&Option<VoiceContext>` คืน `Option<String>` ที่มีพิกัดตำแหน่ง (ถ้ามี) และชื่อ+ระยะทางของแต่ละ nearby project (ถ้ามี) คืน `None` เมื่อ input เป็น `None` — (Req 7.4, 7.5)

- [x] 3. Backend: ต่อ fragment เข้ากับ system prompt ใน chat_handler — เรียก `build_voice_context_prompt_fragment` แล้ว append ต่อจาก `build_guardrailed_prompt` เดิมเมื่อมีค่า, ไม่แก้ไข prompt เดิมเมื่อ `voice_context` เป็น `None` — (Req 7.4, 7.5)

- [x] 4. Backend: เพิ่ม proptest dev-dependency และเขียน property tests 19-20 — เพิ่ม `proptest` ใน `[dev-dependencies]` ของ Cargo.toml, เขียน `proptest!` block (≥100 cases) ยืนยันว่า fragment มีชื่อ+ระยะทางของทุก project ที่ส่งมา (Property 19) และว่า `voice_context = None` ทำให้ system prompt เหมือนของเดิมทุกตัวอักษร (Property 20) — (Property 19, 20)

- [x] 5. Backend: smoke test backward-compat — ตรวจ deserialize ของ payload แบบเดิม (ไม่มี field `voice_context` เลย) และ payload ใหม่ (มี `voice_context`) ยืนยันทั้งสองแบบผ่าน (หมายเหตุ: ไม่ boot axum router จริงเพราะ chat_handler เรียก ThaiLLM ผ่าน network ที่ไม่มี mock layer — ตรวจที่ระดับ wire-format/deserialization แทน ซึ่งเป็นจุดเสี่ยง backward-compat จริง) — (Req 7.5)

- [x] 6. Frontend infra: ติดตั้ง vitest + fast-check — สร้าง `package.json` ใหม่ใน `yanang-ai/` (ไม่มีมาก่อน) พร้อม `vitest.config.js`, รันด้วย `npm test` → `vitest --run`

- [x] 7. Frontend: เขียน pure reducer reduce(state, session, event) — สร้าง `static/voice-controller.js` ครอบคลุมทุก transition (idle/listening/processing/speaking/error), คืน `{ state, session, effects }`, ไม่แตะ DOM/timer/network ใดๆ — (Req 1, 2, 3, 5, 6, ทุก property ฝั่ง frontend)

- [x] 8. Frontend: เขียน property tests สำหรับ reducer (Property 1-15, 17-18) — `static/voice-controller.test.js` ใช้ fast-check, 100 runs ต่อ property, ทั้ง 20 tests ผ่าน — (Property 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18)

- [x] 9. Frontend: เพิ่ม window.YanangChatBridge ใน app.js — เพิ่ม object พร้อม `getActiveStyle()`, `getHistory()`, `pushHistory()`, `postChat()`, `addChat()`, `speakThai()`, refactor `sendMessage()` ให้เรียกผ่าน `postChat()`/`pushHistory()` — (Req 9.1, 9.3)

- [x] 10. Frontend: เพิ่ม getNearbyProjects() ใน alerts.js — reuse `haversineM` เดิม, กรอง `window.constructionProjects` ตาม `maxDistanceM` (default 1000m), ไม่แก้ logic proximity alert เดิม (500m) — (Req 7.1, Property 17)

- [x] 11. Frontend: เพิ่ม CSS states .voice-btn.processing และ .voice-btn.error — เพิ่มใน style.css พร้อม keyframe animation ที่แยกจาก `.listening`/`.speaking` เดิม — (Req 4.2, 4.3, 4.5, Property 11)

- [x] 12. Frontend: implement VoiceController class (effect runner) รอบ reducer — เพิ่มใน `static/voice-controller.js` เมธอด handle* ครบ + effect execution (START_RECOGNIZER, STOP_RECOGNIZER, CANCEL_SYNTH, SEND_CHAT, SCHEDULE_ERROR_TIMEOUT, RENDER) จริงบน DOM/Web Speech API — (Req 1, 2, 3, 5, 6, 7, 8, 9)

- [x] 13. Frontend: wire VoiceController เข้ากับ #voice-btn จริงใน index.html/app.js — ลบ `toggleVoice()`/`startVoice()`/`stopVoice()` เดิม, สร้าง `voice-controller-init.js` bind event listeners จริง, โหลด `voice-controller.js` (module) หลัง `alerts.js`/`map.js`/`app.js` — (Req 1.1, 1.2, 3.1, ทุก requirement ที่เกี่ยวกับ event จริง)

- [x] 14. Frontend: Secure_Context + browser support detection ตอนโหลดหน้า — `voice-controller-init.js` ตรวจ `window.isSecureContext` และ `SpeechRecognition` ตอนโหลด, disable `#voice-btn` พร้อมข้อความ hint ถ้าไม่รองรับ, `#user-input`/`#send-btn` ไม่ถูกแก้ไขเลย — (Req 8.1, 8.2, 8.3, 8.4, Property 16)

- [x] 15. Frontend: เขียน example/unit tests ที่ไม่ใช่ property — `static/voice-controller-init.test.js` ยืนยัน `preventDefault()` บน touchstart (Req 3.1), แต่ละสถานะ render class ถูกต้อง (Req 4.1-4.3), Secure_Context/browser support gate ถูก logic (Req 8.1, 8.2), `speakThai()` ถูกเรียกด้วยคำตอบจาก voice request (Req 9.3) — ทั้ง 9 tests ผ่าน

- [x] 16. Manual verification (ส่วนที่ agent ทำได้) — `cargo build` ผ่าน, `cargo test` ผ่าน 4/4 tests ใหม่ (property 19, 20 + 2 smoke tests; ข้อสังเกต: มี 1 test เดิมที่ไม่เกี่ยวกับ feature นี้ `test_food_intent` fail อยู่ก่อนแล้ว), `npx vitest --run` ผ่าน 29/29 tests, บูต server จริงแล้วยิง curl ยืนยัน `/api/chat` ทำงานได้ทั้งแบบมีและไม่มี `voice_context` (HTTP 200 ทั้งคู่), ไฟล์ static ทั้งหมดโหลดได้ (200) — **ส่วนที่เหลือ (ทดสอบกดปุ่มพูดจริงบนเบราว์เซอร์ + มือถือผ่าน HTTPS) ต้องรอผู้ใช้ทดสอบเอง เพราะต้องใช้ mic permission จริง**

## Task Dependency Graph

```json
{
  "waves": [
    {"tasks": [1]},
    {"tasks": [2]},
    {"tasks": [3]},
    {"tasks": [4, 5]},
    {"tasks": [6]},
    {"tasks": [7]},
    {"tasks": [8, 9, 10, 11]},
    {"tasks": [12]},
    {"tasks": [13, 14]},
    {"tasks": [15]},
    {"tasks": [16]}
  ]
}
```

```
Task 1 (VoiceContext structs)
└── Task 2 (build_voice_context_prompt_fragment)
    └── Task 3 (ต่อเข้า chat_handler)
        ├── Task 4 (proptest Property 19-20)
        └── Task 5 (smoke test backward-compat)

Task 6 (vitest + fast-check setup)
└── Task 7 (pure reducer reduce())
    ├── Task 8 (property tests 1-15, 17-18)
    ├── Task 9 (YanangChatBridge ใน app.js)
    ├── Task 10 (getNearbyProjects ใน alerts.js)
    └── Task 11 (CSS .processing/.error)
        └── Task 12 (VoiceController effect runner)
            ├── Task 13 (wire ปุ่มจริง #voice-btn)
            └── Task 14 (Secure_Context detection)
                └── Task 15 (example/unit tests)
                    └── Task 16 (manual verification) ★ ปิดงาน
```

## Notes

- Task 7 (pure reducer) เป็นจุดที่ property tests ส่วนใหญ่ (13 จาก 20) ต้องพึ่ง — ทำให้ถูกต้องก่อนแล้วค่อยต่อ effect runner (Task 12) จะลดความเสี่ยง regression
- Backend (Task 1-5) และ frontend infra (Task 6-11) ทำแยกคู่ขนานกันได้ ไม่มี dependency ข้ามกัน จนกว่าจะถึง Task 13 ที่ frontend เริ่มยิง request จริงที่มี `voice_context`
- Task 16 ต้องรอ user ทดสอบบน browser จริงเพราะ push-to-talk ต้องใช้ mic permission และ HTTPS บนมือถือ ซึ่ง agent ไม่สามารถทดสอบเองได้
- ถ้าเวลาจำกัดสำหรับ demo เร็วๆ: Task 1-5 (backend) เป็น nice-to-have ตัดได้ก่อน เพราะ push-to-talk UX (Task 6-14) คือจุดที่ user ต้องการเห็นก่อน ส่วน voice context (ตำแหน่ง+โครงการก่อสร้าง) เป็น enhancement รอบสองได้
