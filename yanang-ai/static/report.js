// ย่านาง AI — Citizen Report (แจ้งปัญหาก่อสร้าง → ส่งไป POST /api/reports)
// ใช้ Haversine/getNearbyProjects ที่มีอยู่แล้วใน alerts.js สำหรับ preview โซนใกล้สุดในหน้า UI
// ก่อนส่งจริง — ไม่ implement Haversine ซ้ำที่นี่

const REPORT_PROBLEM_TYPES = {
    no_cones: '🔶 ไม่มีกรวยยาง / กรวยไม่ครบ',
    no_sign: '⚠️ ไม่มีป้ายเตือน / ป้ายไม่ชัดเจน',
    data_mismatch: '📍 ข้อมูลในแอปไม่ตรงกับสภาพจริง',
    heavy_traffic: '🚗 รถติดหนัก / ช่องจราจรไม่เพียงพอ',
    other: '💬 อื่นๆ',
};

const REPORT_SESSION_KEY = 'yanangReportSessionId';
let reportPanelEl = null;

function getReportSessionId() {
    let id = null;
    try {
        id = window.localStorage.getItem(REPORT_SESSION_KEY);
    } catch (e) {
        // localStorage ไม่พร้อมใช้งาน (private mode ฯลฯ) — ใช้ id ชั่วคราวต่อการเปิดหน้า
    }
    if (!id) {
        id = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        try { window.localStorage.setItem(REPORT_SESSION_KEY, id); } catch (e) { /* ignore */ }
    }
    return id;
}

function createReportPanel() {
    if (document.getElementById('reportPanel')) return;

    const panel = document.createElement('div');
    panel.id = 'reportPanel';
    panel.className = 'style-panel hidden'; // reuse existing bottom-sheet style
    panel.innerHTML = `
        <div class="panel-content">
            <div class="panel-title">🚧 แจ้งปัญหาก่อสร้าง</div>
            <form id="reportForm" class="style-grid">
                <label style="text-align:left; font-size:13px; font-weight:600;">ประเภทปัญหา *</label>
                <div id="reportTypes" style="display:flex; flex-direction:column; gap:6px;">
                    ${Object.entries(REPORT_PROBLEM_TYPES).map(([key, label]) => `
                        <label class="style-btn-sm" style="display:flex; align-items:center; gap:8px; text-align:left; cursor:pointer;">
                            <input type="radio" name="reportProblemType" value="${key}" style="margin:0;">
                            <span>${label}</span>
                        </label>
                    `).join('')}
                </div>
                <textarea id="reportDesc" rows="3" maxlength="500" placeholder="อธิบายปัญหาที่พบ (ไม่บังคับ)"
                    style="width:100%; padding:8px; border:1.5px solid #e0e0e0; border-radius:10px; font-family:inherit; font-size:13px; resize:vertical;"></textarea>
                <div id="reportLocationPreview" style="font-size:12px; color:var(--text-light);">📍 กำลังหาตำแหน่ง...</div>
                <div id="reportError" class="driver-alert-banner danger-alert" style="display:none; position:static; opacity:1; transform:none; margin:0;"></div>
                <button type="submit" class="nav-btn" id="reportSubmitBtn" style="align-self:stretch; text-align:center;">ส่งรายงาน</button>
            </form>
            <button class="panel-close" id="reportPanelClose">ปิด</button>
        </div>
    `;
    document.body.appendChild(panel);
    reportPanelEl = panel;
    bindReportPanelEvents();
}

function bindReportPanelEvents() {
    document.getElementById('reportPanelClose').addEventListener('click', closeReportPanel);

    const locationEl = document.getElementById('reportLocationPreview');
    const updatePreview = () => {
        const pos = window.userPos;
        if (!pos) {
            locationEl.textContent = '📍 ไม่พบตำแหน่งปัจจุบัน — ยังส่งรายงานได้แต่จะไม่ผูกกับโซนใกล้เคียง';
            return;
        }
        locationEl.textContent = `📍 ${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`;
        if (window.DriverAlerts && window.DriverAlerts.getNearbyProjects) {
            const nearby = window.DriverAlerts.getNearbyProjects(pos.lat, pos.lng, 1000);
            if (nearby.length > 0) {
                locationEl.textContent += ` — ใกล้ ${nearby[0].name} (${nearby[0].distanceM} ม.)`;
            }
        }
    };
    updatePreview();
    reportPanelEl._previewInterval = setInterval(updatePreview, 3000);

    document.getElementById('reportForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorEl = document.getElementById('reportError');
        const submitBtn = document.getElementById('reportSubmitBtn');
        errorEl.style.display = 'none';

        const typeInput = document.querySelector('input[name="reportProblemType"]:checked');
        if (!typeInput) {
            errorEl.textContent = 'กรุณาเลือกประเภทปัญหา';
            errorEl.style.display = 'block';
            return;
        }

        const pos = window.userPos || { lat: 13.7563, lng: 100.5018 }; // fallback: Bangkok center
        const description = document.getElementById('reportDesc').value;

        submitBtn.disabled = true;
        submitBtn.textContent = 'กำลังส่ง...';

        try {
            const resp = await fetch('/api/reports', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Id': getReportSessionId(),
                },
                body: JSON.stringify({
                    problem_type: typeInput.value,
                    lat: pos.lat,
                    lng: pos.lng,
                    description: description || null,
                }),
            });

            const data = await resp.json();

            if (resp.status === 201 || resp.status === 202) {
                const msg = resp.status === 201
                    ? '✅ ส่งรายงานสำเร็จ — ขอบคุณที่ช่วยรายงาน!'
                    : '✅ บันทึกรายงานแล้ว (รอส่งต่อไปยังระบบ) — ขอบคุณที่ช่วยรายงาน!';
                if (typeof addChat === 'function') addChat('ai', msg);
                if (typeof speakThai === 'function') speakThai('ส่งรายงานสำเร็จแล้วค่ะ ขอบคุณที่ช่วยแจ้ง');
                closeReportPanel();
                document.getElementById('reportForm').reset();
            } else {
                errorEl.textContent = data.error || 'ส่งรายงานไม่สำเร็จ กรุณาลองใหม่';
                errorEl.style.display = 'block';
            }
        } catch (err) {
            errorEl.textContent = 'เชื่อมต่อไม่ได้ กรุณาลองใหม่อีกครั้ง';
            errorEl.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'ส่งรายงาน';
        }
    });
}

function openReportPanel() {
    createReportPanel();
    reportPanelEl.classList.remove('hidden');
}

function closeReportPanel() {
    if (reportPanelEl) reportPanelEl.classList.add('hidden');
}

window.openReportPanel = openReportPanel;
window.closeReportPanel = closeReportPanel;
