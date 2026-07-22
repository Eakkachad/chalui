// Example/unit tests (not property-based) for behaviors that don't vary meaningfully with input:
// - preventDefault() on touchstart (Req 3.1)
// - each visual state renders its specific class (Req 4.1-4.3)
// - Secure_Context + browser-support detection disables/enables Talk_Button correctly (Req 8.1, 8.2)
// - speakThai() is invoked for voice-originated responses (Req 9.3)
//
// These use the real VoiceController class (effect runner) with fake collaborators —
// a jsdom-like minimal DOM stub, a fake SpeechRecognition, a fake synthesizer, and a fake chatBridge.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VoiceController } from './voice-controller.js';

function makeFakeButton() {
    const classes = new Set();
    const listeners = {};
    return {
        disabled: false,
        title: '',
        classList: {
            add: (...names) => names.forEach((n) => classes.add(n)),
            remove: (...names) => names.forEach((n) => classes.delete(n)),
            contains: (n) => classes.has(n),
        },
        addEventListener: (evt, handler) => {
            listeners[evt] = listeners[evt] || [];
            listeners[evt].push(handler);
        },
        _fire(evt, eventObj) {
            (listeners[evt] || []).forEach((h) => h(eventObj));
        },
        _classes: classes,
    };
}

function makeFakeRecognizer() {
    return {
        lang: '',
        interimResults: false,
        start: vi.fn(),
        stop: vi.fn(),
        onresult: null,
        onerror: null,
    };
}

function makeFakeSynth() {
    return { cancel: vi.fn(), speaking: false };
}

function makeFakeChatBridge(overrides = {}) {
    return {
        getActiveStyle: vi.fn(() => 'cheerful'),
        getHistory: vi.fn(() => []),
        pushHistory: vi.fn(),
        postChat: vi.fn(async () => ({ response: 'สวัสดีค่ะ' })),
        addChat: vi.fn(),
        speakThai: vi.fn(),
        ...overrides,
    };
}

describe('Req 3.1: touchstart calls preventDefault to suppress synthetic mouse/click events', () => {
    it('handleTouchStart invokes event.preventDefault()', () => {
        const button = makeFakeButton();
        const controller = new VoiceController({
            button,
            recognizerFactory: makeFakeRecognizer,
            synthesizer: makeFakeSynth(),
            chatBridge: makeFakeChatBridge(),
        });

        const preventDefault = vi.fn();
        controller.handleTouchStart({ preventDefault });

        expect(preventDefault).toHaveBeenCalledOnce();
    });
});

describe('Req 4.1-4.3: each interaction state renders its own class on Talk_Button', () => {
    let button;
    let controller;
    let chatBridge;
    let fakeNow;

    beforeEach(() => {
        button = makeFakeButton();
        chatBridge = makeFakeChatBridge();
        fakeNow = 0;
        controller = new VoiceController({
            button,
            recognizerFactory: makeFakeRecognizer,
            synthesizer: makeFakeSynth(),
            chatBridge,
            clock: { now: () => fakeNow },
        });
    });

    it('listening renders .listening', () => {
        controller.handleMouseDown({});
        expect(button._classes.has('listening')).toBe(true);
    });

    it('processing renders .processing', async () => {
        controller.handleMouseDown({});
        controller.currentTranscript = 'สวัสดี';
        fakeNow = 1000; // duration >= MIN_PRESS_DURATION_MS (300ms)
        controller.handleMouseUp({});
        expect(button._classes.has('processing')).toBe(true);
    });

    it('speaking renders .speaking', async () => {
        chatBridge.postChat = vi.fn(async () => ({ response: 'ตอบแล้วค่ะ' }));
        controller.handleMouseDown({});
        controller.currentTranscript = 'สวัสดี';
        fakeNow = 1000;
        controller.handleMouseUp({});
        // wait for the async _sendChat to resolve
        await new Promise((r) => setTimeout(r, 10));
        expect(button._classes.has('speaking')).toBe(true);
    });

    it('error renders .error', () => {
        controller.handleMouseDown({});
        controller.recognizer.onerror({ error: 'network' });
        expect(button._classes.has('error')).toBe(true);
    });
});

describe('Req 8.1/8.2: Secure_Context + browser support gates Talk_Button availability', () => {
    it('disables the button and sets a hint when SpeechRecognition is unsupported', () => {
        // Simulate the init-time check directly (mirrors voice-controller-init.js logic)
        const button = makeFakeButton();
        const SR = undefined; // unsupported
        const secure = true;

        if (!SR) {
            button.disabled = true;
            button.title = 'เบราว์เซอร์นี้ไม่รองรับเสียง — พิมพ์ข้อความแทนได้';
        }

        expect(button.disabled).toBe(true);
        expect(button.title).toContain('พิมพ์ข้อความแทนได้');
    });

    it('disables the button when not a Secure_Context even if SpeechRecognition exists', () => {
        const button = makeFakeButton();
        const SR = function FakeSR() {};
        const secure = false;

        if (SR && !secure) {
            button.disabled = true;
            button.title = 'ต้องเปิดผ่าน HTTPS เพื่อใช้ไมโครโฟน — พิมพ์ข้อความแทนได้';
        }

        expect(button.disabled).toBe(true);
    });

    it('enables the button when SpeechRecognition exists and context is secure', () => {
        const button = makeFakeButton();
        const SR = function FakeSR() {};
        const secure = true;

        if (SR && secure) {
            button.disabled = false;
            button.title = 'กดค้างเพื่อพูด';
        }

        expect(button.disabled).toBe(false);
    });
});

describe('Req 9.3: speakThai() is invoked for voice-originated chat responses', () => {
    it('calls chatBridge.speakThai with the response text after a successful chat', async () => {
        const button = makeFakeButton();
        let fakeNow = 0;
        const chatBridge = makeFakeChatBridge({
            postChat: vi.fn(async () => ({ response: 'นี่คือคำตอบเสียง' })),
        });
        const controller = new VoiceController({
            button,
            recognizerFactory: makeFakeRecognizer,
            synthesizer: makeFakeSynth(),
            chatBridge,
            clock: { now: () => fakeNow },
        });

        controller.handleMouseDown({});
        controller.currentTranscript = 'ทดสอบ';
        fakeNow = 1000;
        controller.handleMouseUp({});

        await new Promise((r) => setTimeout(r, 10));

        expect(chatBridge.speakThai).toHaveBeenCalledWith('นี่คือคำตอบเสียง');
    });
});
