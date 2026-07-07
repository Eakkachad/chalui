/**
 * Feedback Module — Citizen construction site issue reporting
 * 
 * Drivers can report problems at construction sites. Feedback is linked
 * to the nearest zone and flows back as a compliance signal (Closed Loop).
 * 
 * Rate limiting: max 5 submissions per 10 minutes per session.
 */

const FEEDBACK_RATE_LIMIT = 5;
const FEEDBACK_RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const FEEDBACK_DESC_MAX = 500;

const PROBLEM_TYPES = {
  no_cones: { label: '🔶 ไม่มีกรวยยาง / กรวยไม่ครบ', icon: '🔶' },
  no_sign: { label: '⚠️ ไม่มีป้ายเตือน / ป้ายไม่ชัดเจน', icon: '⚠️' },
  data_mismatch: { label: '📍 ข้อมูลในแอปไม่ตรงกับสภาพจริง', icon: '📍' },
  heavy_traffic: { label: '🚗 รถติดหนัก / ช่องจราจรไม่เพียงพอ', icon: '🚗' },
  other: { label: '💬 อื่นๆ', icon: '💬' }
};

// State
const feedbackList = [];
const submissionTimestamps = []; // for rate limiting
let feedbackPanel = null;

// ─── Rate limiting ───
function canSubmitFeedback() {
  const now = Date.now();
  // Remove timestamps older than window
  while (submissionTimestamps.length > 0 && (now - submissionTimestamps[0]) > FEEDBACK_RATE_WINDOW_MS) {
    submissionTimestamps.shift();
  }
  return submissionTimestamps.length < FEEDBACK_RATE_LIMIT;
}

function getRemainingCooldown() {
  if (submissionTimestamps.length < FEEDBACK_RATE_LIMIT) return 0;
  const oldest = submissionTimestamps[0];
  const remaining = FEEDBACK_RATE_WINDOW_MS - (Date.now() - oldest);
  return Math.max(0, Math.ceil(remaining / 1000));
}

// ─── Find nearest zone to coordinates ───
function findNearestZone(lat, lng) {
  if (typeof projects === 'undefined' || projects.length === 0) return null;

  let nearest = null;
  let minDist = Infinity;

  projects.forEach(p => {
    const dlat = (p.lat - lat) * 111320;
    const dlng = (p.lng - lng) * 111320 * Math.cos(lat * Math.PI / 180);
    const dist = Math.sqrt(dlat * dlat + dlng * dlng);
    if (dist < minDist) {
      minDist = dist;
      nearest = p;
    }
  });

  return nearest;
}

// ─── Submit feedback ───
function submitFeedback(data) {
  // Validate required field
  if (!data.problemType || !PROBLEM_TYPES[data.problemType]) {
    return { success: false, error: 'กรุณาเลือกประเภทปัญหา' };
  }

  // Validate description length
  if (data.description && data.description.length > FEEDBACK_DESC_MAX) {
    return { success: false, error: `คำอธิบายต้องไม่เกิน ${FEEDBACK_DESC_MAX} ตัวอักษร` };
  }

  // Rate limit check
  if (!canSubmitFeedback()) {
    const cooldown = getRemainingCooldown();
    return { success: false, error: `ส่งได้สูงสุด ${FEEDBACK_RATE_LIMIT} ครั้ง/10 นาที — รออีก ${cooldown} วินาที` };
  }

  // Find nearest zone
  const nearestZone = data.lat && data.lng ? findNearestZone(data.lat, data.lng) : null;

  const feedback = {
    id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    zoneId: nearestZone ? nearestZone.id : null,
    zoneName: nearestZone ? nearestZone.name : null,
    contractorName: nearestZone ? nearestZone.contractor : null,
    problemType: data.problemType,
    description: (data.description || '').slice(0, FEEDBACK_DESC_MAX),
    photoUrl: data.photoUrl || null,
    lat: data.lat || null,
    lng: data.lng || null,
    status: 'pending', // pending | resolved
    resolvedBy: null,
    resolvedAt: null,
    createdAt: new Date().toISOString()
  };

  feedbackList.unshift(feedback);
  submissionTimestamps.push(Date.now());

  // Check re-audit trigger (Closed Loop)
  if (nearestZone && typeof window.AiAuditor !== 'undefined') {
    window.AiAuditor.checkFeedbackReauditTrigger(nearestZone.id, feedbackList);
  }

  console.log(`[Feedback] Submitted: ${PROBLEM_TYPES[data.problemType].label} → zone: ${nearestZone ? nearestZone.name : 'none'}`);
  
  return { success: true, feedback };
}

// ─── Create feedback panel UI ───
function createFeedbackPanel() {
  if (document.getElementById('feedbackPanel')) return;

  const panel = document.createElement('div');
  panel.id = 'feedbackPanel';
  panel.className = 'feedback-panel';
  panel.setAttribute('aria-hidden', 'true');
  panel.innerHTML = `
    <header class="feedback-header">
      <div>
        <p class="eyebrow">Citizen Report</p>
        <h2>แจ้งปัญหาบนทางหลวง</h2>
      </div>
      <button class="panel-toggle" id="closeFeedbackPanel" type="button" aria-label="ปิด">X</button>
    </header>
    <form class="feedback-form" id="feedbackForm">
      <div class="feedback-types" id="feedbackTypes">
        <label><strong>ประเภทปัญหา *</strong></label>
        ${Object.entries(PROBLEM_TYPES).map(([key, val]) => `
          <label class="feedback-type-option">
            <input type="radio" name="feedbackType" value="${key}">
            <span>${val.label}</span>
          </label>
        `).join('')}
      </div>

      <label>
        <span>คำอธิบาย (ไม่บังคับ)</span>
        <textarea id="feedbackDesc" rows="3" maxlength="${FEEDBACK_DESC_MAX}" placeholder="อธิบายปัญหาที่พบ..."></textarea>
        <small class="char-counter"><span id="feedbackCharCount">0</span>/${FEEDBACK_DESC_MAX}</small>
      </label>

      <label>
        <span>รูปถ่าย (ไม่บังคับ)</span>
        <input type="file" id="feedbackPhoto" accept="image/*">
      </label>

      <div class="feedback-location" id="feedbackLocation">
        <small>📍 ตำแหน่ง: กำลังหา...</small>
      </div>

      <div class="feedback-linked-zone" id="feedbackLinkedZone"></div>

      <button class="primary-action feedback-submit" id="feedbackSubmitBtn" type="submit">
        ส่งรายงาน
      </button>

      <div class="feedback-error" id="feedbackError" hidden></div>
      <div class="feedback-success" id="feedbackSuccess" hidden></div>
    </form>
  `;

  document.body.appendChild(panel);
  feedbackPanel = panel;
  bindFeedbackEvents();
}

// ─── Bind events ───
function bindFeedbackEvents() {
  const form = document.getElementById('feedbackForm');
  const desc = document.getElementById('feedbackDesc');
  const charCount = document.getElementById('feedbackCharCount');
  const closeBtn = document.getElementById('closeFeedbackPanel');
  const locationEl = document.getElementById('feedbackLocation');
  const linkedZoneEl = document.getElementById('feedbackLinkedZone');

  // Char counter
  desc.addEventListener('input', () => {
    charCount.textContent = desc.value.length;
  });

  // Close
  closeBtn.addEventListener('click', closeFeedbackPanel);

  // Get location + link zone
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        locationEl.innerHTML = `<small>📍 ${latitude.toFixed(4)}, ${longitude.toFixed(4)}</small>`;
        locationEl.dataset.lat = latitude;
        locationEl.dataset.lng = longitude;

        const nearest = findNearestZone(latitude, longitude);
        if (nearest) {
          linkedZoneEl.innerHTML = `<small>🔗 เชื่อมกับ: <strong>${nearest.name}</strong></small>`;
        }
      },
      () => {
        locationEl.innerHTML = `<small>📍 ไม่สามารถระบุตำแหน่งได้</small>`;
      }
    );
  }

  // Submit
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('feedbackError');
    const successEl = document.getElementById('feedbackSuccess');
    errorEl.hidden = true;
    successEl.hidden = true;

    const typeInput = form.querySelector('input[name="feedbackType"]:checked');
    const lat = parseFloat(locationEl.dataset.lat) || null;
    const lng = parseFloat(locationEl.dataset.lng) || null;

    const result = submitFeedback({
      problemType: typeInput ? typeInput.value : null,
      description: desc.value.trim(),
      photoUrl: null, // mock — no real upload in POC
      lat,
      lng
    });

    if (!result.success) {
      errorEl.textContent = result.error;
      errorEl.hidden = false;
      return;
    }

    // Success
    successEl.textContent = '✅ ส่งรายงานสำเร็จ — ขอบคุณที่ช่วยรายงาน!';
    successEl.hidden = false;
    form.reset();
    charCount.textContent = '0';

    if (typeof showToast === 'function') {
      showToast('✅ ส่ง feedback สำเร็จ');
    }

    // Auto-close after 2s
    setTimeout(() => closeFeedbackPanel(), 2000);
  });
}

// ─── Show/hide panel ───
function openFeedbackPanel() {
  createFeedbackPanel();
  feedbackPanel.setAttribute('aria-hidden', 'false');
  feedbackPanel.style.display = 'block';
}

function closeFeedbackPanel() {
  if (feedbackPanel) {
    feedbackPanel.setAttribute('aria-hidden', 'true');
    feedbackPanel.style.display = 'none';
  }
}

/**
 * Ingest a citizen report (from the existing reports panel in script.js)
 * as a compliance-feedback signal. Maps report types → problem types,
 * links to nearest zone, and runs the re-audit trigger. This keeps ONE
 * reporting UI (the existing reports panel) while feeding the closed loop.
 */
function ingestReportAsFeedback(report) {
  const typeMap = {
    'Construction': 'data_mismatch',
    'Road Damage': 'other',
    'Accident': 'other',
    'Traffic': 'heavy_traffic',
    'Other': 'other'
  };
  const nearestZone = report.lat && report.lng ? findNearestZone(report.lat, report.lng) : null;
  const feedback = {
    id: `fb-${report.id}`,
    zoneId: nearestZone ? nearestZone.id : null,
    zoneName: nearestZone ? nearestZone.name : null,
    contractorName: nearestZone ? nearestZone.contractor : null,
    problemType: typeMap[report.type] || 'other',
    description: report.description || report.title || '',
    photoUrl: report.image || null,
    lat: report.lat || null,
    lng: report.lng || null,
    status: 'pending',
    resolvedBy: null,
    resolvedAt: null,
    createdAt: new Date(report.timestamp || Date.now()).toISOString()
  };
  feedbackList.unshift(feedback);

  if (nearestZone && typeof window.AiAuditor !== 'undefined') {
    window.AiAuditor.checkFeedbackReauditTrigger(nearestZone.id, feedbackList);
  }
  return feedback;
}

// ─── Init ───
function initFeedback() {
  // NOTE: We do NOT hijack the report FAB (script.js owns it → opens the
  // reports panel). Instead the closed-loop signal is fed via
  // ingestReportAsFeedback(), called from submitReport in script.js.
  // The standalone feedback panel remains available via
  // window.FeedbackModule.openFeedbackPanel() if needed.
}

// Expose globally
window.FeedbackModule = {
  submitFeedback,
  ingestReportAsFeedback,
  openFeedbackPanel,
  closeFeedbackPanel,
  getFeedbackList: () => feedbackList,
  PROBLEM_TYPES
};

// Auto-init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFeedback);
} else {
  initFeedback();
}
