// ย่านาง AI — Driver Alerts (proximity ต่อโซนก่อสร้าง)
// ระยะจริงคำนวณจาก Haversine + geolocation watchPosition (เรียกจาก map.js)
// พอร์ตแนวคิดมาจาก gps-astro/public/js/alerts.js แต่ใช้ constructionProjects ของ yanang-ai

const ALERT_RADIUS_M = 500;
const ALERT_SUPPRESS_MS = 5 * 60 * 1000; // 5 นาที ไม่แจ้งซ้ำโซนเดิม
const ALERT_DISPLAY_MS = 6000;

const suppressedAlerts = new Map(); // zoneId → { timestamp, exited }
const alertHistory = [];
let alertContainer = null;

function haversineM(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function checkProximity(userLat, userLng) {
    const projects = window.constructionProjects || [];
    if (projects.length === 0) return;

    const inRange = projects
        .map(zone => ({ zone, distance: haversineM(userLat, userLng, zone.lat, zone.lng) }))
        .filter(item => item.distance <= ALERT_RADIUS_M)
        .sort((a, b) => a.distance - b.distance);

    inRange.forEach(({ zone, distance }) => {
        const suppressed = suppressedAlerts.get(zone.id);
        const now = Date.now();
        if (suppressed && !suppressed.exited && (now - suppressed.timestamp) < ALERT_SUPPRESS_MS) {
            return; // ยังอยู่ในช่วง suppress — ไม่แจ้งซ้ำ
        }
        triggerAlert(zone, distance);
        suppressedAlerts.set(zone.id, { timestamp: now, exited: false });
    });

    // mark exited zones so ครั้งถัดไปที่เข้าใกล้จะแจ้งใหม่ได้
    suppressedAlerts.forEach((state, zoneId) => {
        const zone = projects.find(p => p.id === zoneId);
        if (!zone) return;
        const dist = haversineM(userLat, userLng, zone.lat, zone.lng);
        if (dist > ALERT_RADIUS_M) state.exited = true;
    });
}

function triggerAlert(zone, distanceM) {
    const isDangerous = zone.complianceVerdict === 'fail';

    const alert = {
        id: `alert-${Date.now()}-${zone.id}`,
        zoneId: zone.id,
        projectName: zone.name,
        roadName: zone.roadName || '',
        closedLanes: zone.closedLanes || 'บางช่องจราจร',
        speedLimit: zone.speedLimit || 60,
        distanceM: Math.round(distanceM),
        triggeredAt: new Date().toISOString(),
        isDangerous,
    };

    alertHistory.unshift(alert);
    showAlertBanner(alert);

    if (window.addChat) {
        const msg = isDangerous
            ? `🚨 อันตราย! ${zone.name} ไม่ผ่านมาตรฐาน อยู่ข้างหน้า ${alert.distanceM} เมตร`
            : `🚧 งานก่อสร้าง ${zone.name} อยู่ข้างหน้า ${alert.distanceM} เมตร`;
        window.addChat('ai', msg);
        if (window.speakThai) window.speakThai(msg);
    }
}

function showAlertBanner(alert) {
    if (!alertContainer) {
        alertContainer = document.createElement('div');
        alertContainer.className = 'driver-alert-container';
        alertContainer.setAttribute('aria-live', 'assertive');
        document.body.appendChild(alertContainer);
    }

    const banner = document.createElement('div');
    banner.className = `driver-alert-banner ${alert.isDangerous ? 'danger-alert' : ''}`;

    const headerText = alert.isDangerous
        ? `🚨 อันตราย! งานก่อสร้างไม่ผ่านมาตรฐาน — ${alert.distanceM} ม. ข้างหน้า`
        : `🚧 งานก่อสร้างข้างหน้า ${alert.distanceM} ม.`;
    const subText = alert.isDangerous
        ? 'พื้นที่นี้ไม่ผ่านการตรวจสอบมาตรฐานความปลอดภัย'
        : 'กรุณาลดความเร็วและขับขี่ด้วยความระมัดระวัง';

    banner.innerHTML = `
        <div class="alert-icon">${alert.isDangerous ? '🚨' : '⚠️'}</div>
        <div class="alert-content">
            <strong>${headerText}</strong>
            <p>${alert.projectName}</p>
            <div class="alert-details">
                <span>🛣️ ${alert.roadName}</span>
                <span>🚗 จำกัด ${alert.speedLimit} กม./ชม.</span>
                <span>🚧 ${alert.closedLanes}</span>
            </div>
            <small>${subText}</small>
        </div>
        <button class="alert-dismiss" aria-label="ปิด">✕</button>
    `;

    banner.querySelector('.alert-dismiss').addEventListener('click', () => {
        banner.classList.remove('alert-visible');
        setTimeout(() => banner.remove(), 300);
    });

    alertContainer.appendChild(banner);
    requestAnimationFrame(() => banner.classList.add('alert-visible'));

    const dismissTime = alert.isDangerous ? 10000 : ALERT_DISPLAY_MS;
    setTimeout(() => {
        if (banner.parentNode) {
            banner.classList.remove('alert-visible');
            setTimeout(() => banner.remove(), 300);
        }
    }, dismissTime);
}

// ── สำหรับ demo: จำลองตำแหน่งโดยไม่ต้องรอ GPS จริง ──
function simulateProximity(lat, lng) {
    checkProximity(lat, lng);
}

// ── สำหรับ Voice_Controller: หาโครงการก่อสร้างใกล้ตำแหน่งผู้ใช้ (ใช้แนบไปกับ /api/chat) ──
// Pure — reuse haversineM เดิม, ไม่แก้ ALERT_RADIUS_M (500m) ที่ใช้กับ proximity alert ปกติ
// เพราะ Voice_Context_Payload ใช้รัศมี 1km ตามที่ระบุใน glossary ของ requirements
function getNearbyProjects(lat, lng, maxDistanceM = 1000) {
    const projects = window.constructionProjects || [];
    return projects
        .map((zone) => ({ zone, distance: haversineM(lat, lng, zone.lat, zone.lng) }))
        .filter((item) => item.distance <= maxDistanceM)
        .sort((a, b) => a.distance - b.distance)
        .map(({ zone, distance }) => ({
            name: zone.name,
            roadName: zone.roadName || '',
            distanceM: Math.round(distance),
            complianceVerdict: zone.complianceVerdict || 'pending',
        }));
}

window.DriverAlerts = {
    checkProximity,
    simulateProximity,
    getAlertHistory: () => alertHistory,
    getNearbyProjects,
};
