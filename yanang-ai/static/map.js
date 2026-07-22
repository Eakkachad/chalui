// ย่านาง AI — Map + Navigation Controller

let yanangMap = null;
let routeLayer = null;
let placeMarkers = [];
let userMarker = null;
let constructionMarkers = [];
let constructionProjects = [];

// ── Init Map ──
function initMap() {
    const el = document.getElementById('map');
    if (!el || el._leaflet_id) return; // already initialized
    
    yanangMap = L.map('map', {
        center: [13.7563, 100.5018],
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
    }).addTo(yanangMap);

    L.control.zoom({ position: 'bottomright' }).addTo(yanangMap);

    // Force Leaflet to recalculate size (fix blank map on mobile)
    setTimeout(() => {
        if (yanangMap) yanangMap.invalidateSize();
    }, 300);

    // Load construction zones (mock feed — เดียวกับ contractor/admin roles)
    loadConstructionProjects();

    // Get + track user location (watchPosition เพื่อให้ proximity alert ทำงานต่อเนื่อง)
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
            (pos) => {
                const {latitude:lat, longitude:lng} = pos.coords;
                const firstFix = !window.userPos;
                window.userPos = {lat, lng};

                if (!userMarker) {
                    userMarker = L.circleMarker([lat, lng], {
                        radius: 10, color:'#4285F4', fillColor:'#4285F4', fillOpacity:0.8, weight:2,
                    }).addTo(yanangMap).bindPopup('🚗 คุณ');
                } else {
                    userMarker.setLatLng([lat, lng]);
                }

                if (firstFix) yanangMap.setView([lat, lng], 15);

                // Real-distance proximity alert against construction zones
                if (window.DriverAlerts) window.DriverAlerts.checkProximity(lat, lng);
            },
            () => {}, // fallback Bangkok — ไม่ได้รับอนุญาต geolocation
            { enableHighAccuracy: true, maximumAge: 5000 }
        );
    }
}

// ── Load construction zones from backend (mock feed) ──
async function loadConstructionProjects() {
    try {
        const res = await fetch('/api/construction/projects');
        if (!res.ok) throw new Error('load failed');
        constructionProjects = await res.json();
        window.constructionProjects = constructionProjects;
        renderConstructionMarkers();
    } catch (err) {
        console.warn('[Construction] โหลดข้อมูลก่อสร้างไม่สำเร็จ', err);
    }
}

function complianceIcon(project) {
    const verdict = project.complianceVerdict;
    const emoji = verdict === 'fail' ? '🚧' : verdict === 'pending' ? '🕓' : '🚧';
    const cls = verdict === 'fail' ? 'construction-marker danger' : verdict === 'pending' ? 'construction-marker pending' : 'construction-marker ok';
    return L.divIcon({
        className: cls,
        html: `<span>${emoji}</span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
    });
}

function constructionPopupHtml(project) {
    const verdictLabel = project.complianceVerdict === 'fail'
        ? '❌ ไม่ผ่านมาตรฐาน'
        : project.complianceVerdict === 'pending'
            ? '⏳ รอตรวจสอบ'
            : '✅ ผ่านมาตรฐาน';
    return `
        <div class="construction-popup">
            <strong>${project.name}</strong>
            <div>🛣️ ${project.roadName}</div>
            <div>🏗️ ${project.contractor}</div>
            <div>${verdictLabel}</div>
            <div>🚗 จำกัดความเร็ว ${project.speedLimit} กม./ชม.</div>
            <div>🚧 ${project.closedLanes}</div>
        </div>
    `;
}

function renderConstructionMarkers() {
    constructionMarkers.forEach(m => yanangMap.removeLayer(m));
    constructionMarkers = [];

    constructionProjects.forEach(project => {
        const marker = L.marker([project.lat, project.lng], {
            icon: complianceIcon(project),
        }).addTo(yanangMap).bindPopup(constructionPopupHtml(project));
        constructionMarkers.push(marker);
    });
}

// ── Draw route on map ──
function drawRoute(routeData, label) {
    if (routeLayer) yanangMap.removeLayer(routeLayer);

    // GeoJSON [lng,lat] → Leaflet [lat,lng]
    const coords = routeData.polyline.coordinates.map(c => [c[1], c[0]]);
    if (coords.length === 0) return;

    routeLayer = L.polyline(coords, {
        color: '#6c5ce7', weight: 6, opacity: 0.85,
    }).addTo(yanangMap);

    // Fit map to route
    const bounds = L.latLngBounds(coords);
    yanangMap.fitBounds(bounds.pad(0.15));

    // Start marker (blue dot)
    const start = coords[0];
    L.circleMarker(start, {
        radius: 8, color:'#00b894', fillColor:'#00b894', fillOpacity:0.9,
    }).addTo(yanangMap);

    // End pin (📍)
    const end = coords[coords.length - 1];
    L.marker(end, {
        icon: L.divIcon({ className:'dest-marker', html:'📍', iconSize:[24,24], iconAnchor:[12,24] }),
    }).addTo(yanangMap).bindPopup(label);
}

// ── Show places on map (POI from Overpass) ──
function showPlaces(places) {
    placeMarkers.forEach(m => yanangMap.removeLayer(m));
    placeMarkers = [];
    if (!places || places.length === 0) return;

    const bounds = L.latLngBounds([]);
    places.forEach(p => {
        const m = L.marker([p.lat, p.lng], {
            icon: L.divIcon({ className:'poi-marker', html:'📍', iconSize:[20,20], iconAnchor:[10,20] }),
        }).addTo(yanangMap).bindPopup(`<b>${p.name}</b>`);
        placeMarkers.push(m);
        bounds.extend([p.lat, p.lng]);
    });
    yanangMap.fitBounds(bounds.pad(0.1));
}

// ── Start map when ready ──
function tryInit() {
    const el = document.getElementById('map');
    if (el && !el._leaflet_id && typeof L !== 'undefined') {
        initMap();
    } else {
        setTimeout(tryInit, 200);
    }
}
tryInit();
window.addEventListener('load', () => setTimeout(tryInit, 100));

// ── Demo helper: จำลองรถเข้าใกล้โซนที่ไม่ผ่านมาตรฐาน (ไม่ต้องมี GPS จริงตรงจุด) ──
// Demo_Alert_Helper (yanang-traveler-integration Requirement 3.4) — เครื่องมือ dev/demo เท่านั้น
// ไม่ถูกเรียกจาก production path ใดๆ ของการนำทาง/ติดตามตำแหน่ง (ดู initMap() ข้างบนที่ใช้
// navigator.geolocation.watchPosition() จริงเสมอ) ห้ามใช้แทน Real_Navigation_Path
function testConstructionAlert() {
    if (!constructionProjects.length) {
        console.warn('[Construction] ยังไม่มีข้อมูลโซนก่อสร้าง');
        return;
    }
    const target = constructionProjects.find(p => p.complianceVerdict === 'fail') || constructionProjects[0];
    // จำลองตำแหน่งรถให้อยู่ ~300m จากโซน (อยู่ในระยะ alert 500m)
    const simLat = target.lat + 0.0027;
    const simLng = target.lng;

    if (yanangMap) yanangMap.setView([simLat, simLng], 15);
    if (window.DriverAlerts) window.DriverAlerts.simulateProximity(simLat, simLng);
}
window.testConstructionAlert = testConstructionAlert;
