// ย่านาง AI — bootstraps VoiceController against the real #voice-btn, Web Speech API,
// and the app's existing collaborators (map.js userPos, alerts.js nearby projects, app.js chat bridge).
//
// Loaded as a plain <script> (not type="module") right after voice-controller.js (which is
// type="module" and attaches window.VoiceController). Runs after DOMContentLoaded to be safe.

function initVoiceController() {
    const button = document.getElementById('voice-btn');
    if (!button) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const secure = window.isSecureContext;

    // Req 8.2 / 8.3 — no Web Speech API support, or not a secure context: disable the
    // Talk_Button but never touch #user-input / #send-btn (Property 16).
    if (!SR) {
        button.disabled = true;
        button.title = 'เบราว์เซอร์นี้ไม่รองรับเสียง — พิมพ์ข้อความแทนได้';
        return;
    }
    if (!secure) {
        button.disabled = true;
        button.title = 'ต้องเปิดผ่าน HTTPS เพื่อใช้ไมโครโฟน — พิมพ์ข้อความแทนได้';
        return;
    }

    // Req 8.1 — Secure_Context + browser support: enable Talk_Button fully.
    button.disabled = false;
    button.title = 'กดค้างเพื่อพูด';

    if (!window.VoiceController || !window.VoiceControllerReducer) {
        console.warn('[VoiceController] voice-controller.js ยังไม่โหลด — push-to-talk จะไม่ทำงาน');
        return;
    }

    const controller = new window.VoiceController({
        button,
        recognizerFactory: () => new SR(),
        synthesizer: window.speechSynthesis,
        chatBridge: window.YanangChatBridge,
        getUserPos: () => (window.userPos ? { lat: window.userPos.lat, lng: window.userPos.lng } : null),
        getNearbyProjects: (lat, lng) =>
            window.DriverAlerts && window.DriverAlerts.getNearbyProjects
                ? window.DriverAlerts.getNearbyProjects(lat, lng)
                : [],
    });

    window.yanangVoiceController = controller; // exposed for debugging/manual QA
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVoiceController);
} else {
    initVoiceController();
}
