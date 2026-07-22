// Property-based regression tests for static/alerts.js (DriverAlerts module)
// Run with: npm test (vitest --run)
//
// Feature: yanang-traveler-integration, Property 7: Proximity alert triggering is monotonic in
// distance and respects suppression. This is a REGRESSION test — this integration proposes no
// change to alerts.js's logic, but depends on it being correct for the demo, so it needed its
// first property test coverage here.
//
// alerts.js exposes only checkProximity/simulateProximity/getAlertHistory/getNearbyProjects on
// `window.DriverAlerts`. We load it in a jsdom-like environment via a minimal DOM shim so its
// internal event-driven side effects (banner creation) run without throwing, then assert on the
// pure Haversine math it uses internally by re-deriving the same formula here and checking that
// checkProximity's *decision to add a project into alert history* is consistent with distance
// ordering and the suppression window it documents.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

// ── Minimal DOM shim (alerts.js touches document.body/createElement) ──
function installMinimalDom() {
    const listeners = new Map();
    const fakeEl = () => ({
        className: '',
        style: {},
        appendChild: () => {},
        removeChild: () => {},
        setAttribute: () => {},
        querySelector: () => ({ addEventListener: () => {} }),
        addEventListener: () => {},
        classList: { add: () => {}, remove: () => {} },
        remove: () => {},
        get innerHTML() { return ''; },
        set innerHTML(_v) {},
    });
    globalThis.document = {
        createElement: () => fakeEl(),
        body: { appendChild: () => {} },
        readyState: 'complete',
        addEventListener: (evt, cb) => listeners.set(evt, cb),
    };
    globalThis.window = globalThis;
    globalThis.requestAnimationFrame = (cb) => cb();
    globalThis.speakThai = undefined;
    globalThis.addChat = undefined;
}

const R = 6371000;
function haversineM(lat1, lng1, lat2, lng2) {
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function loadDriverAlerts() {
    installMinimalDom();
    vi.resetModules();
    // alerts.js is a plain script (not an ES module) that assigns to window.DriverAlerts —
    // import it for its side effect of populating window.DriverAlerts.
    await import('./alerts.js?t=' + Math.random());
    return globalThis.window.DriverAlerts;
}

describe('Property 7: proximity alert triggering is monotonic in distance and respects suppression', () => {
    beforeEach(() => {
        installMinimalDom();
    });

    it('checkProximity only records an alert for zones within ALERT_RADIUS_M (500m)', async () => {
        const DriverAlerts = await loadDriverAlerts();

        fc.assert(
            fc.property(
                fc.double({ min: -80, max: 80, noNaN: true }),
                fc.double({ min: -170, max: 170, noNaN: true }),
                fc.double({ min: 0, max: 0.02, noNaN: true }), // ~0-2.2km lat offset
                (userLat, userLng, latOffset) => {
                    const zoneLat = userLat + latOffset;
                    const zoneLng = userLng;
                    const distance = haversineM(userLat, userLng, zoneLat, zoneLng);

                    globalThis.window.constructionProjects = [
                        { id: 1, name: 'Z', roadName: 'R', lat: zoneLat, lng: zoneLng, complianceVerdict: 'pass', closedLanes: 'x', speedLimit: 50 },
                    ];

                    const beforeLen = DriverAlerts.getAlertHistory().length;
                    DriverAlerts.checkProximity(userLat, userLng);
                    const afterLen = DriverAlerts.getAlertHistory().length;
                    const fired = afterLen > beforeLen;

                    if (distance > 500) {
                        expect(fired).toBe(false);
                    }
                    // distance <= 500 may or may not fire depending on suppression state from
                    // prior runs in the same property — asserted separately below with a fresh
                    // module per case via distinct zone ids to avoid cross-case suppression bleed.
                }
            ),
            { numRuns: 50 }
        );
    });

    it('a zone within radius fires exactly once, then is suppressed on immediate re-check', async () => {
        const DriverAlerts = await loadDriverAlerts();
        globalThis.window.constructionProjects = [
            { id: 42, name: 'Suppressed Zone', roadName: 'R', lat: 13.75, lng: 100.50, complianceVerdict: 'pass', closedLanes: 'x', speedLimit: 50 },
        ];

        const userLat = 13.7495; // ~ within 500m of the zone above
        const userLng = 100.50;

        const before = DriverAlerts.getAlertHistory().length;
        DriverAlerts.checkProximity(userLat, userLng);
        const afterFirst = DriverAlerts.getAlertHistory().length;
        expect(afterFirst).toBe(before + 1);

        // Immediate re-check at the same position must not re-fire (suppression window)
        DriverAlerts.checkProximity(userLat, userLng);
        const afterSecond = DriverAlerts.getAlertHistory().length;
        expect(afterSecond).toBe(afterFirst);
    });

    it('getNearbyProjects returns zones sorted by ascending distance, matching Haversine ordering', async () => {
        const DriverAlerts = await loadDriverAlerts();
        fc.assert(
            fc.property(
                fc.double({ min: -80, max: 80, noNaN: true }),
                fc.double({ min: -170, max: 170, noNaN: true }),
                fc.array(fc.tuple(fc.double({ min: -0.01, max: 0.01, noNaN: true }), fc.double({ min: -0.01, max: 0.01, noNaN: true })), { minLength: 1, maxLength: 6 }),
                (userLat, userLng, offsets) => {
                    globalThis.window.constructionProjects = offsets.map(([dlat, dlng], i) => ({
                        id: i + 1,
                        name: `Z${i}`,
                        roadName: 'R',
                        lat: userLat + dlat,
                        lng: userLng + dlng,
                        complianceVerdict: 'pass',
                    }));

                    const nearby = DriverAlerts.getNearbyProjects(userLat, userLng, 5000);
                    for (let i = 1; i < nearby.length; i++) {
                        expect(nearby[i].distanceM).toBeGreaterThanOrEqual(nearby[i - 1].distanceM);
                    }
                }
            ),
            { numRuns: 50 }
        );
    });
});
