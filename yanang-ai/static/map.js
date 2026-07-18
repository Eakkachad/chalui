// ย่านาง AI — Map + Navigation Controller

let yanangMap = null;
let routeLayer = null;
let placeMarkers = [];
let userMarker = null;

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

    // Get user location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const {latitude:lat, longitude:lng} = pos.coords;
                window.userPos = {lat, lng};
                yanangMap.setView([lat, lng], 15);
                userMarker = L.circleMarker([lat, lng], {
                    radius: 10, color:'#4285F4', fillColor:'#4285F4', fillOpacity:0.8, weight:2,
                }).addTo(yanangMap).bindPopup('🚗 คุณ');
            },
            () => {} // fallback Bangkok
        );
    }
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
