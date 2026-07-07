/**
 * Admin Module — DOH Admin approval queue, feedback management, KPI
 */

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

  const pending = projects.filter(p => p.status === 'planned');
  if (pending.length === 0) {
    container.innerHTML = '<div class="empty-state">ไม่มีรายการรออนุมัติ</div>';
    return;
  }

  container.innerHTML = pending.map(zone => {
    const score = zone.complianceScore != null ? zone.complianceScore : '—';
    const verdict = zone.complianceVerdict || 'pending';
    const verdictLabel = verdict === 'pass' ? '✅ ผ่าน' : verdict === 'fail' ? '❌ ไม่ผ่าน' : '⏳ รอตรวจ';
    return `
      <div class="admin-queue-card">
        <div class="queue-info">
          <strong>${zone.name}</strong>
          <span>${zone.roadName || ''} — ${zone.contractor}</span>
          <span>AI Verdict: ${verdictLabel} | Score: ${score}</span>
        </div>
        <div class="queue-actions">
          <button class="approve-btn" data-zone-id="${zone.id}" type="button">✓ อนุมัติ</button>
          <button class="reject-btn" data-zone-id="${zone.id}" type="button">✕ ปฏิเสธ</button>
        </div>
      </div>
    `;
  }).join('');

  // Bind approve/reject
  container.querySelectorAll('.approve-btn').forEach(btn => {
    btn.addEventListener('click', () => approveZone(parseInt(btn.dataset.zoneId)));
  });
  container.querySelectorAll('.reject-btn').forEach(btn => {
    btn.addEventListener('click', () => rejectZone(parseInt(btn.dataset.zoneId)));
  });
}

function approveZone(zoneId) {
  const zone = projects.find(p => p.id === zoneId);
  if (!zone) return;
  zone.status = 'in-progress';
  zone.publishedToDrivers = true;
  zone.approvedAt = new Date().toISOString();
  if (typeof renderAll === 'function') renderAll();
  if (typeof renderMarkers === 'function') renderMarkers();
  if (window.AiAuditor && window.AiAuditor.persistComplianceState) window.AiAuditor.persistComplianceState();
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
    if (typeof renderAll === 'function') renderAll();
    if (typeof renderMarkers === 'function') renderMarkers();
    if (typeof showToast === 'function') showToast(`❌ ปฏิเสธ: ${zone.name}`);
    if (window.AiAuditor && window.AiAuditor.persistComplianceState) window.AiAuditor.persistComplianceState();
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

  container.innerHTML = entries.map(c => {
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
