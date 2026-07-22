// Property-based tests for the pure push-to-talk reducer (static/voice-controller.js)
// Run with: npm test  (vitest --run)

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { reduce, MIN_PRESS_DURATION_MS, ERROR_DISPLAY_MS } from './voice-controller.js';

const POINTER_TYPES = ['mouse', 'touch'];
const RECOGNIZER_ERROR_CODES = ['no-speech', 'not-allowed', 'network', 'aborted', 'audio-capture'];
const NON_NO_SPEECH_CODES = RECOGNIZER_ERROR_CODES.filter((c) => c !== 'no-speech');

function freshSession(pointerType, startedAt, generation = 1) {
    return { pointerType, startedAt, cancelled: false, generation };
}

// Feature: push-to-talk-voice-assistant, Property 1: Press guard with speaking-cancel exception
describe('Property 1: press guard with speaking-cancel exception', () => {
    it('starts a new session iff state is idle or speaking; cancels synth when leaving speaking', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('idle', 'listening', 'processing', 'speaking', 'error'),
                fc.constantFrom(...POINTER_TYPES),
                fc.integer({ min: 0, max: 1_000_000 }),
                (state, pointerType, now) => {
                    const session = state === 'idle' || state === 'speaking' ? null : freshSession(pointerType, 0);
                    const result = reduce(state, session, { type: 'PRESS_START', pointerType, now });

                    if (state === 'idle' || state === 'speaking') {
                        expect(result.state).toBe('listening');
                        expect(result.session).not.toBeNull();
                        expect(result.session.pointerType).toBe(pointerType);
                        const hasStart = result.effects.some((e) => e.type === 'START_RECOGNIZER');
                        expect(hasStart).toBe(true);
                        if (state === 'speaking') {
                            const hasCancel = result.effects.some((e) => e.type === 'CANCEL_SYNTH');
                            expect(hasCancel).toBe(true);
                        }
                    } else {
                        expect(result.state).toBe(state);
                        expect(result.effects.length).toBe(0);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});

// Feature: push-to-talk-voice-assistant, Property 2: Entering listening always starts the recognizer
describe('Property 2: entering listening always starts the recognizer', () => {
    it('every transition into listening includes exactly one START_RECOGNIZER effect', () => {
        fc.assert(
            fc.property(fc.constantFrom('idle', 'speaking'), fc.constantFrom(...POINTER_TYPES), (state, pointerType) => {
                const result = reduce(state, null, { type: 'PRESS_START', pointerType, now: 0 });
                const startCount = result.effects.filter((e) => e.type === 'START_RECOGNIZER').length;
                expect(startCount).toBe(1);
            }),
            { numRuns: 100 }
        );
    });
});

// Feature: push-to-talk-voice-assistant, Property 3: Recognizer start failure aborts recording
describe('Property 3: recognizer start failure aborts recording', () => {
    it('RECOGNIZER_START_FAILED while listening never leaves the controller in listening', () => {
        fc.assert(
            fc.property(fc.constantFrom(...POINTER_TYPES), (pointerType) => {
                const session = freshSession(pointerType, 0);
                const result = reduce('listening', session, { type: 'RECOGNIZER_START_FAILED' });
                expect(result.state).not.toBe('listening');
            }),
            { numRuns: 100 }
        );
    });
});

// Feature: push-to-talk-voice-assistant, Property 4: Matching release closes the open session immediately
describe('Property 4: matching release closes the open session immediately', () => {
    it('PRESS_END with matching pointer type and duration >= min + transcript stops the recognizer and closes the session', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...POINTER_TYPES),
                fc.integer({ min: MIN_PRESS_DURATION_MS, max: MIN_PRESS_DURATION_MS + 100000 }),
                fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
                (pointerType, duration, transcript) => {
                    const session = freshSession(pointerType, 0);
                    const result = reduce('listening', session, {
                        type: 'PRESS_END',
                        pointerType,
                        now: duration,
                        transcript,
                    });
                    const hasStop = result.effects.some((e) => e.type === 'STOP_RECOGNIZER');
                    expect(hasStop).toBe(true);
                    // session is closed: either null (idle) or moved into processing with same session ref, never "still listening with same open session"
                    expect(result.state).not.toBe('listening');
                }
            ),
            { numRuns: 100 }
        );
    });
});

// Feature: push-to-talk-voice-assistant, Property 5: Short or explicitly-cancelled sessions suppress the request
describe('Property 5: short or explicitly-cancelled sessions suppress the request', () => {
    it('duration < MIN_PRESS_DURATION_MS discards transcript and returns to idle without SEND_CHAT', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...POINTER_TYPES),
                fc.integer({ min: 0, max: MIN_PRESS_DURATION_MS - 1 }),
                fc.string({ minLength: 1, maxLength: 50 }),
                (pointerType, duration, transcript) => {
                    const session = freshSession(pointerType, 0);
                    const result = reduce('listening', session, {
                        type: 'PRESS_END',
                        pointerType,
                        now: duration,
                        transcript,
                    });
                    expect(result.state).toBe('idle');
                    const hasSend = result.effects.some((e) => e.type === 'SEND_CHAT');
                    expect(hasSend).toBe(false);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('touchcancel while a touch session is open discards and returns to idle without SEND_CHAT', () => {
        fc.assert(
            fc.property(fc.integer({ min: 0, max: 100000 }), (startedAt) => {
                const session = freshSession('touch', startedAt);
                const result = reduce('listening', session, { type: 'PRESS_CANCEL', pointerType: 'touch' });
                expect(result.state).toBe('idle');
                const hasSend = result.effects.some((e) => e.type === 'SEND_CHAT');
                expect(hasSend).toBe(false);
            }),
            { numRuns: 100 }
        );
    });
});

// Feature: push-to-talk-voice-assistant, Property 6: Valid duration with non-empty transcript sends immediately
describe('Property 6: valid duration with non-empty transcript sends immediately', () => {
    it('exactly one SEND_CHAT effect is produced and state becomes processing', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...POINTER_TYPES),
                fc.integer({ min: MIN_PRESS_DURATION_MS, max: MIN_PRESS_DURATION_MS + 50000 }),
                fc.string({ minLength: 1, maxLength: 80 }).filter((s) => s.trim().length > 0),
                (pointerType, duration, transcript) => {
                    const session = freshSession(pointerType, 0);
                    const result = reduce('listening', session, {
                        type: 'PRESS_END',
                        pointerType,
                        now: duration,
                        transcript,
                    });
                    expect(result.state).toBe('processing');
                    const sendEffects = result.effects.filter((e) => e.type === 'SEND_CHAT');
                    expect(sendEffects.length).toBe(1);
                }
            ),
            { numRuns: 100 }
        );
    });
});

// Feature: push-to-talk-voice-assistant, Property 7: Valid duration with empty transcript returns to idle without a request
describe('Property 7: valid duration with empty transcript returns to idle without a request', () => {
    it('whitespace-only or empty transcript returns to idle with a SHOW_NOTICE and no SEND_CHAT', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...POINTER_TYPES),
                fc.integer({ min: MIN_PRESS_DURATION_MS, max: MIN_PRESS_DURATION_MS + 50000 }),
                fc.constantFrom('', '   ', '\t', '\n  '),
                (pointerType, duration, transcript) => {
                    const session = freshSession(pointerType, 0);
                    const result = reduce('listening', session, {
                        type: 'PRESS_END',
                        pointerType,
                        now: duration,
                        transcript,
                    });
                    expect(result.state).toBe('idle');
                    const hasSend = result.effects.some((e) => e.type === 'SEND_CHAT');
                    expect(hasSend).toBe(false);
                    const hasNotice = result.effects.some((e) => e.type === 'SHOW_NOTICE');
                    expect(hasNotice).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });
});

// Feature: push-to-talk-voice-assistant, Property 8: Automatic retry until success or supersession
describe('Property 8: automatic retry until success or supersession', () => {
    it('CHAT_FAILURE with matching generation stays in processing and re-sends', () => {
        fc.assert(
            fc.property(fc.integer({ min: 1, max: 1000 }), fc.string({ minLength: 1, maxLength: 30 }), (generation, transcript) => {
                const session = { pointerType: 'mouse', startedAt: 0, cancelled: false, generation };
                const result = reduce('processing', session, { type: 'CHAT_FAILURE', generation, transcript });
                expect(result.state).toBe('processing');
                const hasSend = result.effects.some((e) => e.type === 'SEND_CHAT');
                expect(hasSend).toBe(true);
            }),
            { numRuns: 100 }
        );
    });

    it('CHAT_FAILURE/CHAT_SUCCESS with a stale (mismatched) generation is abandoned as a no-op', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 1000 }),
                fc.integer({ min: 1, max: 1000 }),
                fc.boolean(),
                (currentGen, eventGen, isSuccess) => {
                    fc.pre(currentGen !== eventGen);
                    const session = { pointerType: 'mouse', startedAt: 0, cancelled: false, generation: currentGen };
                    const event = isSuccess
                        ? { type: 'CHAT_SUCCESS', responseText: 'x', generation: eventGen }
                        : { type: 'CHAT_FAILURE', generation: eventGen, transcript: 'x' };
                    const result = reduce('processing', session, event);
                    expect(result.state).toBe('processing');
                    expect(result.effects.length).toBe(0);
                }
            ),
            { numRuns: 100 }
        );
    });
});

// Feature: push-to-talk-voice-assistant, Property 9: Superseded release events are idempotent
describe('Property 9: superseded release events are idempotent', () => {
    it('PRESS_END/PRESS_CANCEL on an already-closed session (session=null) leaves state unchanged', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('idle', 'processing', 'speaking', 'error'),
                fc.constantFrom(...POINTER_TYPES),
                (state, pointerType) => {
                    const result = reduce(state, null, { type: 'PRESS_END', pointerType, now: 10000, transcript: 'hi' });
                    expect(result.state).toBe(state);
                    expect(result.session).toBeNull();
                    expect(result.effects.length).toBe(0);
                }
            ),
            { numRuns: 100 }
        );
    });
});

// Feature: push-to-talk-voice-assistant, Property 10 & 11: rendering — covered structurally via RENDER effect's `state` field
describe('Property 10: returning to idle clears prior visual state (render effect emitted)', () => {
    it('every transition to idle carries a RENDER effect tagged idle', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...POINTER_TYPES),
                fc.integer({ min: 0, max: MIN_PRESS_DURATION_MS - 1 }),
                (pointerType, duration) => {
                    const session = freshSession(pointerType, 0);
                    const result = reduce('listening', session, {
                        type: 'PRESS_END',
                        pointerType,
                        now: duration,
                        transcript: 'x',
                    });
                    const renderIdle = result.effects.find((e) => e.type === 'RENDER' && e.state === 'idle');
                    expect(renderIdle).toBeTruthy();
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('Property 11: distinct states render distinct RENDER tags', () => {
    it('listening/processing/speaking/error RENDER effects never collide for their own transition', () => {
        const cases = [
            { from: ['idle', null], event: { type: 'PRESS_START', pointerType: 'mouse', now: 0 }, expected: 'listening' },
            {
                from: [
                    'listening',
                    freshSession('mouse', 0),
                ],
                event: { type: 'PRESS_END', pointerType: 'mouse', now: MIN_PRESS_DURATION_MS, transcript: 'hi' },
                expected: 'processing',
            },
            {
                from: ['processing', freshSession('mouse', 0)],
                event: { type: 'CHAT_SUCCESS', responseText: 'hi', generation: 1 },
                expected: 'speaking',
            },
            {
                from: ['listening', freshSession('mouse', 0)],
                event: { type: 'RECOGNIZER_ERROR', code: 'network' },
                expected: 'error',
            },
        ];
        const seenTags = new Set();
        for (const c of cases) {
            const [state, session] = c.from;
            const result = reduce(state, session, c.event);
            expect(result.state).toBe(c.expected);
            const renderEffect = result.effects.find((e) => e.type === 'RENDER');
            expect(renderEffect).toBeTruthy();
            expect(renderEffect.state).toBe(c.expected);
            expect(seenTags.has(renderEffect.state)).toBe(false);
            seenTags.add(renderEffect.state);
        }
    });
});

// Feature: push-to-talk-voice-assistant, Property 12: Synthesizer errors during speaking do not interrupt playback state
describe('Property 12: synthesizer errors during speaking do not interrupt playback state', () => {
    it('SYNTH_ERROR while speaking stays in speaking with no effects', () => {
        fc.assert(
            fc.property(fc.integer({ min: 1, max: 1000 }), (generation) => {
                const session = { pointerType: 'mouse', startedAt: 0, cancelled: false, generation };
                const result = reduce('speaking', session, { type: 'SYNTH_ERROR' });
                expect(result.state).toBe('speaking');
                expect(result.effects.length).toBe(0);
            }),
            { numRuns: 100 }
        );
    });
});

// Feature: push-to-talk-voice-assistant, Property 13: Non-no-speech recognizer errors produce a temporary error state
describe('Property 13: non-no-speech recognizer errors produce a temporary error state', () => {
    it('transitions to error, shows a message, and schedules a timeout of ERROR_DISPLAY_MS', () => {
        fc.assert(
            fc.property(fc.constantFrom(...NON_NO_SPEECH_CODES), fc.constantFrom(...POINTER_TYPES), (code, pointerType) => {
                const session = freshSession(pointerType, 0);
                const result = reduce('listening', session, { type: 'RECOGNIZER_ERROR', code });
                expect(result.state).toBe('error');
                const hasShowError = result.effects.some((e) => e.type === 'SHOW_ERROR');
                expect(hasShowError).toBe(true);
                const timeoutEffect = result.effects.find((e) => e.type === 'SCHEDULE_ERROR_TIMEOUT');
                expect(timeoutEffect).toBeTruthy();
                expect(timeoutEffect.ms).toBe(ERROR_DISPLAY_MS);
            }),
            { numRuns: 100 }
        );
    });

    it('ERROR_TIMEOUT from error returns to idle', () => {
        const result = reduce('error', null, { type: 'ERROR_TIMEOUT' });
        expect(result.state).toBe('idle');
    });
});

// Feature: push-to-talk-voice-assistant, Property 14: no-speech errors return silently to idle
describe('Property 14: no-speech errors return silently to idle', () => {
    it('no-speech goes straight to idle without SHOW_ERROR, unlike other codes', () => {
        fc.assert(
            fc.property(fc.constantFrom(...POINTER_TYPES), (pointerType) => {
                const session = freshSession(pointerType, 0);
                const result = reduce('listening', session, { type: 'RECOGNIZER_ERROR', code: 'no-speech' });
                expect(result.state).toBe('idle');
                const hasShowError = result.effects.some((e) => e.type === 'SHOW_ERROR');
                expect(hasShowError).toBe(false);
            }),
            { numRuns: 100 }
        );
    });
});

// Feature: push-to-talk-voice-assistant, Property 15: any recognizer error suppresses the chat request
describe('Property 15: any recognizer error suppresses the chat request', () => {
    it('no SEND_CHAT effect is ever produced by a RECOGNIZER_ERROR of any code', () => {
        fc.assert(
            fc.property(fc.constantFrom(...RECOGNIZER_ERROR_CODES), fc.constantFrom(...POINTER_TYPES), (code, pointerType) => {
                const session = freshSession(pointerType, 0);
                const result = reduce('listening', session, { type: 'RECOGNIZER_ERROR', code });
                const hasSend = result.effects.some((e) => e.type === 'SEND_CHAT');
                expect(hasSend).toBe(false);
            }),
            { numRuns: 100 }
        );
    });
});

// Feature: push-to-talk-voice-assistant, Property 17: voice requests always sent; context attached only when available
// (This property concerns payload construction, exercised at the VoiceController/effect-runner level, not the
// reducer itself — the reducer only guarantees exactly one SEND_CHAT effect fires with the transcript, see Property 6.
// Documented here to cross-reference; concrete payload-building tests live alongside the VoiceController integration.)
describe('Property 17: SEND_CHAT effect always carries the transcript needed to build the request', () => {
    it('the SEND_CHAT effect from a valid PRESS_END always includes a non-empty transcript', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...POINTER_TYPES),
                fc.string({ minLength: 1, maxLength: 60 }).filter((s) => s.trim().length > 0),
                (pointerType, transcript) => {
                    const session = freshSession(pointerType, 0);
                    const result = reduce('listening', session, {
                        type: 'PRESS_END',
                        pointerType,
                        now: MIN_PRESS_DURATION_MS,
                        transcript,
                    });
                    const sendEffect = result.effects.find((e) => e.type === 'SEND_CHAT');
                    expect(sendEffect.transcript.length).toBeGreaterThan(0);
                }
            ),
            { numRuns: 100 }
        );
    });
});

// Feature: push-to-talk-voice-assistant, Property 18: style attachment is a caller (effect-runner) responsibility
// The reducer itself doesn't know about Active_Style — SEND_CHAT effects are enriched with style by the
// VoiceController before calling YanangChatBridge.postChat(). We assert the reducer's contract here: it always
// emits generation alongside the transcript so the caller can correctly attach style/context per-session.
describe('Property 18 (reducer contract): SEND_CHAT always carries the session generation', () => {
    it('SEND_CHAT effect includes the generation of the session that produced it', () => {
        fc.assert(
            fc.property(fc.constantFrom(...POINTER_TYPES), fc.integer({ min: 1, max: 1000 }), (pointerType, generation) => {
                const session = { pointerType, startedAt: 0, cancelled: false, generation };
                const result = reduce('listening', session, {
                    type: 'PRESS_END',
                    pointerType,
                    now: MIN_PRESS_DURATION_MS,
                    transcript: 'hello',
                });
                const sendEffect = result.effects.find((e) => e.type === 'SEND_CHAT');
                expect(sendEffect.generation).toBe(generation);
            }),
            { numRuns: 100 }
        );
    });
});
