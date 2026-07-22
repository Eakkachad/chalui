// ย่านาง AI — Push-to-Talk Voice Controller
//
// State machine: idle -> listening -> processing -> speaking -> (idle | listening)
// with an `error` side-path from `listening`.
//
// `reduce()` is a PURE function: no DOM, no timers, no network. It takes the
// current state + session + an event, and returns the next state + session +
// a list of side-effect descriptors for the caller (VoiceController) to execute.
// This separation is what lets the state machine be property-tested without a browser.

const MIN_PRESS_DURATION_MS = 300;
const ERROR_DISPLAY_MS = 4000;

/**
 * @typedef {'idle'|'listening'|'processing'|'speaking'|'error'} InteractionState
 * @typedef {{ pointerType: 'mouse'|'touch', startedAt: number, cancelled: boolean, generation: number }} PressSession
 */

let generationCounter = 0;
function nextGeneration() {
    generationCounter += 1;
    return generationCounter;
}

/**
 * Pure reducer. Returns { state, session, effects }.
 *
 * event shapes:
 *   { type: 'PRESS_START', pointerType: 'mouse'|'touch', now: number }
 *   { type: 'PRESS_END', pointerType: 'mouse'|'touch', now: number, transcript: string }
 *   { type: 'PRESS_CANCEL', pointerType: 'mouse'|'touch' }               // touchcancel
 *   { type: 'RECOGNIZER_START_FAILED' }
 *   { type: 'RECOGNIZER_ERROR', code: string }                          // 'no-speech' | 'not-allowed' | 'network' | ...
 *   { type: 'CHAT_SUCCESS', responseText: string, generation: number }
 *   { type: 'CHAT_FAILURE', generation: number }
 *   { type: 'SYNTH_ERROR' }
 *   { type: 'SYNTH_END' }                                               // natural end of speaking
 *   { type: 'ERROR_TIMEOUT' }
 */
function reduce(state, session, event) {
    switch (event.type) {
        case 'PRESS_START': {
            // Press guard (Property 1): only idle or speaking accept a new press.
            if (state !== 'idle' && state !== 'speaking') {
                return { state, session, effects: [] };
            }

            const effects = [];
            if (state === 'speaking') {
                effects.push({ type: 'CANCEL_SYNTH' });
            }

            const newSession = {
                pointerType: event.pointerType,
                startedAt: event.now,
                cancelled: false,
                generation: nextGeneration(),
            };

            effects.push({ type: 'START_RECOGNIZER' });
            effects.push({ type: 'RENDER', state: 'listening' });

            return { state: 'listening', session: newSession, effects };
        }

        case 'PRESS_END': {
            if (state !== 'listening' || !session || session.cancelled) {
                // Superseded/idempotent release (Property 9) — no-op.
                return { state, session, effects: [] };
            }
            if (session.pointerType !== event.pointerType) {
                return { state, session, effects: [] };
            }

            const effects = [{ type: 'STOP_RECOGNIZER' }];
            const duration = event.now - session.startedAt;
            const transcript = (event.transcript || '').trim();

            if (duration < MIN_PRESS_DURATION_MS) {
                effects.push({ type: 'RENDER', state: 'idle' });
                return { state: 'idle', session: null, effects };
            }

            if (transcript.length === 0) {
                effects.push({ type: 'SHOW_NOTICE', text: 'ไม่ได้ยินเสียงพูด' });
                effects.push({ type: 'RENDER', state: 'idle' });
                return { state: 'idle', session: null, effects };
            }

            effects.push({ type: 'RENDER', state: 'processing' });
            effects.push({ type: 'SEND_CHAT', transcript, generation: session.generation });
            return { state: 'processing', session, effects };
        }

        case 'PRESS_CANCEL': {
            // touchcancel — only meaningful while a touch session is open.
            if (state !== 'listening' || !session || session.pointerType !== 'touch') {
                return { state, session, effects: [] };
            }
            // session becomes null (rather than kept with cancelled=true) so that any
            // subsequent mouseleave/touchend on the same physical press is a no-op (Property 9).
            return {
                state: 'idle',
                session: null,
                effects: [
                    { type: 'STOP_RECOGNIZER' },
                    { type: 'RENDER', state: 'idle' },
                ],
            };
        }

        case 'RECOGNIZER_START_FAILED': {
            if (state !== 'listening') {
                return { state, session, effects: [] };
            }
            // Treat like a non-no-speech recognizer error (Property 3 -> Property 13 path).
            return reduce(state, session, { type: 'RECOGNIZER_ERROR', code: 'start-failed' });
        }

        case 'RECOGNIZER_ERROR': {
            if (state !== 'listening') {
                return { state, session, effects: [] };
            }
            const effects = [{ type: 'STOP_RECOGNIZER' }];

            if (event.code === 'no-speech') {
                effects.push({ type: 'RENDER', state: 'idle' });
                return { state: 'idle', session: null, effects };
            }

            effects.push({ type: 'RENDER', state: 'error' });
            effects.push({ type: 'SHOW_ERROR', code: event.code });
            effects.push({ type: 'SCHEDULE_ERROR_TIMEOUT', ms: ERROR_DISPLAY_MS });
            return { state: 'error', session: null, effects };
        }

        case 'ERROR_TIMEOUT': {
            if (state !== 'error') {
                return { state, session, effects: [] };
            }
            return { state: 'idle', session: null, effects: [{ type: 'RENDER', state: 'idle' }] };
        }

        case 'CHAT_SUCCESS': {
            if (state !== 'processing' || !session || session.generation !== event.generation) {
                // Stale/superseded response — abandoned (Property 8).
                return { state, session, effects: [] };
            }
            return {
                state: 'speaking',
                session,
                effects: [
                    { type: 'RENDER', state: 'speaking' },
                    { type: 'SPEAK', text: event.responseText },
                ],
            };
        }

        case 'CHAT_FAILURE': {
            if (state !== 'processing' || !session || session.generation !== event.generation) {
                // Stale/superseded retry — abandoned (Property 8).
                return { state, session, effects: [] };
            }
            // Stay in processing, retry automatically.
            return {
                state: 'processing',
                session,
                effects: [{ type: 'SEND_CHAT', transcript: event.transcript, generation: session.generation }],
            };
        }

        case 'SYNTH_ERROR': {
            if (state !== 'speaking') {
                return { state, session, effects: [] };
            }
            // Stay in speaking, no message (Property 12).
            return { state, session, effects: [] };
        }

        case 'SYNTH_END': {
            if (state !== 'speaking') {
                return { state, session, effects: [] };
            }
            return { state: 'idle', session: null, effects: [{ type: 'RENDER', state: 'idle' }] };
        }

        default:
            return { state, session, effects: [] };
    }
}

// ─────────────────────────────────────────────────────────────────────────
// VoiceController — thin effect runner around the pure reduce() above.
// Wires real DOM events, Web Speech API, and YanangChatBridge to the reducer.
// ─────────────────────────────────────────────────────────────────────────

class VoiceController {
    /**
     * @param {{
     *   button: HTMLElement,
     *   recognizerFactory: () => any,   // returns a fresh SpeechRecognition-like object
     *   synthesizer: SpeechSynthesis,
     *   chatBridge: any,                // window.YanangChatBridge
     *   getUserPos: () => ({lat:number,lng:number}|null),
     *   getNearbyProjects: (lat:number, lng:number) => any[],
     *   clock?: { now: () => number },
     * }} deps
     */
    constructor({ button, recognizerFactory, synthesizer, chatBridge, getUserPos, getNearbyProjects, clock = Date }) {
        this.button = button;
        this.recognizerFactory = recognizerFactory;
        this.synthesizer = synthesizer;
        this.chatBridge = chatBridge;
        this.getUserPos = getUserPos || (() => null);
        this.getNearbyProjects = getNearbyProjects || (() => []);
        this.clock = clock;

        this.state = 'idle';
        this.session = null;
        this.recognizer = null;
        this.errorTimeoutId = null;
        this.currentTranscript = '';

        this._bind();
    }

    getState() {
        return this.state;
    }

    _bind() {
        this.button.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.button.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.button.addEventListener('mouseleave', (e) => this.handleMouseLeave(e));
        this.button.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.button.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        this.button.addEventListener('touchcancel', (e) => this.handleTouchCancel(e));
    }

    _dispatch(event) {
        const { state, session, effects } = reduce(this.state, this.session, event);
        this.state = state;
        this.session = session;
        for (const effect of effects) this._runEffect(effect);
    }

    _runEffect(effect) {
        switch (effect.type) {
            case 'START_RECOGNIZER':
                this._startRecognizer();
                break;
            case 'STOP_RECOGNIZER':
                this._stopRecognizer();
                break;
            case 'CANCEL_SYNTH':
                if (this.synthesizer) this.synthesizer.cancel();
                break;
            case 'SEND_CHAT':
                this._sendChat(effect.transcript, effect.generation);
                break;
            case 'SPEAK':
                this._speak(effect.text);
                break;
            case 'SCHEDULE_ERROR_TIMEOUT':
                this._scheduleErrorTimeout(effect.ms);
                break;
            case 'RENDER':
                this._render(effect.state);
                break;
            case 'SHOW_NOTICE':
            case 'SHOW_ERROR':
                if (this.chatBridge && this.chatBridge.addChat) {
                    const text = effect.type === 'SHOW_NOTICE' ? effect.text : this._errorMessage(effect.code);
                    this.chatBridge.addChat('ai', text);
                }
                break;
            default:
                break;
        }
    }

    _errorMessage(code) {
        if (code === 'not-allowed' || code === 'permission-denied') {
            return '⚠️ ไม่ได้รับอนุญาตให้ใช้ไมโครโฟน';
        }
        if (code === 'network') {
            return '⚠️ เกิดข้อผิดพลาดเครือข่ายขณะฟังเสียง';
        }
        return '⚠️ เกิดข้อผิดพลาดกับไมโครโฟน';
    }

    _startRecognizer() {
        this.currentTranscript = '';
        let recognizer;
        try {
            recognizer = this.recognizerFactory();
        } catch (e) {
            this._dispatch({ type: 'RECOGNIZER_START_FAILED' });
            return;
        }
        if (!recognizer) {
            this._dispatch({ type: 'RECOGNIZER_START_FAILED' });
            return;
        }

        this.recognizer = recognizer;
        recognizer.lang = 'th-TH';
        recognizer.interimResults = false;
        recognizer.onresult = (e) => {
            const t = e.results && e.results[0] && e.results[0][0] ? e.results[0][0].transcript : '';
            this.currentTranscript = t;
        };
        recognizer.onerror = (e) => {
            this._dispatch({ type: 'RECOGNIZER_ERROR', code: e.error || 'unknown' });
        };

        try {
            recognizer.start();
        } catch (e) {
            this._dispatch({ type: 'RECOGNIZER_START_FAILED' });
        }
    }

    _stopRecognizer() {
        if (this.recognizer) {
            try {
                this.recognizer.stop();
            } catch (e) {
                /* ignore */
            }
        }
    }

    async _sendChat(transcript, generation) {
        const activeStyle = this.chatBridge.getActiveStyle();
        if (!activeStyle) {
            // Property 18 / Req 9.2 — cannot determine a valid style, cancel and go idle.
            this.state = 'idle';
            this.session = null;
            this._render('idle');
            if (this.chatBridge.addChat) this.chatBridge.addChat('ai', '⚠️ เกิดข้อผิดพลาด ไม่พบสไตล์การตอบที่ถูกต้อง');
            return;
        }

        const history = this.chatBridge.getHistory();
        const payload = { message: transcript, style: activeStyle, history };

        const pos = this._safeGetUserPos();
        if (pos) {
            const nearby = this._safeGetNearbyProjects(pos.lat, pos.lng);
            payload.voiceContext = { location: { lat: pos.lat, lng: pos.lng } };
            if (nearby && nearby.length > 0) {
                payload.voiceContext.nearbyProjects = nearby;
            }
        }

        try {
            const data = await this.chatBridge.postChat(payload);
            if (data.response) {
                this.chatBridge.pushHistory(transcript, data.response);
            }
            this._dispatch({ type: 'CHAT_SUCCESS', responseText: data.response || '', generation });
        } catch (err) {
            this._dispatch({ type: 'CHAT_FAILURE', generation, transcript });
        }
    }

    _safeGetUserPos() {
        try {
            return this.getUserPos();
        } catch (e) {
            return null;
        }
    }

    _safeGetNearbyProjects(lat, lng) {
        try {
            return this.getNearbyProjects(lat, lng);
        } catch (e) {
            return [];
        }
    }

    _speak(text) {
        if (!text) {
            this._dispatch({ type: 'SYNTH_END' });
            return;
        }
        if (this.chatBridge.addChat) this.chatBridge.addChat('ai', text);
        if (this.chatBridge.speakThai) {
            this.chatBridge.speakThai(text);
        }
        // speakThai() in app.js doesn't expose an onend hook back to us, so we approximate
        // "speaking finished" by listening to the underlying speechSynthesis instance directly.
        if (this.synthesizer) {
            const checkDone = () => {
                if (!this.synthesizer.speaking) {
                    this._dispatch({ type: 'SYNTH_END' });
                } else {
                    setTimeout(checkDone, 200);
                }
            };
            setTimeout(checkDone, 200);
        } else {
            this._dispatch({ type: 'SYNTH_END' });
        }
    }

    _scheduleErrorTimeout(ms) {
        if (this.errorTimeoutId) clearTimeout(this.errorTimeoutId);
        this.errorTimeoutId = setTimeout(() => {
            this._dispatch({ type: 'ERROR_TIMEOUT' });
        }, ms);
    }

    _render(state) {
        this.button.classList.remove('listening', 'processing', 'speaking', 'error');
        if (state !== 'idle') this.button.classList.add(state);
    }

    // ── DOM event handlers ──
    handleMouseDown(e) {
        if (this.session && this.session.pointerType === 'touch') return; // Property/Req 3.2
        this._dispatch({ type: 'PRESS_START', pointerType: 'mouse', now: this.clock.now() });
    }

    handleTouchStart(e) {
        e.preventDefault(); // Req 3.1 — suppress synthetic mouse/click events
        this._dispatch({ type: 'PRESS_START', pointerType: 'touch', now: this.clock.now() });
    }

    handleMouseUp(e) {
        this._dispatch({
            type: 'PRESS_END',
            pointerType: 'mouse',
            now: this.clock.now(),
            transcript: this.currentTranscript,
        });
    }

    handleTouchEnd(e) {
        this._dispatch({
            type: 'PRESS_END',
            pointerType: 'touch',
            now: this.clock.now(),
            transcript: this.currentTranscript,
        });
    }

    handleTouchCancel(e) {
        this._dispatch({ type: 'PRESS_CANCEL', pointerType: 'touch' });
    }

    handleMouseLeave(e) {
        if (!this.session || this.session.pointerType !== 'mouse') return;
        this._dispatch({
            type: 'PRESS_END',
            pointerType: 'mouse',
            now: this.clock.now(),
            transcript: this.currentTranscript,
        });
    }
}

// ESM named exports — used by voice-controller.test.js (vitest) and by
// index.html when this file is loaded as a <script type="module"> in the browser.
export { reduce, MIN_PRESS_DURATION_MS, ERROR_DISPLAY_MS, VoiceController };

// Also attach to window for convenience/debugging in the browser runtime.
if (typeof window !== 'undefined') {
    window.VoiceControllerReducer = { reduce, MIN_PRESS_DURATION_MS, ERROR_DISPLAY_MS };
    window.VoiceController = VoiceController;
}
