// ย่านาง AI — Navigation Assistant (like Grok in Tesla)

const API_BASE = '/api';
let currentStyle = 'cheerful';
let messageHistory = [];
let recognition = null;
let isListening = false;

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
    fetch(`${API_BASE}/personality`).catch(() => {});
    if (window.speechSynthesis) {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
});

// ── Style ──
function setStyle(style) {
    currentStyle = style;
    document.querySelectorAll('.style-btn-sm').forEach(b => b.classList.toggle('active', b.dataset.style === style));
    document.getElementById('style-chip').textContent = {cheerful:'😊',serious:'🎯',concise:'⚡',friendly:'🤗',professional:'💼'}[style];
    toggleStylePanel();
}

function toggleStylePanel() {
    document.getElementById('style-panel').classList.toggle('hidden');
}

// ── Navigation start (from search bar or chip) ──
function navigateTo(place) {
    document.getElementById('search-input').value = place;
    navigateSearch();
}

async function navigateSearch() {
    const input = document.getElementById('search-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    input.blur(); // hide keyboard

    showStatus('🔍 กำลังค้นหา...');
    addChat('user', `พาไป${text}`);
    openChat();

    try {
        // 1. Geocode
        const geoRes = await fetch(`${API_BASE}/navigation/geocode`, {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({address: text}),
        });
        if (!geoRes.ok) throw new Error('ไม่พบสถานที่');
        const geo = await geoRes.json();

        // 2. Get user location
        let oLat=13.7563, oLng=100.5018;
        if (window.userPos) { oLat = window.userPos.lat; oLng = window.userPos.lng; }
        else if (window.yanangMap) { const c = window.yanangMap.getCenter(); oLat=c.lat; oLng=c.lng; }

        // 3. Calculate route
        const dirRes = await fetch(`${API_BASE}/navigation/directions`, {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({origin_lat:oLat, origin_lng:oLng, dest_lat:geo.lat, dest_lng:geo.lng}),
        });
        if (!dirRes.ok) throw new Error('ไม่สามารถคำนวณเส้นทาง');
        const dir = await dirRes.json();

        // 4. Show on map
        drawRoute(dir, geo.display_name.split(',')[0] || text);

        // 5. Show route card
        document.getElementById('route-from').textContent = 'คุณ';
        document.getElementById('route-to').textContent = geo.display_name.split(',')[0] || text;
        document.getElementById('route-time').textContent = `⏱️ ${dir.duration_min}`;
        document.getElementById('route-distance').textContent = `📏 ${dir.distance_km}`;

        // Show steps
        const stepsEl = document.getElementById('route-steps');
        if (dir.steps && dir.steps.length > 0) {
            stepsEl.innerHTML = dir.steps.map(s => {
                const instr = `${s.instruction}${s.name ? ' '+s.name : ''}`;
                const dist = s.distance > 1000 ? `${(s.distance/1000).toFixed(1)} กม.` : `${Math.round(s.distance)} ม.`;
                return `<div>${instr} (${dist})</div>`;
            }).join('');
        }
        document.getElementById('route-card').classList.remove('hidden');
        hideStatus();

        // 6. Voice: announce route
        const msg = `เส้นทางไป${geo.display_name.split(',')[0] || text} ${dir.distance_km} ใช้เวลา ${dir.duration_min}`;
        addChat('ai', msg);
        speakThai(msg);

    } catch (err) {
        hideStatus();
        addChat('ai', `⚠️ ${err.message}`);
        speakThai(`ขอโทษค่ะ ${err.message}`);
    }
}

// ── Start turn-by-turn navigation ──
function startNavigation() {
    const stepsEl = document.getElementById('route-steps');
    document.getElementById('route-card').classList.add('expanded');

    if (stepsEl.children.length === 0) return;

    let stepIdx = 0;
    const steps = stepsEl.querySelectorAll('div');

    function speakStep() {
        if (stepIdx >= steps.length) {
            const msg = 'คุณถึงที่หมายแล้ว';
            addChat('ai', msg);
            speakThai(msg);
            return;
        }
        const text = steps[stepIdx].textContent;
        speakThai(text);
        stepIdx++;
    }

    // Speak first step, then continue every N seconds
    speakStep();
    window.navInterval = setInterval(() => {
        // If user said "ต่อไป" or "ต่อ" or similar, advance
        speakStep();
    }, 15000); // Auto-advance every 15s for demo

    addChat('ai', '▶️ เริ่มนำทางแล้ว พูด "ต่อไป" เพื่อขั้นตอนถัดไป');
    document.getElementById('nav-btn').textContent = '⏹️ หยุดนำทาง';
}

// ── Send chat message (from bottom input) ──
async function sendMessage() {
    const input = document.getElementById('user-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    addChat('user', text);
    openChat();
    showStatus('🤔...');

    const history = messageHistory.slice(-10);

    try {
        const resp = await fetch(`${API_BASE}/chat`, {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({message:text, style:currentStyle, history}),
        });
        if (!resp.ok) throw new Error('เชื่อมต่อไม่ได้');

        const data = await resp.json();
        hideStatus();

        if (data.response) {
            addChat('ai', data.response);
            speakThai(data.response);
            messageHistory.push({role:'user', content:text});
            messageHistory.push({role:'assistant', content:data.response});
        }

        // If navigate intent → also route
        if (data.intent === 'Navigate') {
            document.getElementById('search-input').value = text;
            navigateSearch();
        }

    } catch (err) {
        hideStatus();
        addChat('ai', `⚠️ ${err.message}`);
    }
}

// ── Voice ──
function toggleVoice() {
    if (isListening) { stopVoice(); return; }
    startVoice();
}

function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { addChat('ai','⚠️ เบราว์เซอร์ไม่รองรับเสียง'); return; }

    if (!recognition) {
        recognition = new SR();
        recognition.lang = 'th-TH';
        recognition.interimResults = false;
        recognition.onresult = (e) => {
            const t = e.results[0][0].transcript;
            setVoiceUI(false);
            // If navigation command, route it
            if (t.match(/พาไป|ไป|เส้นทาง|ทาง/)) {
                document.getElementById('search-input').value = t.replace(/^(พาไป|ไป|หา|ช่วย)\s*/,'');
                navigateSearch();
            } else {
                document.getElementById('user-input').value = t;
                sendMessage();
            }
        };
        recognition.onerror = (e) => {
            setVoiceUI(false);
            if (e.error !== 'no-speech') addChat('ai', `⚠️ ${e.error === 'not-allowed' ? 'ไม่อนุญาตไมค์' : 'เกิดข้อผิดพลาด'}`);
        };
        recognition.onend = () => setVoiceUI(false);
    }
    try { recognition.start(); setVoiceUI(true); } catch(e) {}
}

function stopVoice() {
    if (recognition) try { recognition.stop(); } catch(e) {}
    setVoiceUI(false);
}

function setVoiceUI(on) {
    isListening = on;
    const btn = document.getElementById('voice-btn');
    btn.classList.toggle('listening', on);
    btn.textContent = on ? '🔴' : '🎤';
}

// ── TTS ──
function speakThai(text) {
    if (!window.speechSynthesis) return;
    const clean = text.replace(/[\u{1F600}-\u{1FFFF}]/gu,'').replace(/[*_#>]/g,'').replace(/\n+/g,' ').trim();
    if (!clean) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = 'th-TH';
    u.rate = 1.0;
    const v = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('th'));
    if (v) u.voice = v;
    u.onstart = () => document.getElementById('voice-btn').classList.add('speaking');
    u.onend = () => document.getElementById('voice-btn').classList.remove('speaking');
    window.speechSynthesis.speak(u);
}

// ── Chat UI ──
function addChat(role, text) {
    const box = document.getElementById('chat-box');
    const div = document.createElement('div');
    div.className = `message ${role}`;
    if (role === 'ai') {
        div.innerHTML = `<div class="avatar">🧞</div><div class="bubble">${escHtml(text)}</div>`;
    } else {
        div.innerHTML = `<div class="bubble">${escHtml(text)}</div>`;
    }
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

function openChat() {
    document.getElementById('chat-box').classList.remove('collapsed');
}

function showStatus(msg) {
    const box = document.getElementById('chat-box');
    const div = document.createElement('div');
    div.className = 'message ai';
    div.id = 'chat-status';
    div.innerHTML = `<div class="avatar">🧞</div><div class="bubble">${escHtml(msg)}</div>`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    box.classList.remove('collapsed');
}

function hideStatus() {
    const el = document.getElementById('chat-status');
    if (el) el.remove();
}

function escHtml(t) {
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
}
