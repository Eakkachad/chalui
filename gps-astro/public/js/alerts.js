/**
 * Driver Alerts Module — Proximity-based construction zone alerts
 * 
 * Detects when driver enters Alert_Radius (500m) of a published zone
 * and shows a toast-style alert. Includes suppression logic to avoid
 * spamming the same alert repeatedly.
 */

const ALERT_RADIUS_M = 500;
const ALERT_SUPPRESS_MS = 5 * 60 * 1000; // 5 minutes
const ALERT_DISPLAY_MS = 6000; // 6 seconds visible

// State
const suppressedAlerts = new Map(); // zoneId → { timestamp, exited }
const alertHistory = []; // newest first
let watchId = null;
let alertContainer = null;

// ─── Haversine distance (meters) ───
function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Check proximity against all published zones ───
function checkProximity(userLat, userLng) {
  if (typeof projects === 'undefined') return;

  // Get published zones only
  const published = projects.filter(p => {
    if (typeof window.AiAuditor !== 'undefined' && window.AiAuditor.isZonePublished) {
      return window.AiAuditor.isZonePublished(p);
    }
    return p.status !== 'completed';
  });

  // Calculate distances and filter within radius
  const inRange = published
    .map(zone => ({
      zone,
      distance: haversineM(userLat, userLng, zone.lat, zone.lng)
    }))
    .filter(item => item.distance <= ALERT_RADIUS_M)
    .sort((a, b) => a.distance - b.distance); // nearest first

  // Check suppression and trigger alerts
  inRange.forEach(({ zone, distance }) => {
    const suppressed = suppressedAlerts.get(zone.id);
    const now = Date.now();

    if (suppressed) {
      // Still within suppression window and hasn't exited
      if (!suppressed.exited && (now - suppressed.timestamp) < ALERT_SUPPRESS_MS) {
        return; // don't re-alert
      }
    }

    // Trigger alert
    triggerAlert(zone, distance);
    suppressedAlerts.set(zone.id, { timestamp: now, exited: false });
  });

  // Mark zones as exited if user moved away
  suppressedAlerts.forEach((state, zoneId) => {
    const zone = projects.find(p => p.id === zoneId);
    if (!zone) return;
    const dist = haversineM(userLat, userLng, zone.lat, zone.lng);
    if (dist > ALERT_RADIUS_M) {
      state.exited = true;
    }
  });
}

// ─── Trigger a driver alert ───
function triggerAlert(zone, distanceM) {
  // Check if zone failed compliance — if so, this is a DANGER alert
  const isDangerous = zone.isDangerous || zone.complianceVerdict === 'fail';

  const alert = {
    id: `alert-${Date.now()}-${zone.id}`,
    zoneId: zone.id,
    projectName: zone.name,
    roadName: zone.roadName || '',
    closedLanes: zone.closedLanes || 'บางช่องจราจร',
    speedLimit: zone.speedLimit || 60,
    distanceM: Math.round(distanceM),
    triggeredAt: new Date().toISOString(),
    dismissed: false,
    isDangerous
  };

  // Add to history (newest first)
  alertHistory.unshift(alert);

  // Show alert UI
  showAlertBanner(alert);

  console.log(`[Alert] ${isDangerous ? '🚨 DANGER' : '🚧'} ${zone.name} — ${Math.round(distanceM)}m away`);
}

// ─── Alert banner UI ───
function showAlertBanner(alert) {
  if (!alertContainer) {
    alertContainer = document.createElement('div');
    alertContainer.className = 'driver-alert-container';
    alertContainer.setAttribute('aria-live', 'assertive');
    document.body.appendChild(alertContainer);
  }

  const banner = document.createElement('div');
  banner.className = `driver-alert-banner ${alert.isDangerous ? 'danger-alert' : ''}`;
  
  const headerIcon = alert.isDangerous ? '🚨' : '⚠️';
  const headerText = alert.isDangerous 
    ? `🚨 อันตราย! งานก่อสร้างไม่ผ่านมาตรฐาน — ${alert.distanceM} ม. ข้างหน้า`
    : `🚧 งานก่อสร้างข้างหน้า ${alert.distanceM} ม.`;
  const subText = alert.isDangerous 
    ? 'พื้นที่นี้ไม่ผ่านการตรวจสอบมาตรฐานความปลอดภัย — กรมทางหลวงแจ้งลงตรวจแล้ว'
    : 'กรุณาลดความเร็วและขับขี่ด้วยความระมัดระวัง';

  banner.innerHTML = `
    <div class="alert-icon">${headerIcon}</div>
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

  // Dismiss on click
  banner.querySelector('.alert-dismiss').addEventListener('click', () => {
    banner.classList.remove('alert-visible');
    setTimeout(() => banner.remove(), 300);
  });

  alertContainer.appendChild(banner);

  // Animate in
  requestAnimationFrame(() => banner.classList.add('alert-visible'));

  // Auto-dismiss (danger alerts stay longer)
  const dismissTime = alert.isDangerous ? 10000 : ALERT_DISPLAY_MS;
  setTimeout(() => {
    if (banner.parentNode) {
      banner.classList.remove('alert-visible');
      setTimeout(() => banner.remove(), 300);
    }
  }, dismissTime);
}

// ─── Start watching position ───
function startProximityWatch() {
  if (!navigator.geolocation) {
    console.warn('[Alert] Geolocation not available');
    return;
  }

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      checkProximity(pos.coords.latitude, pos.coords.longitude);
    },
    (err) => {
      console.warn('[Alert] Geolocation error:', err.message);
    },
    { enableHighAccuracy: true, maximumAge: 5000 }
  );

  console.log('[Alert] Proximity watch started');
}

function stopProximityWatch() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    console.log('[Alert] Proximity watch stopped');
  }
}

// ─── Simulate proximity (for demo without real GPS) ───
function simulateProximity(lat, lng) {
  checkProximity(lat, lng);
}

// ─── Get alert history (newest first) ───
function getAlertHistory() {
  return alertHistory;
}

// ─── Render alert history in Notifications tab ───
function renderAlertHistory() {
  // Look for a notifications container (will be used when Notifications tab is active)
  const container = document.getElementById('alertHistoryList');
  if (!container) return;

  if (alertHistory.length === 0) {
    container.innerHTML = '<div class="empty-state">ยังไม่มีการแจ้งเตือน</div>';
    return;
  }

  container.innerHTML = alertHistory.map(alert => {
    const time = new Date(alert.triggeredAt).toLocaleString('th-TH');
    return `
      <div class="alert-history-item">
        <div class="alert-history-icon">🚧</div>
        <div class="alert-history-content">
          <strong>${alert.projectName}</strong>
          <span>${alert.roadName} — ${alert.distanceM} ม.</span>
          <small>${time}</small>
        </div>
      </div>
    `;
  }).join('');
}

// ─── Init ───
function initAlerts() {
  // Auto-start proximity watch if geolocation available
  startProximityWatch();

  // Add simulate button for demo (triggers alert from first in-progress zone)
  const navAlerts = document.querySelector('[data-nav="alerts"]');
  if (navAlerts) {
    navAlerts.addEventListener('click', () => {
      renderAlertHistory();
    });
  }
}

// Expose globally
window.DriverAlerts = {
  startProximityWatch,
  stopProximityWatch,
  simulateProximity,
  checkProximity,
  getAlertHistory,
  renderAlertHistory,
  alertHistory
};

// Auto-init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAlerts);
} else {
  initAlerts();
}
