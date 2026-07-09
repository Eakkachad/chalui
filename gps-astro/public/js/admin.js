/**
 * Admin Module — DOH Admin approval queue, feedback management, KPI
 */

// ─── Cross-Tab Compliance Sync Helper ───
function broadcastComplianceSync() {
  try {
    if (!window._complianceChannel) {
      window._complianceChannel = new BroadcastChannel("gps-compliance-sync");
    }
    const state = {};
    if (typeof projects !== 'undefined') {
      projects.forEach(p => {
        if (p.complianceVerdict !== undefined || p.publishedToDrivers !== undefined || p.status) {
          state[p.id] = {
            complianceVerdict: p.complianceVerdict,
            publishedToDrivers: p.publishedToDrivers,
            complianceScore: p.complianceScore,
            complianceReportId: p.complianceReportId,
            status: p.status,
            rejectReason: p.rejectReason,
            needsReaudit: p.needsReaudit
          };
        }
      });
    }
    window._complianceChannel.postMessage({ type: "compliance-update", state });
    console.log("[Sync] Admin broadcast compliance update");
  } catch (e) {
    console.warn("[Sync] BroadcastChannel error:", e.message);
  }
}

function initAdmin() {
  // Tab switching (use data-admin-tab, NOT filter-chip class, to avoid
  // colliding with the sidebar filter handler in script.js)
  document.querySelectorAll('[data-admin-tab]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('[data-admin-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.adminTab;
      document.getElementById('adminQueue').hidden = tab !== 'queue';
      document.getElementById('adminFeedback').hidden = tab !== 'feedback';
      document.getElementById('adminKpi').hidden = tab !== 'kpi';
      if (tab === 'queue') renderAdminQueue();
      if (tab === 'feedback') renderAdminFeedback();
      if (tab === 'kpi') renderAdminKpi();
    });
  });

  // Render on nav click
  document.querySelector('[data-nav="admin"]')?.addEventListener('click', () => {
    setTimeout(renderAdminQueue, 100);
  });
}

function renderAdminQueue() {
  const container = document.getElementById('adminQueueList');
  if (!container) return;
  if (typeof projects === 'undefined') { container.innerHTML = '<div class="empty-state">ไม่มีข้อมูล</div>'; return; }

  // AI accuracy banner (human-in-the-loop monitoring)
  const stats = (window.AiAuditor && window.AiAuditor.getAiAccuracyStats)
    ? window.AiAuditor.getAiAccuracyStats() : null;
  let accuracyBanner = '';
  if (stats && stats.validated > 0) {
    accuracyBanner = `
      <div class="ai-accuracy-banner">
        🧠 AI แม่นยำ <strong>${stats.accuracy}%</strong>
        (admin ยืนยัน ${stats.agreed}/${stats.validated} • override ${stats.overridden})
      </div>`;
  }

  // Zones that AI has audited and are awaiting admin validation
  const pendingReview = projects.filter(p => p.adminDecision === 'pending');
  // Zones awaiting first submission approval (legacy planned)
  const pendingApproval = projects.filter(p => p.status === 'planned' && !p.adminDecision);

  if (pendingReview.length === 0 && pendingApproval.length === 0) {
    container.innerHTML = accuracyBanner + '<div class="empty-state">ไม่มีรายการรอตรวจสอบ — AI ตรวจครบแล้ว ✅</div>';
    return;
  }

  // Sort pendingReview: low AI confidence first (needs human attention most)
  pendingReview.sort((a, b) => (a.aiConfidence || 0) - (b.aiConfidence || 0));

  const reviewCards = pendingReview.map(zone => {
    const conf = zone.aiConfidence != null ? zone.aiConfidence : 0;
    const confColor = conf >= 80 ? '#22c55e' : conf >= 60 ? '#eab308' : '#ef4444';
    const confLabel = conf >= 80 ? 'มั่นใจสูง' : conf >= 60 ? 'มั่นใจปานกลาง' : 'ต้องตรวจละเอียด';
    const aiVerdict = zone.aiVerdict === 'pass' ? '✅ AI: ผ่าน' : '❌ AI: ไม่ผ่าน';
    const flipTo = zone.aiVerdict === 'pass' ? 'fail' : 'pass';
    const flipLabel = zone.aiVerdict === 'pass' ? 'แก้เป็น ไม่ผ่าน' : 'แก้เป็น ผ่าน';
    return `
      <div class="admin-queue-card review-card ${conf < 60 ? 'low-conf' : ''}">
        <div class="queue-info">
          <strong>${zone.name}</strong>
          <span>${zone.roadName || ''} — ${zone.contractor}</span>
          <span>${aiVerdict} | Score: ${zone.aiScore != null ? zone.aiScore : '—'}/100</span>
          <span class="ai-conf-badge" style="color:${confColor}">
            🎯 AI มั่นใจ ${conf}% — ${confLabel}
          </span>
        </div>
        <div class="queue-actions">
          <button class="confirm-btn" data-zone-id="${zone.id}" type="button">✓ ยืนยันตาม AI</button>
          <button class="override-btn" data-zone-id="${zone.id}" data-flip="${flipTo}" type="button">✎ ${flipLabel}</button>
        </div>
      </div>
    `;
  }).join('');

  const approvalCards = pendingApproval.map(zone => `
      <div class="admin-queue-card">
        <div class="queue-info">
          <strong>${zone.name}</strong>
          <span>${zone.roadName || ''} — ${zone.contractor}</span>
          <span>⏳ ยังไม่ได้ส่ง AI ตรวจ</span>
        </div>
        <div class="queue-actions">
          <button class="approve-btn" data-zone-id="${zone.id}" type="button">✓ อนุมัติ</button>
          <button class="reject-btn" data-zone-id="${zone.id}" type="button">✕ ปฏิเสธ</button>
        </div>
      </div>
  `).join('');

  container.innerHTML = accuracyBanner
    + (reviewCards ? `<div class="queue-section-label">🧠 AI ตรวจแล้ว — รอ admin ยืนยัน (${pendingReview.length})</div>` + reviewCards : '')
    + (approvalCards ? `<div class="queue-section-label">📋 รออนุมัติเบื้องต้น (${pendingApproval.length})</div>` + approvalCards : '');

  // Bind human-in-the-loop: confirm / override
  container.querySelectorAll('.confirm-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (window.AiAuditor) window.AiAuditor.adminConfirmVerdict(parseInt(btn.dataset.zoneId));
      renderAdminQueue();
    });
  });
  container.querySelectorAll('.override-btn').forEach(btn => {
    btn.addEventListener('click', () => openOverrideModal(parseInt(btn.dataset.zoneId), btn.dataset.flip));
  });

  // Legacy approve/reject
  container.querySelectorAll('.approve-btn').forEach(btn => {
    btn.addEventListener('click', () => approveZone(parseInt(btn.dataset.zoneId)));
  });
  container.querySelectorAll('.reject-btn').forEach(btn => {
    btn.addEventListener('click', () => rejectZone(parseInt(btn.dataset.zoneId)));
  });
}

/**
 * Override modal — admin disagrees with AI, must give a reason (audit trail).
 */
function openOverrideModal(zoneId, flipTo) {
  document.getElementById('overrideModal')?.remove();
  const zone = projects.find(p => p.id === zoneId);
  if (!zone) return;

  const newLabel = flipTo === 'pass' ? 'ผ่านมาตรฐาน' : 'ไม่ผ่านมาตรฐาน';
  const modal = document.createElement('div');
  modal.id = 'overrideModal';
  modal.className = 'reject-modal';
  modal.innerHTML = `
    <div class="reject-modal-panel">
      <h3>✎ แก้ผล AI: ${zone.name}</h3>
      <p style="font-size:0.85rem;color:#68746f;margin:4px 0 12px">
        AI ตัดสินว่า <strong>${zone.aiVerdict === 'pass' ? 'ผ่าน' : 'ไม่ผ่าน'}</strong>
        (มั่นใจ ${zone.aiConfidence || 0}%) — คุณกำลังแก้เป็น <strong>${newLabel}</strong>
      </p>
      <label>
        <span>เหตุผลที่แก้ผล AI (อย่างน้อย 10 ตัวอักษร)</span>
        <textarea id="overrideReasonInput" rows="3" placeholder="เช่น รูปมุมอื่นเห็นกรวยครบ / AI นับพลาดเพราะแสงจ้า"></textarea>
      </label>
      <div class="reject-modal-error" id="overrideModalError" hidden></div>
      <div class="reject-modal-actions">
        <button class="secondary-action" id="overrideCancel" type="button">ยกเลิก</button>
        <button class="reject-btn" id="overrideConfirm" type="button">ยืนยันแก้ผล</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const input = modal.querySelector('#overrideReasonInput');
  const errorEl = modal.querySelector('#overrideModalError');
  input.focus();

  modal.querySelector('#overrideCancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

  modal.querySelector('#overrideConfirm').addEventListener('click', () => {
    const reason = input.value.trim();
    if (reason.length < 10) {
      errorEl.textContent = 'กรุณาระบุเหตุผลอย่างน้อย 10 ตัวอักษร';
      errorEl.hidden = false;
      return;
    }
    if (window.AiAuditor) window.AiAuditor.adminOverrideVerdict(zoneId, flipTo, reason);
    modal.remove();
    renderAdminQueue();
  });
}

function approveZone(zoneId) {
  const zone = projects.find(p => p.id === zoneId);
  if (!zone) return;
  zone.status = 'in-progress';
  zone.publishedToDrivers = true;
  zone.approvedAt = new Date().toISOString();

  // Send update to server
  fetch('/api/projects', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(zone)
  }).catch(err => console.error("Failed to update approved zone:", err));

  if (typeof renderAll === 'function') renderAll();
  if (typeof renderMarkers === 'function') renderMarkers();
  if (window.AiAuditor && window.AiAuditor.persistComplianceState) window.AiAuditor.persistComplianceState();
  broadcastComplianceSync();
  if (typeof showToast === 'function') showToast(`✅ อนุมัติ: ${zone.name}`);
  renderAdminQueue();
}

function rejectZone(zoneId) {
  const zone = projects.find(p => p.id === zoneId);
  if (!zone) return;
  openRejectModal(zone);
}

function openRejectModal(zone) {
  // Remove any existing modal
  document.getElementById('rejectModal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'rejectModal';
  modal.className = 'reject-modal';
  modal.innerHTML = `
    <div class="reject-modal-panel">
      <h3>ปฏิเสธ: ${zone.name}</h3>
      <label>
        <span>เหตุผลที่ปฏิเสธ (อย่างน้อย 10 ตัวอักษร)</span>
        <textarea id="rejectReasonInput" rows="3" placeholder="เช่น รูปถ่ายไม่ชัดเจน / ข้อมูลไม่ครบถ้วน"></textarea>
      </label>
      <div class="reject-modal-error" id="rejectModalError" hidden></div>
      <div class="reject-modal-actions">
        <button class="secondary-action" id="rejectCancel" type="button">ยกเลิก</button>
        <button class="reject-btn" id="rejectConfirm" type="button">ยืนยันปฏิเสธ</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const input = modal.querySelector('#rejectReasonInput');
  const errorEl = modal.querySelector('#rejectModalError');
  input.focus();

  modal.querySelector('#rejectCancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

  modal.querySelector('#rejectConfirm').addEventListener('click', () => {
    const reason = input.value.trim();
    if (reason.length < 10) {
      errorEl.textContent = 'กรุณาระบุเหตุผลอย่างน้อย 10 ตัวอักษร';
      errorEl.hidden = false;
      return;
    }
    zone.rejectReason = reason;
    zone.publishedToDrivers = false;
    zone.rejectedAt = new Date().toISOString();
    zone.rejectedBy = 'admin';

    // Send update to server
    fetch('/api/projects', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(zone)
    }).catch(err => console.error("Failed to update rejected zone:", err));

    if (typeof renderAll === 'function') renderAll();
    if (typeof renderMarkers === 'function') renderMarkers();
    if (typeof showToast === 'function') showToast(`❌ ปฏิเสธ: ${zone.name}`);
    if (window.AiAuditor && window.AiAuditor.persistComplianceState) window.AiAuditor.persistComplianceState();
    broadcastComplianceSync();
    modal.remove();
    renderAdminQueue();
  });
}

function renderAdminFeedback() {
  const container = document.getElementById('adminFeedbackList');
  if (!container) return;

  const list = window.FeedbackModule ? window.FeedbackModule.getFeedbackList() : [];
  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state">ไม่มี feedback จากประชาชน</div>';
    return;
  }

  container.innerHTML = list.map(fb => {
    const type = window.FeedbackModule.PROBLEM_TYPES[fb.problemType] || { label: fb.problemType };
    const statusLabel = fb.status === 'resolved' ? '✅ ดำเนินการแล้ว' : '⏳ รอตรวจสอบ';
    return `
      <div class="admin-queue-card">
        <div class="queue-info">
          <strong>${type.label}</strong>
          <span>${fb.zoneName || 'ไม่ระบุ zone'} — ${new Date(fb.createdAt).toLocaleString('th-TH')}</span>
          ${fb.description ? `<small>"${fb.description.slice(0, 80)}..."</small>` : ''}
          <span>${statusLabel}</span>
        </div>
        ${fb.status === 'pending' ? `<div class="queue-actions"><button class="approve-btn" data-fb-id="${fb.id}" type="button">✓ ดำเนินการแล้ว</button></div>` : ''}
      </div>
    `;
  }).join('');

  container.querySelectorAll('.approve-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const fb = list.find(f => f.id === btn.dataset.fbId);
      if (fb) {
        fb.status = 'resolved';
        fb.resolvedAt = new Date().toISOString();
        fb.resolvedBy = 'admin';
        if (typeof showToast === 'function') showToast('✅ อัปเดตสถานะ feedback แล้ว');
        renderAdminFeedback();
      }
    });
  });
}

function renderAdminKpi() {
  const container = document.getElementById('adminKpiList');
  if (!container) return;
  if (typeof projects === 'undefined') { container.innerHTML = '<div class="empty-state">ไม่มีข้อมูล</div>'; return; }

  // AI reliability card (human-in-the-loop monitoring)
  let aiCard = '';
  const stats = (window.AiAuditor && window.AiAuditor.getAiAccuracyStats)
    ? window.AiAuditor.getAiAccuracyStats() : null;
  if (stats && stats.validated > 0) {
    const accColor = stats.accuracy >= 90 ? '🟢' : stats.accuracy >= 70 ? '🟡' : '🔴';
    aiCard = `
      <div class="admin-queue-card" style="border-left:4px solid #1e3a5f">
        <div class="queue-info">
          <strong>🧠 ความแม่นยำ AI (ตรวจสอบโดย admin)</strong>
          <span>ตรวจสอบแล้ว ${stats.validated} โครงการ | admin เห็นด้วย ${stats.agreed} | override ${stats.overridden}</span>
          <span>ความแม่นยำ: <strong>${accColor} ${stats.accuracy}%</strong></span>
        </div>
      </div>`;
  }

  // Group by contractor
  const contractors = {};
  projects.forEach(p => {
    if (!contractors[p.contractor]) {
      contractors[p.contractor] = { name: p.contractor, zones: 0, passed: 0, failed: 0, feedback: 0 };
    }
    contractors[p.contractor].zones++;
    if (p.complianceVerdict === 'pass') contractors[p.contractor].passed++;
    if (p.complianceVerdict === 'fail') contractors[p.contractor].failed++;
  });

  // Count feedback per contractor
  const fbList = window.FeedbackModule ? window.FeedbackModule.getFeedbackList() : [];
  fbList.forEach(fb => {
    if (fb.contractorName && contractors[fb.contractorName]) {
      contractors[fb.contractorName].feedback++;
    }
  });

  const entries = Object.values(contractors);
  if (entries.length === 0) {
    container.innerHTML = '<div class="empty-state">ไม่มีข้อมูลผู้รับเหมา</div>';
    return;
  }

  container.innerHTML = aiCard + entries.map(c => {
    const score = Math.max(0, 100 - (c.failed * 15) - (c.feedback * 5));
    const grade = score >= 80 ? '🟢 ดี' : score >= 60 ? '🟡 พอใช้' : '🔴 ต้องปรับปรุง';
    return `
      <div class="admin-queue-card">
        <div class="queue-info">
          <strong>${c.name}</strong>
          <span>โครงการ: ${c.zones} | ผ่าน: ${c.passed} | ไม่ผ่าน: ${c.failed} | Feedback: ${c.feedback}</span>
          <span>KPI: <strong>${score}/100</strong> ${grade}</span>
        </div>
      </div>
    `;
  }).join('');
}

// Expose
window.AdminModule = { renderAdminQueue, renderAdminFeedback, renderAdminKpi, approveZone, rejectZone };

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdmin);
} else {
  initAdmin();
}
