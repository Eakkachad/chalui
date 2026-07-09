/**
 * AI Auditor Module — DOH Construction Compliance Checker
 * 
 * Port ของ Rule Engine จาก Rust crate `doh-compliance-auditor`
 * ใช้ mock Vision-LLM detections สำหรับ POC แต่ Rule Engine logic เป็นของจริง (deterministic)
 * 
 * Architecture (inspired by katgpt-rs ConstraintPruner):
 * - Mock Vision-LLM → SceneDetection
 * - Rule Engine (deterministic) → ComplianceReport
 * - BLAKE3 hash → tamper-evident audit trail
 */

// ─── BLAKE3 Polyfill (simple SHA-256 fallback for POC — real BLAKE3 via CDN in production) ───
async function computeAuditHash(content) {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Safety Rules (baseline DOH standards — ported from Rust) ───
const BASELINE_RULES = [
  {
    ruleId: 'DOH-BASE-001',
    category: 'TrafficDevices',
    descriptionTh: 'ต้องตั้งกรวยยางเว้นระยะไม่เกิน 5 เมตร ตลอดแนวพื้นที่ก่อสร้าง',
    descriptionEn: 'Traffic cones at intervals ≤ 5 meters',
    condition: { type: 'MaxSpacing', objectType: 'traffic_cone', maxSpacingM: 5.0 },
    severity: 'moderate'
  },
  {
    ruleId: 'DOH-BASE-002',
    category: 'SignageWarning',
    descriptionTh: 'ต้องมีป้ายเตือนล่วงหน้าไม่น้อยกว่า 50 เมตร ก่อนถึงพื้นที่ก่อสร้าง',
    descriptionEn: 'Warning signs ≥ 50m before zone',
    condition: { type: 'RequiredWithinDistance', objectType: 'warning_sign', referencePoint: 'zone_start', maxDistanceM: 50.0 },
    severity: 'critical'
  },
  {
    ruleId: 'DOH-BASE-003',
    category: 'Lighting',
    descriptionTh: 'งานก่อสร้างกลางคืน (18:00-06:00) ต้องมีไฟกะพริบเตือนอย่างน้อย 2 จุด',
    descriptionEn: 'Night work requires ≥ 2 flashing lights',
    condition: { type: 'MinObjectCount', objectType: 'flashing_light', minCount: 2 },
    severity: 'critical'
  },
  {
    ruleId: 'DOH-BASE-004',
    category: 'TrafficDevices',
    descriptionTh: 'ต้องมีแบริเออร์กั้นพื้นที่ก่อสร้างจากช่องจราจร',
    descriptionEn: 'Barriers separating construction from traffic',
    condition: { type: 'MinObjectCount', objectType: 'barrier', minCount: 1 },
    severity: 'moderate'
  },
  {
    ruleId: 'DOH-BASE-005',
    category: 'SignageWarning',
    descriptionTh: 'ต้องมีป้ายจำกัดความเร็วในเขตก่อสร้าง',
    descriptionEn: 'Speed limit signs in construction zone',
    condition: { type: 'MinObjectCount', objectType: 'speed_limit_sign', minCount: 1 },
    severity: 'moderate'
  },
  {
    ruleId: 'DOH-BASE-006',
    category: 'PersonalProtective',
    descriptionTh: 'คนงานทุกคนในพื้นที่ก่อสร้างต้องสวมเสื้อสะท้อนแสง',
    descriptionEn: 'All workers must wear reflective vests',
    condition: { type: 'Custom', expression: 'all_workers_have_reflective_vest' },
    severity: 'warning'
  }
];

// Permit-specific rules (เข้มงวดกว่า baseline — ทางโค้ง)
const PERMIT_RULES = [
  {
    ruleId: 'PERMIT-042-001',
    category: 'TrafficDevices',
    descriptionTh: 'ต้องตั้งกรวยยางเว้นระยะไม่เกิน 3 เมตร (เข้มงวด — ทางโค้ง)',
    descriptionEn: 'Cones at max 3m spacing (strict — curved road)',
    condition: { type: 'MaxSpacing', objectType: 'traffic_cone', maxSpacingM: 3.0 },
    severity: 'critical'
  },
  {
    ruleId: 'PERMIT-042-002',
    category: 'Lighting',
    descriptionTh: 'ต้องมีไฟกะพริบเตือนอย่างน้อย 4 จุด (ทางโค้ง + ทัศนวิสัยจำกัด)',
    descriptionEn: 'At least 4 flashing lights (curve + limited visibility)',
    condition: { type: 'MinObjectCount', objectType: 'flashing_light', minCount: 4 },
    severity: 'critical'
  }
];

// ─── Mock Vision-LLM Fixtures (3 scenarios) ───
const MOCK_DETECTIONS = {
  pass: {
    detectedObjects: [
      { objectType: 'traffic_cone', count: 12, positionsM: [0, 2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5], confidence: 0.94 },
      { objectType: 'warning_sign', count: 2, positionsM: [-60, -45], confidence: 0.91 },
      { objectType: 'barrier', count: 4, positionsM: [0, 10, 20, 30], confidence: 0.93 },
      { objectType: 'speed_limit_sign', count: 2, positionsM: [-30, 15], confidence: 0.96 },
      { objectType: 'flashing_light', count: 5, positionsM: [0, 7, 15, 22, 30], confidence: 0.89 }
    ],
    capturedAt: new Date().toISOString(),
    sceneConfidence: 0.93
  },
  fail: {
    detectedObjects: [
      { objectType: 'traffic_cone', count: 4, positionsM: [0, 8, 16, 24], confidence: 0.92 },
      { objectType: 'barrier', count: 2, positionsM: [5, 20], confidence: 0.88 },
      { objectType: 'speed_limit_sign', count: 1, positionsM: [2], confidence: 0.95 },
      { objectType: 'flashing_light', count: 1, positionsM: [12], confidence: 0.85 }
    ],
    capturedAt: new Date().toISOString(),
    sceneConfidence: 0.90
  },
  critical: {
    detectedObjects: [
      { objectType: 'traffic_cone', count: 1, positionsM: [15], confidence: 0.52 }
    ],
    capturedAt: new Date().toISOString(),
    sceneConfidence: 0.65
  }
};

// ─── Rule Engine (deterministic — ported from Rust) ───
const SEVERITY_DEDUCTIONS = { warning: 5, moderate: 15, critical: 35 };
const CONFIDENCE_THRESHOLD = 0.50;

function countObjects(scene, objectType) {
  return scene.detectedObjects
    .filter(o => o.objectType === objectType && o.confidence >= CONFIDENCE_THRESHOLD)
    .reduce((sum, o) => sum + o.count, 0);
}

function computeSpacing(scene, objectType, zoneLengthM) {
  const count = countObjects(scene, objectType);
  if (count < 2) return { spacing: zoneLengthM, count };
  return { spacing: zoneLengthM / (count - 1), count };
}

function findNearestDistance(scene, objectType) {
  const positions = scene.detectedObjects
    .filter(o => o.objectType === objectType && o.confidence >= CONFIDENCE_THRESHOLD)
    .flatMap(o => o.positionsM);
  if (positions.length === 0) return null;
  return Math.min(...positions.map(Math.abs));
}

function evaluateSingleRule(rule, scene, zoneLengthM) {
  const cond = rule.condition;
  let passed, actualValue, requiredValue, recommendation = null;

  switch (cond.type) {
    case 'MinObjectCount': {
      const actual = countObjects(scene, cond.objectType);
      passed = actual >= cond.minCount;
      actualValue = `${actual} ชิ้น`;
      requiredValue = `≥ ${cond.minCount} ชิ้น`;
      if (!passed) recommendation = `ต้องเพิ่ม ${cond.objectType} อีก ${cond.minCount - actual} ชิ้น`;
      break;
    }
    case 'MaxSpacing': {
      const { spacing, count } = computeSpacing(scene, cond.objectType, zoneLengthM);
      passed = spacing <= cond.maxSpacingM;
      actualValue = `${spacing.toFixed(1)} ม. (${count} ชิ้น)`;
      requiredValue = `≤ ${cond.maxSpacingM} ม.`;
      if (!passed) {
        const needed = Math.ceil(zoneLengthM / cond.maxSpacingM) + 1;
        recommendation = `ระยะห่างเกิน (${spacing.toFixed(1)} ม.) — ต้องมีอย่างน้อย ${needed} ชิ้น`;
      }
      break;
    }
    case 'RequiredWithinDistance': {
      const dist = findNearestDistance(scene, cond.objectType);
      passed = dist !== null && dist <= cond.maxDistanceM;
      actualValue = dist !== null ? `${dist.toFixed(1)} ม.` : 'ไม่พบ';
      requiredValue = `≤ ${cond.maxDistanceM} ม.`;
      if (!passed) recommendation = `ต้องติดตั้ง ${cond.objectType} ภายใน ${cond.maxDistanceM} ม.`;
      break;
    }
    case 'Custom': {
      passed = true; // Custom rules pass by default in POC
      actualValue = 'ตรวจสอบด้วยตาเปล่า';
      requiredValue = cond.expression;
      break;
    }
    default:
      passed = true;
      actualValue = '-';
      requiredValue = '-';
  }

  // Sigmoid-inspired reject confidence (from katgpt Plan 310)
  let rejectConfidence = passed ? 0.0 : 1.0;
  if (!passed && cond.type === 'MaxSpacing') {
    const { spacing } = computeSpacing(scene, cond.objectType, zoneLengthM);
    rejectConfidence = Math.min(1.0, 1.0 - (1.0 / (spacing / cond.maxSpacingM)));
  }

  return {
    ruleId: rule.ruleId,
    ruleDescription: rule.descriptionTh,
    passed,
    actualValue,
    requiredValue,
    severity: passed ? null : rule.severity,
    recommendation,
    rejectConfidence
  };
}

async function runComplianceAudit(scene, zoneLengthM = 30) {
  const rules = [...BASELINE_RULES, ...PERMIT_RULES];
  let score = 100;
  let worstSeverity = null;
  const recommendations = [];

  const ruleResults = rules.map(rule => {
    const result = evaluateSingleRule(rule, scene, zoneLengthM);
    if (!result.passed) {
      score -= SEVERITY_DEDUCTIONS[result.severity] || 0;
      if (!worstSeverity || severityRank(result.severity) > severityRank(worstSeverity)) {
        worstSeverity = result.severity;
      }
      if (result.recommendation) recommendations.push(result.recommendation);
    }
    return result;
  });

  score = Math.max(0, Math.min(100, score));

  const overallStatus = !worstSeverity ? 'pass'
    : worstSeverity === 'warning' ? 'pass_with_warnings'
    : worstSeverity === 'moderate' ? 'fail'
    : 'critical_fail';

  const reportContent = JSON.stringify(ruleResults);
  const reportHash = await computeAuditHash(reportContent);

  // ─── AI Confidence: how sure is the AI about this verdict? ───
  // Combines: (1) vision scene confidence, (2) verdict decisiveness (distance from borderline 50)
  // Low confidence = admin should look carefully. High = admin can quick-confirm.
  const sceneConf = scene.sceneConfidence || 0.85;
  const decisiveness = Math.abs(score - 50) / 50; // 0 = borderline (uncertain), 1 = extreme (certain)
  const aiConfidence = Math.round((sceneConf * 0.5 + decisiveness * 0.5) * 100);

  return {
    reportId: `CR-${reportHash.slice(0, 8)}`,
    overallStatus,
    overallScore: score,
    aiConfidence,
    ruleResults,
    recommendations,
    reportHash,
    inspectedAt: scene.capturedAt,
    detectedObjects: scene.detectedObjects
  };
}

function severityRank(s) {
  return s === 'critical' ? 3 : s === 'moderate' ? 2 : s === 'warning' ? 1 : 0;
}

// ─── Persistence (Task 14) — survive page refresh ───
const COMPLIANCE_STORAGE_KEY = 'gpsComplianceState';

function persistComplianceState() {
  if (typeof projects === 'undefined') return;
  const state = {};
  projects.forEach(p => {
    if (p.complianceVerdict !== undefined || p.publishedToDrivers !== undefined) {
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
  try {
    window.localStorage.setItem(COMPLIANCE_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('[Persist] Could not save compliance state:', e.message);
  }
}

function loadComplianceState() {
  if (typeof projects === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(COMPLIANCE_STORAGE_KEY);
    if (!raw) return;
    const state = JSON.parse(raw);
    projects.forEach(p => {
      if (state[p.id]) {
        Object.assign(p, state[p.id]);
      }
    });
    console.log('[Persist] Compliance state restored');
  } catch (e) {
    console.warn('[Persist] Could not load compliance state:', e.message);
  }
}

// ─── UI Rendering ───
function renderVerdict(report) {
  const el = document.getElementById('aiVerdict');
  const isPass = report.overallStatus === 'pass' || report.overallStatus === 'pass_with_warnings';
  const statusLabels = {
    pass: '✅ ผ่านมาตรฐาน',
    pass_with_warnings: '⚠️ ผ่าน (มีข้อเตือน)',
    fail: '❌ ไม่ผ่านมาตรฐาน',
    critical_fail: '🔴 ไม่ผ่าน — ต้องหยุดงานทันที'
  };
  el.className = `ai-verdict verdict-${isPass ? 'pass' : 'fail'}`;
  const conf = report.aiConfidence != null ? report.aiConfidence : null;
  const confNote = conf != null
    ? `<p style="font-size:0.8rem;margin:4px 0 0;opacity:0.85">🎯 AI มั่นใจ ${conf}% — ผลนี้เป็นข้อเสนอแนะ ต้องให้เจ้าหน้าที่ ทล. ยืนยัน</p>`
    : '';
  el.innerHTML = `<h3>${statusLabels[report.overallStatus]}</h3>${confNote}`;
}

function renderScoreGauge(report) {
  const el = document.getElementById('aiScoreGauge');
  const color = report.overallScore >= 80 ? '#22c55e' : report.overallScore >= 50 ? '#eab308' : '#ef4444';
  el.innerHTML = `
    <div class="score-circle" style="--score-color: ${color}; --score-pct: ${report.overallScore}%">
      <span class="score-number">${report.overallScore}</span>
      <span class="score-label">/ 100</span>
    </div>
  `;
}

function renderDetected(report) {
  const el = document.getElementById('aiDetected');
  const objectLabels = {
    traffic_cone: '🔶 กรวยยาง',
    warning_sign: '⚠️ ป้ายเตือน',
    barrier: '🚧 แบริเออร์',
    speed_limit_sign: '🚸 ป้ายจำกัดความเร็ว',
    flashing_light: '💡 ไฟกะพริบ'
  };
  const items = report.detectedObjects.map(o => {
    const label = objectLabels[o.objectType] || o.objectType;
    const conf = Math.round(o.confidence * 100);
    return `<div class="detected-item"><span>${label}</span><strong>${o.count} ชิ้น</strong><small>(${conf}%)</small></div>`;
  }).join('');
  el.innerHTML = `<h4>วัตถุที่ตรวจพบ</h4><div class="detected-grid">${items}</div>`;
}

function renderRules(report) {
  const el = document.getElementById('aiRules');
  const items = report.ruleResults.map(r => {
    const icon = r.passed ? '✅' : r.severity === 'critical' ? '🔴' : r.severity === 'moderate' ? '🟠' : '⚠️';
    const sevLabel = r.severity ? `<span class="sev-badge sev-${r.severity}">${r.severity}</span>` : '';
    return `
      <div class="rule-item ${r.passed ? 'rule-pass' : 'rule-fail'}">
        <div class="rule-header">${icon} <strong>[${r.ruleId}]</strong> ${sevLabel}</div>
        <div class="rule-desc">${r.ruleDescription}</div>
        <div class="rule-values">
          <span>ค่าจริง: <strong>${r.actualValue}</strong></span>
          <span>กำหนด: <strong>${r.requiredValue}</strong></span>
        </div>
        ${r.recommendation ? `<div class="rule-rec">💡 ${r.recommendation}</div>` : ''}
      </div>
    `;
  }).join('');
  el.innerHTML = `<h4>ผลตรวจรายกฎ (${report.ruleResults.filter(r => r.passed).length}/${report.ruleResults.length} ผ่าน)</h4>${items}`;
}

function renderRecommendations(report) {
  const el = document.getElementById('aiRecommendations');
  if (report.recommendations.length === 0) { el.innerHTML = ''; return; }
  const items = report.recommendations.map((r, i) => `<li>${i + 1}. ${r}</li>`).join('');
  el.innerHTML = `<h4>💡 ข้อเสนอแนะ</h4><ol>${items}</ol>`;
}

function renderHash(report) {
  const el = document.getElementById('aiHash');
  el.innerHTML = `
    <div class="hash-box">
      <span class="hash-label">🔒 Audit Hash (tamper-evident)</span>
      <code>${report.reportHash.slice(0, 32)}...</code>
      <small>Report ID: ${report.reportId}</small>
    </div>
  `;
}

function displayComplianceReport(report) {
  renderVerdict(report);
  renderScoreGauge(report);
  renderDetected(report);
  renderRules(report);
  renderRecommendations(report);
  renderHash(report);
  document.getElementById('aiResults').hidden = false;
}

// ─── Closed Loop (Wow #2) — Compliance Verdict → Map Visibility ───

/**
 * When audit completes, update the project in the global `projects` array
 * and trigger map re-render. This is the CLOSED LOOP:
 * - Pass → project.publishedToDrivers = true → marker visible
 * - Fail → project.publishedToDrivers = false → marker hidden
 * 
 * The same data that the contractor submitted for compliance is what
 * powers the driver alert. Single source of truth.
 */
function applyComplianceVerdict(report, targetZoneId) {
  // Find the target zone (if linked to a specific project)
  const zone = typeof projects !== 'undefined' 
    ? projects.find(p => p.id === targetZoneId) 
    : null;

  if (!zone) {
    console.log('[Closed Loop] No zone linked — standalone audit');
    return;
  }

  const isPass = report.overallStatus === 'pass' || report.overallStatus === 'pass_with_warnings';
  
  // ─── AI PROPOSES (human-in-the-loop) ───
  // AI's verdict is ADVISORY. The final decision requires admin validation.
  zone.aiVerdict = isPass ? 'pass' : 'fail';        // what AI said (never overwritten)
  zone.aiConfidence = report.aiConfidence;           // how sure AI is (0-100)
  zone.aiScore = report.overallScore;
  zone.complianceReportId = report.reportId;
  zone.complianceScore = report.overallScore;
  zone.lastAuditAt = report.inspectedAt;

  // Admin has NOT validated yet → status = pending review
  zone.adminDecision = 'pending';                    // 'pending' | 'confirmed' | 'overridden'
  zone.verified = false;                             // becomes true only after admin acts
  zone.aiWasWrong = false;

  // Tentative state (shown to public with "unverified" badge until admin confirms)
  zone.complianceVerdict = zone.aiVerdict;
  zone.publishedToDrivers = true;                    // ALWAYS visible — failed zones need MORE visibility
  zone.isDangerous = !isPass;                        // tentative danger flag

  // If AI says fail → pre-flag for DOH inspection (admin will confirm)
  if (!isPass) {
    zone.needsDohInspection = true;
    zone.dohAlertSent = new Date().toISOString();
  }

  // Re-render map markers (only published zones show to drivers)
  if (typeof renderAll === 'function') {
    renderAll();
  }
  if (typeof renderMarkers === 'function') {
    renderMarkers();
  }

  // Persist so the verdict survives a page refresh
  persistComplianceState();

  // ─── Cross-Tab Sync: Broadcast verdict to other tabs (Traveler ↔ Admin) ───
  try {
    if (window._complianceChannel) {
      const state = {};
      projects.forEach(p => {
        if (p.complianceVerdict !== undefined || p.publishedToDrivers !== undefined) {
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
      window._complianceChannel.postMessage({ type: "compliance-update", state });
      console.log("[Sync] Broadcast compliance update to other tabs");
    }
  } catch (e) {
    // BroadcastChannel may not exist yet during early init
  }

  // Show toast notification
  const msg = isPass 
    ? `✅ ${zone.name} — ผ่านมาตรฐาน แสดงสถานะปกติต่อผู้ขับขี่`
    : `🚨 ${zone.name} — ไม่ผ่านมาตรฐาน! แจ้งเตือนผู้ขับขี่ + ส่ง ทล. ลงตรวจ`;
  
  if (typeof showToast === 'function') {
    showToast(msg);
  }

  console.log(`[Closed Loop] Zone "${zone.name}" verdict=${zone.complianceVerdict} dangerous=${zone.isDangerous} dohInspection=${zone.needsDohInspection}`);
}

/**
 * Check if a zone should be visible to drivers.
 * Used by the map layer to filter markers.
 * 
 * NEW LOGIC (2026-07-09): Failed zones are ALWAYS visible — they're MORE
 * dangerous, so drivers need warnings. Only "planned" zones that haven't
 * been submitted yet are hidden.
 */
function isZonePublished(zone) {
  // Completed zones are always visible
  if (zone.status === 'completed') return true;
  // Failed compliance = SHOW (dangerous — warn drivers!)
  if (zone.complianceVerdict === 'fail') return true;
  // Passed compliance = SHOW (verified safe)
  if (zone.publishedToDrivers === true) return true;
  // Default: all existing zones are visible (backward compat with sample data)
  return true;
}

/**
 * Check if a zone has failed compliance — used for special styling/alerts.
 */
function isZoneDangerous(zone) {
  return zone.complianceVerdict === 'fail' && zone.status !== 'completed';
}

/**
 * Check if a zone's verdict is admin-verified (vs AI-only tentative).
 */
function isZoneVerified(zone) {
  return zone.verified === true;
}

// ─── HUMAN-IN-THE-LOOP: Admin validates AI verdict ───

/**
 * Admin CONFIRMS the AI verdict (agrees with AI).
 * Fast path — one click when AI is obviously right.
 */
function adminConfirmVerdict(zoneId) {
  const zone = typeof projects !== 'undefined' ? projects.find(p => p.id === zoneId) : null;
  if (!zone) return;

  zone.adminDecision = 'confirmed';
  zone.verified = true;
  zone.aiWasWrong = false;
  zone.finalVerdict = zone.aiVerdict;
  zone.complianceVerdict = zone.aiVerdict;
  zone.isDangerous = zone.aiVerdict === 'fail';
  zone.validatedBy = 'admin';
  zone.validatedAt = new Date().toISOString();

  finalizeVerdictSideEffects(zone,
    `✅ ยืนยันตาม AI: ${zone.name} (${zone.aiVerdict === 'pass' ? 'ผ่าน' : 'ไม่ผ่าน'})`);
}

/**
 * Admin OVERRIDES the AI verdict (AI got it wrong).
 * This is the safety net — human is the accountable validator.
 * @param {string} newVerdict - 'pass' | 'fail'
 * @param {string} reason - why admin disagreed (audit trail)
 */
function adminOverrideVerdict(zoneId, newVerdict, reason) {
  const zone = typeof projects !== 'undefined' ? projects.find(p => p.id === zoneId) : null;
  if (!zone) return;

  zone.adminDecision = 'overridden';
  zone.verified = true;
  zone.aiWasWrong = newVerdict !== zone.aiVerdict; // track AI accuracy
  zone.finalVerdict = newVerdict;
  zone.complianceVerdict = newVerdict;
  zone.isDangerous = newVerdict === 'fail';
  zone.needsDohInspection = newVerdict === 'fail';
  zone.overrideReason = reason || '';
  zone.validatedBy = 'admin';
  zone.validatedAt = new Date().toISOString();

  finalizeVerdictSideEffects(zone,
    `✎ Override: ${zone.name} → ${newVerdict === 'pass' ? 'ผ่าน' : 'ไม่ผ่าน'} (AI ${zone.aiWasWrong ? 'ผิด' : 'ถูก'})`);
}

/**
 * Shared side effects after a verdict is finalized (confirm or override):
 * re-render, persist, broadcast to other tabs, toast.
 */
function finalizeVerdictSideEffects(zone, message) {
  if (typeof renderAll === 'function') renderAll();
  if (typeof renderMarkers === 'function') renderMarkers();
  persistComplianceState();

  // Broadcast to other tabs (Traveler updates instantly)
  try {
    if (window._complianceChannel) {
      const state = {};
      projects.forEach(p => {
        if (p.complianceVerdict !== undefined || p.publishedToDrivers !== undefined) {
          state[p.id] = {
            complianceVerdict: p.complianceVerdict,
            publishedToDrivers: p.publishedToDrivers,
            complianceScore: p.complianceScore,
            complianceReportId: p.complianceReportId,
            status: p.status,
            aiVerdict: p.aiVerdict,
            adminDecision: p.adminDecision,
            verified: p.verified,
            isDangerous: p.isDangerous,
            finalVerdict: p.finalVerdict
          };
        }
      });
      window._complianceChannel.postMessage({ type: "compliance-update", state });
    }
  } catch (e) { /* channel not ready */ }

  if (typeof showToast === 'function') showToast(message);
  console.log(`[Human-in-loop] ${message}`);
}

/**
 * Get AI accuracy stats — how often admin agreed vs overrode AI.
 * Used in KPI/dashboard to monitor AI reliability over time.
 */
function getAiAccuracyStats() {
  if (typeof projects === 'undefined') return { validated: 0, agreed: 0, overridden: 0, accuracy: null };
  const validated = projects.filter(p => p.verified === true);
  const overridden = validated.filter(p => p.aiWasWrong === true);
  const agreed = validated.length - overridden.length;
  const accuracy = validated.length > 0 ? Math.round((agreed / validated.length) * 100) : null;
  return { validated: validated.length, agreed, overridden: overridden.length, accuracy };
}

/**
 * Re-audit trigger: when a zone gets 3+ feedback of the same type,
 * flag it for re-inspection.
 */
function checkFeedbackReauditTrigger(zoneId, feedbackList) {
  if (!feedbackList || !Array.isArray(feedbackList)) return false;
  
  const zoneFeedback = feedbackList.filter(f => f.zoneId === zoneId && f.status === 'pending');
  
  // Count by type
  const typeCounts = {};
  zoneFeedback.forEach(f => {
    typeCounts[f.problemType] = (typeCounts[f.problemType] || 0) + 1;
  });

  // If any type has ≥3 unresolved feedback, trigger re-audit
  const needsReaudit = Object.values(typeCounts).some(count => count >= 3);
  
  if (needsReaudit) {
    const zone = typeof projects !== 'undefined' 
      ? projects.find(p => p.id === zoneId) 
      : null;
    if (zone) {
      zone.needsReaudit = true;
      console.log(`[Closed Loop] Zone "${zone.name}" flagged for re-audit (≥3 same-type feedback)`);
      if (typeof showToast === 'function') {
        showToast(`⚠️ ${zone.name} — ถูก flag ให้ตรวจสอบใหม่ (feedback ≥3)`);
      }
    }
  }

  return needsReaudit;
}

// Expose for use by other modules
window.AiAuditor = {
  runComplianceAudit,
  applyComplianceVerdict,
  adminConfirmVerdict,
  adminOverrideVerdict,
  getAiAccuracyStats,
  isZonePublished,
  isZoneDangerous,
  isZoneVerified,
  checkFeedbackReauditTrigger,
  populateAuditZoneSelector,
  persistComplianceState,
  loadComplianceState,
  MOCK_DETECTIONS,
  BASELINE_RULES,
  PERMIT_RULES
};

// ─── Event Binding ───
function initAiAuditor() {
  const uploadInput = document.getElementById('aiImageUpload');
  const preview = document.getElementById('aiPreview');
  const runBtn = document.getElementById('runAiAudit');
  const loading = document.getElementById('aiLoading');
  const results = document.getElementById('aiResults');

  // Image preview
  if (uploadInput) {
    uploadInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          preview.src = ev.target.result;
          preview.hidden = false;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Run audit
  if (runBtn) {
    runBtn.addEventListener('click', async () => {
      const scenario = document.getElementById('aiScenario').value;
      const scene = MOCK_DETECTIONS[scenario];
      
      // Show loading
      loading.hidden = false;
      results.hidden = true;
      runBtn.disabled = true;

      // Simulate inference delay (1.5s)
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Run deterministic rule engine
      const report = await runComplianceAudit(scene, 30);
      
      // Display results
      loading.hidden = true;
      displayComplianceReport(report);
      runBtn.disabled = false;

      // ★ CLOSED LOOP: Apply verdict to the zone selected in the dropdown (Task 13)
      const zoneSel = document.getElementById('aiZoneSelect');
      const selectedZoneId = zoneSel && zoneSel.value ? parseInt(zoneSel.value) : null;
      if (selectedZoneId != null) {
        applyComplianceVerdict(report, selectedZoneId);
      }

      console.log('Compliance Report:', JSON.stringify(report, null, 2));
    });
  }

  // NOTE: Panel show/hide is handled centrally by the unified router in
  // script.js (window.PanelRouter). Close buttons below just route back to Home.
  document.getElementById('closeAiPanel')?.addEventListener('click', () => {
    if (window.PanelRouter) window.PanelRouter.show('home');
  });
  document.getElementById('closeAdminPanel')?.addEventListener('click', () => {
    if (window.PanelRouter) window.PanelRouter.show('home');
  });

  // Populate the zone selector when the AI panel opens (Task 13)
  populateAuditZoneSelector();
}

/**
 * Populate a dropdown of construction zones so the auditor can target a
 * specific zone (Task 13). Falls back gracefully if projects not loaded yet.
 */
function populateAuditZoneSelector() {
  const sel = document.getElementById('aiZoneSelect');
  if (!sel || typeof projects === 'undefined') return;
  sel.innerHTML = projects
    .map(p => `<option value="${p.id}">${p.name} (${statusLabelOf(p.status)})</option>`)
    .join('');
}

function statusLabelOf(status) {
  const map = { completed: 'เสร็จสิ้น', 'in-progress': 'กำลังทำ', delayed: 'ล่าช้า', planned: 'วางแผน' };
  return map[status] || status;
}

// Auto-init when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAiAuditor);
} else {
  initAiAuditor();
}

// ─── Initialize BroadcastChannel for cross-tab sync ───
try {
  if (!window._complianceChannel) {
    window._complianceChannel = new BroadcastChannel("gps-compliance-sync");
  }
} catch (e) {
  // BroadcastChannel not supported in this environment
}
