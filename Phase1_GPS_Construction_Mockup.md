# Phase 1 - GPS Construction Platform (Mockup)

## Objective

สร้าง Web Application Prototype ที่มีหน้าตาและการใช้งานใกล้เคียง Google Maps
โดยใช้ HTML, CSS และ JavaScript เพื่อใช้เป็นต้นแบบสำหรับระบบติดตามโครงการก่อสร้าง

## Technology Stack

-   HTML5
-   CSS3
-   JavaScript (Vanilla)
-   Leaflet.js
-   OpenStreetMap
-   Font Awesome

## Project Structure

``` text
gps-construction/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── script.js
├── assets/
│   ├── icons/
│   └── images/
└── README.md
```

## Features

### Interactive Map

-   [ ] แสดงแผนที่ประเทศไทย
-   [ ] Zoom / Pan
-   [ ] แสดงจังหวัด ถนน แม่น้ำ อาคาร

### Search

-   [ ] Search Bar
-   [ ] Enter เพื่อค้นหา
-   [ ] Zoom ไปยังผลลัพธ์
-   [ ] Marker ผลลัพธ์

### Current Location

-   [ ] ปุ่มตำแหน่งปัจจุบัน
-   [ ] ขอสิทธิ์ Location
-   [ ] Marker ผู้ใช้

### Construction Markers

-   [ ] Completed (เขียว)
-   [ ] In Progress (เหลือง)
-   [ ] Delayed (แดง)
-   [ ] Planned (น้ำเงิน)

### Marker Popup

-   [ ] ชื่อโครงการ
-   [ ] สถานะ
-   [ ] ผู้รับเหมา
-   [ ] วันที่เริ่ม/สิ้นสุด
-   [ ] View Detail

### Sidebar

-   [ ] รายการโครงการ
-   [ ] คลิกเพื่อซูมไป Marker
-   [ ] Highlight รายการ

### Bottom Navigation

-   [ ] Home
-   [ ] Projects
-   [ ] AI
-   [ ] Notifications
-   [ ] Profile

### Floating Buttons

-   [ ] Current Location
-   [ ] Zoom In
-   [ ] Zoom Out

### Status Legend

-   [ ] Completed
-   [ ] In Progress
-   [ ] Delayed
-   [ ] Planned

### Responsive

-   [ ] Desktop
-   [ ] Tablet
-   [ ] Mobile

## Sample Data

สร้างข้อมูลตัวอย่าง 20--30 โครงการทั่วประเทศไทย

## Deliverables

-   Interactive Thailand Map
-   Search
-   Current Location
-   Construction Markers
-   Popup
-   Sidebar
-   Bottom Navigation
-   Responsive UI

## Out of Scope

-   Login
-   Database
-   AI Assistant
-   Voice Assistant
-   Route Navigation
-   Real-time Updates
-   Upload Images
