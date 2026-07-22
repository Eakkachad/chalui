# Requirements Document

## Introduction

เอกสารนี้กำหนด requirements สำหรับการเชื่อม **ย่านาง AI** (`yanang-ai/`, ฝั่ง Traveler) เข้ากับ backend ของทีม Constructor/Admin ซึ่ง ณ ขณะเขียนเอกสารนี้ **ยังไม่มีอยู่จริงในรูปแบบ network service** (ฝั่ง Constructor/Admin เป็น client-side-only prototype ใน `gps-construction/`/`gps-astro/` เท่านั้น) requirements นี้จึงมาจาก design ที่นิยาม **สัญญา (contract)** ที่ backend จริงต้องทำตาม พร้อม adapter + mock ที่ใช้งานได้จริงตอนนี้ เพื่อให้ Traveler ไม่ต้องรอทีมอื่นเสร็จก่อนจึงจะ demo ได้

เอกสารนี้ยังยืนยัน (formalize) ระบบนำทางจริงที่มีอยู่แล้ว (GPS geolocation + OSRM routing + Nominatim geocoding — ไม่ใช่ mock) ให้เป็น production path อย่างชัดเจน และคง contract ของฟีเจอร์ push-to-talk voice assistant (`VoiceContext`) ไว้โดยไม่แก้ไข

**ลำดับความสำคัญ**: งาน integration หลัก (adapter + report endpoint + ยืนยัน navigation จริง) ต้องเสร็จก่อน ส่วนการต่อยอดด้วย katgpt-rs (Requirement 8) เป็น stretch goal ที่ตัดทิ้งได้โดยไม่กระทบ core deliverable

## Glossary

- **Traveler_App**: ย่านาง AI ฝั่ง Traveler (`yanang-ai/` — Axum backend + static frontend)
- **Admin_Backend**: บริการ backend ของทีม Constructor/Admin ที่ **ยังไม่มีอยู่จริง** ในขณะเขียนเอกสารนี้ — Traveler_App ต้อง integrate ทันทีที่มันพร้อม โดยไม่ต้องแก้โค้ด route
- **Construction_Backend_Adapter**: ชั้น adapter (`ConstructionBackend` trait) ที่แยก route handler ออกจากรายละเอียดว่าข้อมูลมาจาก Mock_Backend หรือ Admin_Backend จริง
- **Mock_Backend**: implementation ของ Construction_Backend_Adapter ที่ใช้ข้อมูล hardcoded 15 โครงการปัจจุบัน (ของเดิมใน `construction.rs`)
- **Http_Backend**: implementation ของ Construction_Backend_Adapter ที่เรียก Admin_Backend จริงผ่าน HTTP พร้อม fallback กลับไป Mock_Backend เมื่อ Admin_Backend ไม่ตอบสนอง
- **Construction_Feed**: ข้อมูล `GET /api/construction/projects` ที่ Traveler_App แสดงบนแผนที่
- **Citizen_Report**: รายงานปัญหาที่ผู้ใช้ Traveler_App ส่งเข้าระบบผ่าน `POST /api/reports` ใหม่ (สอดคล้องกับ `Feedback` ใน `DATA_AND_AND.md`)
- **Pending_Report_Queue**: ที่เก็บ Citizen_Report ชั่วคราวในหน่วยความจำ เมื่อ Admin_Backend ยังไม่พร้อมรับข้อมูล
- **Voice_Context**: contract ที่มีอยู่แล้วของฟีเจอร์ push-to-talk (`ChatRequest.voice_context`, `GeoPoint`, `NearbyProjectContext` ใน `chat.rs`) — ต้องไม่ถูกแก้ไขโดย requirements นี้
- **Real_Navigation_Path**: เส้นทางการทำงานจริง (ไม่ใช่ demo/mock) ของ GPS tracking (`navigator.geolocation.watchPosition`) + routing (OSRM ผ่าน `/api/navigation/directions`) + geocoding (Nominatim ผ่าน `/api/navigation/geocode`)
- **Demo_Alert_Helper**: ฟังก์ชัน `testConstructionAlert()` ใน `map.js` ที่จำลองตำแหน่งผู้ใช้เพื่อสาธิต proximity alert โดยไม่ต้องขับรถจริง — เป็นเครื่องมือ demo เท่านั้น ไม่ใช่ตัวแทนของ Real_Navigation_Path
- **Shared_Service_Token**: API key ที่ใช้ยืนยันตัวตนระหว่าง Traveler_App และ Admin_Backend (service-to-service) ผ่าน HTTP header `X-Yanang-Key`
- **Session_Id**: ค่าที่ frontend สุ่มสร้างครั้งเดียวต่ออุปกรณ์ (`crypto.randomUUID()`, เก็บใน `localStorage`) ใช้ระบุ session สำหรับ rate limiting ฝั่งเซิร์ฟเวอร์ของ Citizen_Report

## Requirements

### Requirement 1: Construction_Feed ทำงานผ่าน Construction_Backend_Adapter พร้อม fallback ที่ปลอดภัย

**User Story:** ในฐานะ Traveler ฉันต้องการให้แผนที่แสดงข้อมูลโครงการก่อสร้างได้เสมอ ไม่ว่า Admin_Backend จริงจะพร้อมใช้งานหรือไม่ เพื่อไม่ให้แอปพังหรือขึ้นหน้าเปล่าระหว่าง demo

#### Acceptance Criteria

1. THE Traveler_App SHALL ให้ route handler ของ `GET /api/construction/projects` เรียกข้อมูลผ่าน Construction_Backend_Adapter เท่านั้น โดยไม่รู้ว่ากำลังใช้ Mock_Backend หรือ Http_Backend
2. WHEN ตัวแปรสภาพแวดล้อมที่ชี้ไปยัง Admin_Backend ไม่ถูกตั้งค่า, THE Construction_Backend_Adapter SHALL ใช้ Mock_Backend เป็นแหล่งข้อมูลเสมอ โดยไม่คำนึงถึงค่าคอนฟิกอื่นใดที่อาจระบุให้ใช้ Http_Backend
3. IF Http_Backend เรียก Admin_Backend แล้วเกิด timeout, connection refused, หรือข้อผิดพลาดการเชื่อมต่อใดๆ, THEN THE Http_Backend SHALL fallback ไปใช้ข้อมูลจาก Mock_Backend แทนการคืนค่า error
4. IF Admin_Backend ตอบกลับด้วยข้อมูลโครงการที่ค่า `lat`, `lng` อยู่นอกช่วงที่ถูกต้อง หรือค่า `status`/`complianceVerdict` ไม่ตรงกับ enum ที่กำหนด, THEN THE Http_Backend SHALL ตัด record นั้นออกจากผลลัพธ์โดยไม่ทำให้ทั้ง request ล้มเหลว
5. THE `GET /api/construction/projects` endpoint SHALL คืนค่า HTTP 200 พร้อม JSON array เสมอ ไม่ว่า Construction_Backend_Adapter จะใช้ Mock_Backend หรือ Http_Backend และไม่ว่า Admin_Backend จะเข้าถึงได้หรือไม่
6. THE Construction_Backend_Adapter SHALL ไม่ panic ไม่ว่า input จาก Admin_Backend จะมีรูปแบบใด (malformed JSON, body ว่าง, field หายไป)

### Requirement 2: ส่ง Citizen_Report กลับไปยัง Admin_Backend พร้อม fallback แบบ queue

**User Story:** ในฐานะผู้ใช้ Traveler_App ฉันต้องการแจ้งปัญหาที่พบหน้างานก่อสร้าง เพื่อให้ข้อมูลย้อนกลับไปถึง Admin ไม่ว่า Admin_Backend จริงจะพร้อมรับข้อมูลในขณะนั้นหรือไม่

#### Acceptance Criteria

1. THE Traveler_App SHALL ให้บริการ endpoint ใหม่ `POST /api/reports` ที่รับ `problem_type`, `lat`, `lng`, `description` (optional), `photo_data_url` (optional)
2. IF `problem_type` ที่ส่งมาไม่อยู่ใน 5 ค่าที่กำหนด (`no_cones`, `no_sign`, `data_mismatch`, `heavy_traffic`, `other`), THEN THE `POST /api/reports` endpoint SHALL คืนค่า HTTP 422 พร้อมข้อความ error ภาษาไทย
3. IF `lat` หรือ `lng` ไม่ใช่ค่าจำกัด (finite) หรืออยู่นอกช่วงพิกัดโลกที่ถูกต้อง, THEN THE `POST /api/reports` endpoint SHALL คืนค่า HTTP 422
4. THE Traveler_App SHALL ตัด `description` ให้ยาวไม่เกิน 500 ตัวอักษร (นับตาม Unicode grapheme/char ไม่ใช่ byte) ก่อนบันทึกเป็น Citizen_Report เสมอ
5. THE Traveler_App SHALL จำกัดจำนวนการส่ง Citizen_Report ต่อ Session_Id ไม่เกิน 5 ครั้งใน 10 นาทีที่ผ่านมาแบบ rolling window และคืนค่า HTTP 422 พร้อมเวลาที่ต้องรอ เมื่อเกินขีดจำกัด
6. WHEN Citizen_Report ผ่านการตรวจสอบแล้ว, THE Traveler_App SHALL หาโครงการก่อสร้างที่ใกล้ที่สุดด้วยระยะ Haversine เพื่อกำหนดค่า `zone_id` ของรายงาน
7. THE `POST /api/reports` endpoint SHALL คืนค่า HTTP 201 พร้อม `{reportId, status: "submitted"}` เมื่อและเฉพาะเมื่อ Construction_Backend_Adapter ส่ง Citizen_Report ไปยัง Admin_Backend สำเร็จจริงเท่านั้น
8. IF Admin_Backend ไม่สามารถเข้าถึงได้ขณะส่ง Citizen_Report และการเก็บรายงานไว้ใน Pending_Report_Queue สำเร็จ, THEN THE `POST /api/reports` endpoint SHALL คืนค่า HTTP 202 พร้อม `{reportId, status: "queued"}` แทนการปฏิเสธคำขอ
9. IF การเก็บรายงานไว้ใน Pending_Report_Queue ล้มเหลว (เช่น queue เต็มหรือเกิดข้อผิดพลาดภายใน), THEN THE `POST /api/reports` endpoint SHALL คืนค่า HTTP 500 พร้อมข้อความ error เพื่อแจ้งผู้ใช้ว่ารายงานไม่ถูกบันทึก ไม่ใช่คืนค่า HTTP 202
10. WHEN Citizen_Report ที่อยู่ใน Pending_Report_Queue ถูกส่งซ้ำไปยัง Admin_Backend ในความพยายามครั้งต่อไป, THE Construction_Backend_Adapter SHALL ใช้ `id` เดิมของรายงานนั้น ไม่สร้าง `id` ใหม่

### Requirement 3: ยืนยัน Real_Navigation_Path เป็นเส้นทางการทำงานจริงเพียงหนึ่งเดียว

**User Story:** ในฐานะผู้ขับขี่ ฉันต้องการให้ตำแหน่งของฉันและเส้นทางนำทางเป็นข้อมูลจริง ไม่ใช่การจำลอง เพื่อให้ใช้นำทางได้จริงระหว่างเดินทาง

#### Acceptance Criteria

1. THE Traveler_App SHALL ใช้ `navigator.geolocation.watchPosition()` เป็นแหล่งตำแหน่งผู้ใช้ต่อเนื่องเพียงแหล่งเดียวสำหรับการนำทางและ proximity alert (ไม่มีเส้นทาง production อื่นที่ใช้ตำแหน่งจำลอง)
2. THE Traveler_App SHALL ใช้ผลลัพธ์จาก OSRM ผ่าน `/api/navigation/directions` เป็นแหล่งข้อมูลเส้นทางเพียงแหล่งเดียวที่แสดงบนแผนที่สำหรับการนำทางจริง
3. THE Traveler_App SHALL ใช้ผลลัพธ์จาก Nominatim ผ่าน `/api/navigation/geocode` เป็นแหล่งข้อมูล geocoding เพียงแหล่งเดียวสำหรับค้นหาสถานที่จากชื่อ/ที่อยู่
4. THE Demo_Alert_Helper (`testConstructionAlert()`) SHALL คงเป็นเครื่องมือสำหรับ demo/dev เท่านั้น และ SHALL ไม่ถูกเรียกจากเส้นทาง production ใดๆ ของการนำทางหรือการติดตามตำแหน่ง
5. IF การเรียก OSRM, Nominatim, หรือ Overpass API ล้มเหลว (non-200, timeout, malformed response, ข้อมูล field ที่จำเป็นหายไป), THEN THE Traveler_App SHALL คืนค่า HTTP 502 พร้อมข้อความ error ที่บรรยายปัญหา และ SHALL ไม่ panic — Traveler_App SHALL คืนค่า HTTP 502 เมื่อและเฉพาะเมื่อการเรียก API ล้มเหลวจริงเท่านั้น ไม่ใช่เมื่อ API เรียกสำเร็จ
6. THE Traveler_App SHALL จำกัดเวลาการรอผลลัพธ์ (timeout) ของการเรียก OSRM/Nominatim/Overpass ต่อครั้งไว้ไม่เกิน 8 วินาที

### Requirement 4: Driver_Alert (proximity alert) ที่มีอยู่ยังคงทำงานถูกต้องตามเดิม

**User Story:** ในฐานะผู้ขับขี่ ฉันต้องการได้รับการแจ้งเตือนเมื่อเข้าใกล้โซนก่อสร้างอย่างสม่ำเสมอและไม่ถูกแจ้งซ้ำเกินความจำเป็น

#### Acceptance Criteria

1. THE Traveler_App SHALL คงพฤติกรรมเดิมของ `alerts.js` ไว้โดยไม่แก้ไข logic การคำนวณระยะ (Haversine), รัศมีแจ้งเตือน 500 เมตร, และช่วง suppress 5 นาที ที่มีอยู่แล้ว
2. WHILE ผู้ใช้อยู่ในระยะ 500 เมตรจากโซนก่อสร้างที่ published, THE Traveler_App SHALL แสดง Driver_Alert เว้นแต่โซนนั้นอยู่ในช่วง suppress (5 นาทีหลังแจ้งเตือนครั้งล่าสุดและยังไม่ออกนอกระยะ)
3. WHEN ผู้ใช้ออกนอกระยะ 500 เมตรจากโซนที่เคยถูก suppress แล้วกลับเข้ามาใหม่, THE Traveler_App SHALL แจ้งเตือนซ้ำได้อีกครั้งโดยไม่ติดช่วง suppress เดิม

### Requirement 5: Voice_Context contract ของฟีเจอร์ push-to-talk ไม่ถูกแก้ไข

**User Story:** ในฐานะผู้ดูแลฟีเจอร์ push-to-talk ฉันต้องการมั่นใจว่าการเปลี่ยนแปลงจาก integration นี้ไม่ทำให้ contract ที่มีอยู่แล้วเสียหาย

#### Acceptance Criteria

1. THE `ChatRequest` struct ใน `chat.rs` SHALL ไม่มีการเพิ่ม แก้ไข หรือลบ field ใดๆ อันเป็นผลจาก requirements นี้
2. WHEN คำขอไปยัง `/api/chat` ไม่มี field `voice_context`, THE `chat_handler` SHALL ประมวลผลได้เหมือนก่อนมี requirements นี้ทุกประการ
3. THE `build_voice_context_prompt_fragment` function SHALL คงพฤติกรรม input-output เดิมไว้ทุกกรณี (regression ต้องผ่าน property test 19/20 เดิมที่มีอยู่แล้วใน `chat.rs`)

### Requirement 6: การยืนยันตัวตนระหว่าง Traveler_App และ Admin_Backend (service-to-service)

**User Story:** ในฐานะทีมพัฒนา ฉันต้องการให้การเรียก Admin_Backend จาก Http_Backend มีการยืนยันตัวตนอย่างน้อยในระดับพื้นฐาน เพื่อไม่ให้ endpoint ของอีกทีมเปิดรับข้อมูลจากใครก็ได้โดยไม่มีการควบคุมเลย

#### Acceptance Criteria

1. WHEN Http_Backend เรียก Admin_Backend, THE Http_Backend SHALL แนบ Shared_Service_Token ผ่าน HTTP header `X-Yanang-Key` ที่อ่านค่ามาจากตัวแปรสภาพแวดล้อม
2. THE Traveler_App SHALL ยังคงเปิดให้เข้าถึง `GET /api/construction/projects`, `POST /api/reports`, และ `/api/navigation/*` โดยไม่มีการยืนยันตัวตนของผู้ใช้ปลายทาง (browser) ตามแนวทางปัจจุบันของระบบ — requirements นี้ต้องระบุข้อจำกัดนี้ไว้อย่างชัดเจนในเอกสาร ไม่ปกปิด
3. THE design SHALL บันทึกไว้อย่างชัดเจนว่าการยืนยันตัวตนแบบเต็มรูปแบบ (per-citizen auth, signed requests, mutual TLS) ไม่ได้อยู่ในขอบเขตของ requirements นี้ และเป็นการตัดสินใจเลื่อนออกไปอย่างมีสติ ไม่ใช่การมองข้าม

### Requirement 7: Data model ของ Citizen_Report สอดคล้องกับคำศัพท์ที่ใช้ร่วมกันทั้งระบบ

**User Story:** ในฐานะทีมที่จะสร้าง Admin_Backend ในอนาคต ฉันต้องการให้ field naming ของ Citizen_Report ตรงกับคำศัพท์ที่ใช้อยู่แล้วใน `DATA_AND_AND.md` เพื่อไม่ต้องแปลงข้อมูลไปมาโดยไม่จำเป็น

#### Acceptance Criteria

1. THE `CitizenReport` struct SHALL ใช้ชื่อ field และค่า enum ที่สอดคล้องกับ `Feedback` ที่นิยามไว้ใน `DATA_AND_AND.md` (A7) ได้แก่ `problemType` (5 ค่าเดิม), `zoneId`, `description`, `status` (`pending`|`resolved`)
2. THE `ConstructionProject` struct ที่ Construction_Backend_Adapter ใช้งาน SHALL คงชื่อ field และรูปแบบ JSON (camelCase) เดิมที่ `map.js` ใช้อยู่แล้วไว้โดยไม่แก้ไข wire format

### Requirement 8: การต่อยอดด้วย katgpt-rs สำหรับ LLM differentiation (Optional/Stretch)

**User Story:** ในฐานะทีมที่ต้องการชิงรางวัล LLM application พิเศษของ hackathon ฉันต้องการสำรวจว่ามีความสามารถใดใน katgpt-rs ที่นำมาต่อยอดกับ ย่านาง AI ได้อย่างสมเหตุสมผลภายในเวลาที่มีจำกัด โดยไม่เสี่ยงต่อ core deliverable

#### Acceptance Criteria

1. IF ทีมเลือกดำเนินการตาม Requirement นี้, THEN การต่อยอดนั้น SHALL อ้างอิงจาก crate ที่มีอยู่จริงใน `/home/eggchad/eakject/research/Deep_Man/katgpt-rs/crates/` เท่านั้น ไม่ใช่ความสามารถที่สมมติขึ้น
2. Requirement นี้ SHALL ไม่ถูกดำเนินการก่อน Requirement 1-7 เสร็จสมบูรณ์และผ่านการทดสอบแล้ว
3. IF ไม่มีแนวทางต่อยอดที่ชัดเจนและทำได้ภายในเวลาที่เหลือ, THEN ทีม SHALL ข้าม Requirement นี้ไปทั้งหมดโดยไม่ถือว่าเป็นความล้มเหลวของ integration นี้
