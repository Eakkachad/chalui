# Requirements Document

## Introduction

ย่านาง AI มีระบบเสียงพื้นฐานอยู่แล้ว (ปุ่มไมค์แบบ toggle ผ่าน Web Speech API + TTS ภาษาไทย) แต่รูปแบบการโต้ตอบแบบ toggle ไม่ชัดเจนว่าระบบกำลังฟังอยู่หรือไม่ และไม่เหมาะกับการสาธิต (demo) ต่อหน้าผู้ชม

ฟีเจอร์นี้ปรับปรุงปฏิสัมพันธ์เสียงของย่านาง AI ให้เป็นรูปแบบ **push-to-talk** (กดปุ่มค้างเพื่อพูด ปล่อยเพื่อส่ง) คล้าย walkie-talkie และคล้ายกับผู้ช่วยเสียงใน Grok/Tesla เพื่อให้การสาธิตสดคาดเดาได้ (predictable) ชัดเจนว่าระบบกำลังอยู่ในสถานะใด และไม่มีสิ่งที่ทำให้ demo สะดุด

ฟีเจอร์นี้ปรับปรุง `static/index.html`, `static/app.js`, `static/style.css` ที่มีอยู่ และอาจขยาย `/api/chat` (`src/routes/chat.rs`) เพื่อรับ context เพิ่มเติมเกี่ยวกับตำแหน่งผู้ใช้และโครงการก่อสร้างใกล้เคียง

**นอกขอบเขตของฟีเจอร์นี้อย่างชัดเจน (out of scope):** wake-word detection, always-listening/continuous mode, และ multi-turn conversation memory ที่ซับซ้อนเกินกว่า history ที่มีอยู่แล้วใน `sendMessage()`

## Glossary

- **Talk_Button**: ปุ่มไมค์ในหน้าเว็บ (element `#voice-btn`) ที่ผู้ใช้กดค้างเพื่อเริ่มพูดและปล่อยเพื่อส่ง
- **Voice_Controller**: โมดูล JavaScript ฝั่ง frontend ที่จัดการสถานะปฏิสัมพันธ์เสียงทั้งหมด (state machine, event binding, การเรียก Speech_Recognizer และ Speech_Synthesizer)
- **Speech_Recognizer**: wrapper รอบ Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition`) ที่แปลงเสียงพูดเป็นข้อความ (transcript)
- **Speech_Synthesizer**: wrapper รอบ `speechSynthesis` ที่แปลงข้อความตอบกลับเป็นเสียงพูดภาษาไทย
- **Interaction_State**: สถานะปัจจุบันของ Voice_Controller หนึ่งใน `idle`, `listening`, `processing`, `speaking`, หรือ `error`
- **Press_Session**: ช่วงเวลาต่อเนื่องเดียวตั้งแต่ผู้ใช้เริ่มกด Talk_Button จนถึงปล่อย (ระบุด้วย pointer type เดียว คือ mouse หรือ touch)
- **Transcript**: ข้อความที่ Speech_Recognizer แปลงได้จากเสียงพูดของผู้ใช้ใน Press_Session หนึ่งครั้ง
- **Chat_Endpoint**: REST endpoint `/api/chat` ที่มีอยู่แล้ว ซึ่งรับข้อความผู้ใช้ ค่า style และ history แล้วส่งกลับคำตอบจาก ThaiLLM
- **Voice_Context_Payload**: ข้อมูลบริบทเพิ่มเติม (ตำแหน่ง GPS ปัจจุบันของผู้ใช้ และรายชื่อ Nearby_Construction_Project) ที่ Voice_Controller แนบไปกับคำขอไปยัง Chat_Endpoint เมื่อ Transcript มาจาก Talk_Button
- **Nearby_Construction_Project**: โครงการก่อสร้างจาก `/api/construction/projects` ที่มีระยะห่างจากตำแหน่งผู้ใช้ปัจจุบันไม่เกิน 1 กิโลเมตร
- **Active_Style**: สไตล์การตอบที่ผู้ใช้เลือกไว้ผ่าน style panel ที่มีอยู่แล้ว (cheerful, serious, concise, friendly, professional)
- **Minimum_Press_Duration**: ระยะเวลาต่ำสุด (300 มิลลิวินาที) ที่ Press_Session ต้องยาวนานกว่านี้จึงจะถือว่าเป็นความตั้งใจพูด ไม่ใช่การกดพลาด
- **Secure_Context**: หน้าเว็บที่ให้บริการผ่าน HTTPS (หรือ localhost) ซึ่ง Web Speech API สามารถขอสิทธิ์ไมโครโฟนได้ตามข้อจำกัดของเบราว์เซอร์

## Requirements

### Requirement 1: เริ่มฟังทันทีเมื่อกด Talk_Button ค้าง

**User Story:** ในฐานะผู้สาธิตระบบ ฉันต้องการกดปุ่มไมค์ค้างแล้วเริ่มฟังทันที เพื่อให้ผู้ชมเห็นว่าระบบกำลังฟังโดยไม่มีความล่าช้าหรือความกำกวม

#### Acceptance Criteria

1. WHEN ผู้ใช้กด mousedown บน Talk_Button ขณะ Interaction_State เป็น `idle`, THE Voice_Controller SHALL เริ่มต้น Press_Session ด้วย pointer type "mouse" และเปลี่ยน Interaction_State เป็น `listening` ภายใน 100 มิลลิวินาที
2. WHEN ผู้ใช้กด touchstart บน Talk_Button ขณะ Interaction_State เป็น `idle`, THE Voice_Controller SHALL เริ่มต้น Press_Session ด้วย pointer type "touch" และเปลี่ยน Interaction_State เป็น `listening` ภายใน 100 มิลลิวินาที
3. WHEN Interaction_State เปลี่ยนเป็น `listening`, THE Voice_Controller SHALL เรียก `Speech_Recognizer.start()` และเริ่มบันทึกเสียงจากไมโครโฟน
4. IF ผู้ใช้กด mousedown หรือ touchstart บน Talk_Button ขณะ Interaction_State ไม่ใช่ `idle`, THEN THE Voice_Controller SHALL ไม่เริ่ม Press_Session ใหม่
5. IF Voice_Controller ไม่สามารถเปลี่ยน Interaction_State เป็น `listening` ได้ภายใน 100 มิลลิวินาทีจากอีเวนต์ mousedown/touchstart, THEN THE Voice_Controller SHALL ยกเลิก Press_Session นั้นทั้งหมดและคง Interaction_State เป็น `idle` โดยไม่เรียก `Speech_Recognizer.start()`
6. IF `Speech_Recognizer.start()` ล้มเหลวหรือคืนค่าข้อผิดพลาดทันทีหลังเรียก, THEN THE Voice_Controller SHALL หยุดการบันทึกเสียงทันทีและปฏิบัติตาม Requirement 6

### Requirement 2: หยุดฟังและส่ง Transcript ทันทีเมื่อปล่อยปุ่ม

**User Story:** ในฐานะผู้สาธิตระบบ ฉันต้องการให้ระบบส่งคำพูดไปประมวลผลทันทีที่ปล่อยปุ่ม โดยไม่ต้องรอการตรวจจับความเงียบ เพื่อให้การโต้ตอบรวดเร็วและคาดเดาได้

#### Acceptance Criteria

1. WHEN ผู้ใช้ปล่อย mouseup ขณะ Press_Session ที่เปิดอยู่มี pointer type "mouse", THE Voice_Controller SHALL หยุด Speech_Recognizer และปิด Press_Session ทันที
2. WHEN ผู้ใช้ปล่อย touchend ขณะ Press_Session ที่เปิดอยู่มี pointer type "touch", THE Voice_Controller SHALL หยุด Speech_Recognizer และปิด Press_Session ทันที
3. IF Press_Session ที่ปิดมีระยะเวลารวมสั้นกว่า Minimum_Press_Duration, THEN THE Voice_Controller SHALL ยกเลิก Transcript ของ Press_Session นั้นและเปลี่ยน Interaction_State กลับเป็น `idle` โดยไม่ส่งคำขอไปยัง Chat_Endpoint
4. WHEN Press_Session ปิดด้วยระยะเวลาไม่สั้นกว่า Minimum_Press_Duration และมี Transcript ที่ไม่ว่าง, THE Voice_Controller SHALL เปลี่ยน Interaction_State เป็น `processing` และส่ง Transcript ไปยัง Chat_Endpoint ทันทีโดยไม่รอการตรวจจับความเงียบเพิ่มเติม
5. IF Press_Session ปิดด้วยระยะเวลาไม่สั้นกว่า Minimum_Press_Duration แต่ Transcript ว่างเปล่า, THEN THE Voice_Controller SHALL เปลี่ยน Interaction_State กลับเป็น `idle` และแสดงข้อความสั้น ๆ ว่าไม่ได้ยินเสียงพูด
6. IF คำขอไปยัง Chat_Endpoint ล้มเหลวเนื่องจากปัญหาเครือข่ายหรือ endpoint ขณะ Interaction_State เป็น `processing`, THEN THE Voice_Controller SHALL ลองส่งคำขอซ้ำโดยอัตโนมัติและคง Interaction_State เป็น `processing` จนกว่าคำขอจะสำเร็จหรือผู้ใช้กด Talk_Button ใหม่

### Requirement 3: รองรับทั้ง mouse และ touch โดยไม่เกิด double-trigger

**User Story:** ในฐานะผู้สาธิตระบบที่อาจใช้ desktop หรือมือถือ ฉันต้องการให้ปุ่มพูดทำงานถูกต้องกับทั้งเมาส์และการสัมผัส โดยไม่เกิดการกดซ้ำซ้อนจาก touch และ click ที่เบราว์เซอร์ยิงต่อเนื่องกัน

#### Acceptance Criteria

1. WHEN touchstart ถูกยิงบน Talk_Button, THE Voice_Controller SHALL เรียก `preventDefault()` บนอีเวนต์นั้นเพื่อระงับอีเวนต์ mouse/click สังเคราะห์ที่เบราว์เซอร์สร้างตามมา
2. WHILE Press_Session ที่มี pointer type "touch" เปิดอยู่, THE Voice_Controller SHALL ไม่ประมวลผลอีเวนต์ mousedown บน Talk_Button ให้เป็น Press_Session ใหม่
3. IF อีเวนต์ touchcancel เกิดขึ้นขณะ Press_Session ที่มี pointer type "touch" เปิดอยู่, THEN THE Voice_Controller SHALL ปิด Press_Session โดยยกเลิก Transcript และเปลี่ยน Interaction_State กลับเป็น `idle` โดยไม่ส่งคำขอไปยัง Chat_Endpoint
4. IF อีเวนต์ mouseleave เกิดขึ้นบน Talk_Button ขณะ Press_Session ที่มี pointer type "mouse" เปิดอยู่และยังไม่ถูกยกเลิก, THEN THE Voice_Controller SHALL ปฏิบัติเหมือนการปล่อยปุ่ม (ตาม Requirement 2)
5. IF อีเวนต์ mouseleave เกิดขึ้นบน Talk_Button ขณะ Press_Session ที่มี pointer type "mouse" ถูกยกเลิกไปแล้ว (เช่นจาก touchcancel หรือเหตุผลอื่น), THEN THE Voice_Controller SHALL คงสถานะที่ถูกยกเลิกไว้และไม่ประมวลผล mouseleave นั้นซ้ำ

### Requirement 4: แสดงสถานะปฏิสัมพันธ์เสียงที่ดูออกง่ายบนจอ

**User Story:** ในฐานะผู้ชม demo ฉันต้องการเห็นสถานะของระบบเสียงชัดเจนบนจอ (กำลังฟัง/กำลังคิด/กำลังพูด) เพื่อให้เข้าใจว่าเกิดอะไรขึ้นโดยไม่ต้องอธิบายเพิ่ม

#### Acceptance Criteria

1. WHILE Interaction_State เป็น `listening`, THE Voice_Controller SHALL แสดง visual feedback แบบพัลส์/waveform บน Talk_Button ที่แตกต่างจากสถานะอื่นอย่างชัดเจน
2. WHILE Interaction_State เป็น `processing`, THE Voice_Controller SHALL แสดง visual feedback ที่บ่งบอกว่ากำลังส่งคำขอไปยัง Chat_Endpoint และแตกต่างจากสถานะ `listening`
3. WHILE Interaction_State เป็น `speaking`, THE Voice_Controller SHALL แสดง visual feedback ที่บ่งบอกว่า Speech_Synthesizer กำลังพูดอยู่ และแตกต่างจากสถานะ `listening` และ `processing`
4. WHEN Interaction_State เปลี่ยนกลับเป็น `idle`, THE Voice_Controller SHALL ลบ visual feedback ทั้งหมดที่เกี่ยวข้องกับสถานะก่อนหน้าออกจาก Talk_Button
5. THE Voice_Controller SHALL ให้แต่ละ Interaction_State ที่แสดงผล (`listening`, `processing`, `speaking`, `error`) มีรูปแบบสี ไอคอน หรือแอนิเมชันที่ไม่ซ้ำกัน

### Requirement 5: ตัดเสียงพูดเดิมทันทีเมื่อเริ่มพูดใหม่

**User Story:** ในฐานะผู้สาธิตระบบ ฉันต้องการให้เสียงตอบเดิมของ AI หยุดทันทีเมื่อฉันกดพูดคำถามใหม่ เพื่อไม่ให้เสียงพูดทับกันต่อหน้าผู้ชม

#### Acceptance Criteria

1. WHEN ผู้ใช้กด mousedown หรือ touchstart บน Talk_Button ขณะ Interaction_State เป็น `speaking`, THE Voice_Controller SHALL เรียก `Speech_Synthesizer.cancel()` ก่อนเริ่ม Press_Session ใหม่
2. WHEN `Speech_Synthesizer.cancel()` ถูกเรียกจากการกด Talk_Button ระหว่าง `speaking`, THE Voice_Controller SHALL เปลี่ยน Interaction_State เป็น `listening` ทันทีหลังจากยกเลิกเสียงพูดเดิม
3. IF Speech_Synthesizer กำลังพูดอยู่และไม่มีการกด Talk_Button ใหม่, THEN THE Voice_Controller SHALL ปล่อยให้เสียงพูดดำเนินไปจนจบตามปกติ
4. IF Speech_Synthesizer รายงานข้อผิดพลาดขณะ Interaction_State เป็น `speaking`, THEN THE Voice_Controller SHALL คง Interaction_State เป็น `speaking` โดยไม่แสดงข้อความข้อผิดพลาด จนกว่าผู้ใช้จะกด Talk_Button ใหม่ (ซึ่งจะปฏิบัติตาม Requirement 5.1-5.2)

### Requirement 6: จัดการข้อผิดพลาดของ speech recognition โดยไม่ทำให้ demo สะดุด

**User Story:** ในฐานะผู้สาธิตระบบ ฉันต้องการให้ข้อผิดพลาดของไมโครโฟน (ไม่มีเสียง, ไม่อนุญาตสิทธิ์, ข้อผิดพลาดเครือข่าย) แสดงผลอย่างสงบและไม่ทำให้แอปหยุดทำงาน

#### Acceptance Criteria

1. IF Speech_Recognizer รายงานข้อผิดพลาด `no-speech`, THEN THE Voice_Controller SHALL เปลี่ยน Interaction_State กลับเป็น `idle` โดยไม่แสดงข้อความข้อผิดพลาดในหน้าแชท แต่อาจแสดงแอนิเมชันหรือ visual feedback สั้น ๆ บน Talk_Button เพื่อบ่งบอกว่าระบบได้ยินการพยายามพูด
2. IF Speech_Recognizer รายงานข้อผิดพลาด `not-allowed` หรือ `permission-denied`, THEN THE Voice_Controller SHALL เปลี่ยน Interaction_State เป็น `error` ชั่วคราว แสดงข้อความสั้น ๆ ว่าไม่ได้รับอนุญาตให้ใช้ไมโครโฟน และกลับเป็น `idle` ภายใน 4 วินาที
3. IF Speech_Recognizer รายงานข้อผิดพลาด `network` หรือข้อผิดพลาดอื่นที่ไม่ใช่ `no-speech`, THEN THE Voice_Controller SHALL เปลี่ยน Interaction_State เป็น `error` ชั่วคราว แสดงข้อความสั้น ๆ ที่อธิบายปัญหา และกลับเป็น `idle` ภายใน 4 วินาที
4. IF เกิดข้อผิดพลาดใด ๆ จาก Speech_Recognizer, THEN THE Voice_Controller SHALL ไม่ส่งคำขอไปยัง Chat_Endpoint สำหรับ Press_Session นั้น
5. WHEN Voice_Controller เข้าสู่ Interaction_State `error`, THE Voice_Controller SHALL คง Talk_Button ให้อยู่ในสถานะเปิดใช้งาน (enabled) ตลอดช่วงเวลา `error` และรับ mousedown/touchstart ครั้งต่อไปได้ตามปกติหลังกลับเป็น `idle`

### Requirement 7: เชื่อมโยงคำตอบเสียงกับบริบทตำแหน่งและโครงการก่อสร้างใกล้เคียง

**User Story:** ในฐานะผู้ใช้ ฉันต้องการถามคำถามด้วยเสียงเกี่ยวกับเส้นทางปัจจุบันหรือโครงการก่อสร้างใกล้เคียง และได้คำตอบที่อ้างอิงตำแหน่งจริงของฉัน

#### Acceptance Criteria

1. WHEN Voice_Controller ส่ง Transcript ไปยัง Chat_Endpoint, THE Voice_Controller SHALL แนบ Voice_Context_Payload ที่มีตำแหน่ง GPS ปัจจุบันของผู้ใช้ (ถ้ามี) และรายชื่อ Nearby_Construction_Project ไปกับคำขอ
2. IF ไม่มีตำแหน่ง GPS ของผู้ใช้ในขณะนั้น, THEN THE Voice_Controller SHALL ส่งคำขอไปยัง Chat_Endpoint โดยไม่มี Voice_Context_Payload ด้านตำแหน่ง แล้วดำเนินการประมวลผลคำขอต่อไปตามปกติ
3. IF การรวบรวมข้อมูลตำแหน่งหรือ Nearby_Construction_Project สำหรับ Voice_Context_Payload ล้มเหลว (เช่น สิทธิ์ตำแหน่งถูกถอนหรือเกิดข้อผิดพลาดเครือข่ายระหว่างดึงข้อมูล), THEN THE Voice_Controller SHALL ส่ง Transcript ไปยัง Chat_Endpoint โดยไม่มี Voice_Context_Payload แทนที่จะยกเลิกคำขอ
4. WHEN Chat_Endpoint ได้รับคำขอที่มี Voice_Context_Payload, THE Chat_Endpoint SHALL รวมข้อมูลตำแหน่งและ Nearby_Construction_Project เข้าไปใน system prompt ที่ส่งให้ ThaiLLM
5. THE Chat_Endpoint SHALL ยอมรับคำขอที่ไม่มี Voice_Context_Payload และประมวลผลได้ตามพฤติกรรมเดิมโดยไม่เกิดข้อผิดพลาด

### Requirement 8: ทำงานได้เต็มรูปแบบบน Secure_Context และลดระดับอย่างนุ่มนวลบน HTTP

**User Story:** ในฐานะผู้สาธิตระบบที่อาจเปิดแอปผ่าน HTTP หรือ HTTPS ฉันต้องการให้แอปยังใช้งานได้เสมอ แม้ไมโครโฟนใช้ไม่ได้ในบางสภาพแวดล้อม

#### Acceptance Criteria

1. WHEN หน้าเว็บให้บริการผ่าน Secure_Context และเบราว์เซอร์รองรับ Web Speech API, THE Voice_Controller SHALL เปิดใช้งาน (enable) Talk_Button อย่างชัดเจนเพื่อให้ทำงานตาม Requirement 1-6 ได้เต็มรูปแบบ
2. IF เบราว์เซอร์ไม่รองรับ `SpeechRecognition`/`webkitSpeechRecognition`, THEN THE Voice_Controller SHALL แสดง Talk_Button ในสถานะปิดใช้งาน (disabled) และแสดงข้อความสั้น ๆ แนะนำให้ใช้ช่องพิมพ์ข้อความแทน
3. IF การขอสิทธิ์ไมโครโฟนล้มเหลวเนื่องจากหน้าเว็บไม่ได้อยู่ใน Secure_Context, THEN THE Voice_Controller SHALL ปฏิบัติตาม Requirement 6.2 และคงช่องพิมพ์ข้อความ (`#user-input`) ให้ใช้งานได้ตามปกติ
4. THE Voice_Controller SHALL ไม่ปิดใช้งานช่องพิมพ์ข้อความหรือปุ่มส่งข้อความ (`#send-btn`) ไม่ว่า Talk_Button จะอยู่ในสถานะใด

### Requirement 9: สไตล์บุคลิกที่มีอยู่ใช้ได้กับการสนทนาด้วยเสียง

**User Story:** ในฐานะผู้ใช้ ฉันต้องการให้สไตล์การตอบที่ฉันเลือกไว้ (ร่าเริง จริงจัง กระชับ เป็นมิตร มืออาชีพ) มีผลกับคำตอบที่มาจากการพูดด้วยเสียงเช่นเดียวกับการพิมพ์

#### Acceptance Criteria

1. WHEN Voice_Controller ส่ง Transcript ไปยัง Chat_Endpoint, THE Voice_Controller SHALL แนบค่า Active_Style ปัจจุบันไปกับคำขอ ด้วยรูปแบบพารามิเตอร์เดียวกับที่ `sendMessage()` ใช้อยู่
2. IF Voice_Controller ไม่สามารถกำหนดค่า Active_Style ที่ถูกต้องเพื่อแนบไปกับคำขอได้, THEN THE Voice_Controller SHALL ยกเลิกการส่งคำขอไปยัง Chat_Endpoint สำหรับ Press_Session นั้น และเปลี่ยน Interaction_State กลับเป็น `idle` พร้อมแสดงข้อความสั้น ๆ ว่าเกิดข้อผิดพลาด
3. WHEN Chat_Endpoint ตอบกลับข้อความสำหรับคำขอที่มาจาก Voice_Controller, THE Speech_Synthesizer SHALL อ่านข้อความตอบกลับด้วยน้ำเสียงภาษาไทยเดียวกับที่ใช้กับคำตอบจากการพิมพ์
4. IF ผู้ใช้เปลี่ยน Active_Style ผ่าน style panel ระหว่าง Interaction_State เป็น `idle`, THEN THE Voice_Controller SHALL ใช้ Active_Style ใหม่กับ Press_Session ถัดไปทั้งหมด
