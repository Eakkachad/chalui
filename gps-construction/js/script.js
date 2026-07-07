const thailandCenter = [13.86, 100.61];
const hasLeaflet = typeof window.L !== "undefined";

const statuses = {
  completed: { label: "Completed", icon: "fa-check", abbr: "C", color: "#23a455" },
  "in-progress": { label: "In Progress", icon: "fa-person-digging", abbr: "P", color: "#f1b12c" },
  delayed: { label: "Delayed", icon: "fa-triangle-exclamation", abbr: "D", color: "#df4a43" },
  planned: { label: "Planned", icon: "fa-calendar-days", abbr: "N", color: "#3378dc" }
};

const roadAnchors = [
  { name: "Chaeng Watthana Road - Lak Si", province: "Bangkok", lat: 13.8952, lng: 100.5792 },
  { name: "Chaeng Watthana Road - Government Complex", province: "Bangkok", lat: 13.8897, lng: 100.5634 },
  { name: "Vibhavadi Rangsit Road - Lak Si", province: "Bangkok", lat: 13.8793, lng: 100.5798 },
  { name: "Ram Inthra Road - KM 4", province: "Bangkok", lat: 13.8584, lng: 100.6435 },
  { name: "Ram Inthra Road - Watcharapol", province: "Bangkok", lat: 13.8594, lng: 100.6734 },
  { name: "Phahonyothin Road - Kasetsart", province: "Bangkok", lat: 13.8428, lng: 100.5716 },
  { name: "Lat Phrao Road - Bang Kapi", province: "Bangkok", lat: 13.7668, lng: 100.6439 },
  { name: "Srinagarindra Road - Hua Mak", province: "Bangkok", lat: 13.7358, lng: 100.6418 },
  { name: "Ratchadaphisek Road - Lat Phrao", province: "Bangkok", lat: 13.8067, lng: 100.5744 },
  { name: "Ngam Wong Wan Road - Khae Rai", province: "Nonthaburi", lat: 13.8611, lng: 100.5158 },
  { name: "Tiwanon Road - Pak Kret", province: "Nonthaburi", lat: 13.9104, lng: 100.4977 },
  { name: "Min Buri Road - Suwinthawong", province: "Bangkok", lat: 13.8131, lng: 100.7332 }
];

const projects = [
  { id: 1, name: "Bangkok Pink Line Extension", province: "Bangkok", contractor: "Siam Infra JV", status: "in-progress", start: "2026-01-15", end: "2027-05-30", lat: 13.8952, lng: 100.5792, roadName: "Chaeng Watthana Road", radiusKm: 0.42 },
  { id: 2, name: "Chaeng Watthana Utility Relocation", province: "Bangkok", contractor: "Metro Utility Works", status: "delayed", start: "2025-11-18", end: "2026-12-10", lat: 13.8897, lng: 100.5634, roadName: "Chaeng Watthana Road", radiusKm: 0.38 },
  { id: 3, name: "Lak Si Drainage Cutover", province: "Bangkok", contractor: "Canal Civil", status: "in-progress", start: "2026-02-01", end: "2026-11-20", lat: 13.8793, lng: 100.5798, roadName: "Vibhavadi Rangsit Road", radiusKm: 0.36 },
  { id: 4, name: "Ram Inthra Pavement Renewal KM4", province: "Bangkok", contractor: "Bangkok Roadcare", status: "in-progress", start: "2025-08-22", end: "2027-01-18", lat: 13.8584, lng: 100.6435, roadName: "Ram Inthra Road", radiusKm: 0.44 },
  { id: 5, name: "Watcharapol Bridge Bearing Repair", province: "Bangkok", contractor: "Eastern Bridge Co.", status: "planned", start: "2026-09-01", end: "2027-03-20", lat: 13.8594, lng: 100.6734, roadName: "Ram Inthra Road", radiusKm: 0.32 },
  { id: 6, name: "Kasetsart Station Footpath Works", province: "Bangkok", contractor: "Green Walk JV", status: "completed", start: "2025-03-12", end: "2026-02-28", lat: 13.8428, lng: 100.5716, roadName: "Phahonyothin Road", radiusKm: 0.28 },
  { id: 7, name: "Lat Phrao Junction Signal Upgrade", province: "Bangkok", contractor: "Signal Thai", status: "delayed", start: "2025-06-04", end: "2027-08-30", lat: 13.8067, lng: 100.5744, roadName: "Ratchadaphisek Road", radiusKm: 0.4 },
  { id: 8, name: "Bang Kapi Bus Lane Improvement", province: "Bangkok", contractor: "Urban Move", status: "in-progress", start: "2026-04-11", end: "2027-01-09", lat: 13.7668, lng: 100.6439, roadName: "Lat Phrao Road", radiusKm: 0.35 },
  { id: 9, name: "Hua Mak Stormwater Main", province: "Bangkok", contractor: "Waterline Thai", status: "delayed", start: "2025-07-14", end: "2026-10-22", lat: 13.7358, lng: 100.6418, roadName: "Srinagarindra Road", radiusKm: 0.34 },
  { id: 10, name: "Khae Rai Intersection Resurfacing", province: "Nonthaburi", contractor: "North Metro Civil", status: "in-progress", start: "2026-03-03", end: "2027-02-12", lat: 13.8611, lng: 100.5158, roadName: "Ngam Wong Wan Road", radiusKm: 0.35 },
  { id: 11, name: "Pak Kret U-turn Closure", province: "Nonthaburi", contractor: "RiverSafe Engineering", status: "planned", start: "2026-10-15", end: "2028-06-01", lat: 13.9104, lng: 100.4977, roadName: "Tiwanon Road", radiusKm: 0.3 },
  { id: 12, name: "Min Buri Flyover Approach", province: "Bangkok", contractor: "East Gate Infra", status: "in-progress", start: "2025-10-01", end: "2027-07-19", lat: 13.8131, lng: 100.7332, roadName: "Suwinthawong Road", radiusKm: 0.45 },
  { id: 13, name: "Don Mueang Tollway Ramp Works", province: "Bangkok", contractor: "Skyway Systems", status: "completed", start: "2025-01-08", end: "2026-02-20", lat: 13.9147, lng: 100.6031, roadName: "Vibhavadi Rangsit Road", radiusKm: 0.28 },
  { id: 14, name: "Muang Thong Access Road Drainage", province: "Nonthaburi", contractor: "Lakefront Civil", status: "in-progress", start: "2026-01-05", end: "2027-06-25", lat: 13.9125, lng: 100.5485, roadName: "Bond Street Road", radiusKm: 0.34 },
  { id: 15, name: "Ratchayothin Bus Stop Rebuild", province: "Bangkok", contractor: "Transit Habitat", status: "planned", start: "2026-09-18", end: "2027-12-18", lat: 13.8309, lng: 100.5686, roadName: "Phahonyothin Road", radiusKm: 0.28 }
];

const addressBook = [
  { id: "current-demo", name: "ตำแหน่งปัจจุบัน (ตัวอย่าง: เซ็นทรัลลาดพร้าว)", province: "Bangkok", lat: 13.8164, lng: 100.5616, aliases: ["current", "ปัจจุบัน", "เซ็นทรัลลาดพร้าว"] },
  { id: "city-center", name: "Bangkok City Center", province: "Bangkok", lat: 13.7563, lng: 100.5018, aliases: ["bangkok", "กรุงเทพ"] },
  { id: "mo-chit", name: "Mo Chit BTS / Chatuchak", province: "Bangkok", lat: 13.8024, lng: 100.5538, aliases: ["mo chit", "หมอชิต", "chatuchak"] },
  { id: "central-ladprao", name: "Central Ladprao", province: "Bangkok", lat: 13.8164, lng: 100.5616, aliases: ["central ladprao", "ลาดพร้าว"] },
  { id: "impact", name: "IMPACT Muang Thong Thani", province: "Nonthaburi", lat: 13.9126, lng: 100.5487, aliases: ["impact", "เมืองทอง"] },
  { id: "don-mueang", name: "Don Mueang Airport", province: "Bangkok", lat: 13.9125, lng: 100.6068, aliases: ["don mueang", "ดอนเมือง"] },
  { id: "kasetsart", name: "Kasetsart University", province: "Bangkok", lat: 13.8476, lng: 100.5699, aliases: ["kasetsart", "เกษตร"] },
  { id: "min-buri", name: "Min Buri Market", province: "Bangkok", lat: 13.8137, lng: 100.7318, aliases: ["min buri", "มีนบุรี"] },
  { id: "bang-kapi", name: "The Mall Lifestore Bangkapi", province: "Bangkok", lat: 13.7674, lng: 100.6421, aliases: ["bang kapi", "บางกะปิ"] },
  { id: "suvarnabhumi", name: "Suvarnabhumi Airport", province: "Samut Prakan", lat: 13.6900, lng: 100.7501, aliases: ["suvarnabhumi", "สุวรรณภูมิ"] }
];

const travelModes = [
  { id: "car", label: "Car", speedKmh: 42, setup: 4 },
  { id: "motorbike", label: "Motorbike", speedKmh: 36, setup: 3 },
  { id: "transit", label: "Transit", speedKmh: 28, setup: 12 },
  { id: "walk", label: "Walk", speedKmh: 4.6, setup: 0 }
];

const thaiPlaceNames = {
  bangkok: "กรุงเทพฯ",
  "bang kapi": "บางกะปิ",
  bangkapi: "บางกะปิ",
  "chiang mai": "เชียงใหม่",
  phuket: "ภูเก็ต",
  nonthaburi: "นนทบุรี",
  "samut prakan": "สมุทรปราการ",
  "chaeng watthana road": "ถนนแจ้งวัฒนะ",
  "vibhavadi rangsit road": "ถนนวิภาวดีรังสิต",
  "ram inthra road": "ถนนรามอินทรา",
  "phahonyothin road": "ถนนพหลโยธิน",
  "lat phrao road": "ถนนลาดพร้าว",
  "srinagarindra road": "ถนนศรีนครินทร์",
  "ratchadaphisek road": "ถนนรัชดาภิเษก",
  "ngam wong wan road": "ถนนงามวงศ์วาน",
  "tiwanon road": "ถนนติวานนท์",
  "min buri road": "ถนนมีนบุรี",
  "suwinthawong road": "ถนนสุวินทวงศ์",
  "bond street road": "ถนนบอนด์สตรีท",
  "lak si": "หลักสี่",
  "government complex": "ศูนย์ราชการ",
  watcharapol: "วัชรพล",
  kasetsart: "เกษตรศาสตร์",
  "hua mak": "หัวหมาก",
  "lat phrao": "ลาดพร้าว",
  "khae rai": "แคราย",
  "pak kret": "ปากเกร็ด",
  "don mueang": "ดอนเมือง",
  "min buri": "มีนบุรี",
  "muang thong": "เมืองทอง"
};

const addressOverrides = {
  "current-demo": { name: "ตำแหน่งปัจจุบัน (ตัวอย่าง: เซ็นทรัลลาดพร้าว)", aliases: ["current", "current location", "ตำแหน่งปัจจุบัน", "central ladprao", "เซ็นทรัลลาดพร้าว"] },
  "city-center": { name: "กรุงเทพฯ", aliases: ["bangkok", "bangkok city center", "กรุงเทพ", "กรุงเทพฯ"] },
  "mo-chit": { name: "หมอชิต / จตุจักร", aliases: ["mo chit", "chatuchak", "หมอชิต", "จตุจักร"] },
  "central-ladprao": { name: "เซ็นทรัลลาดพร้าว", aliases: ["central ladprao", "ladprao", "lat phrao", "เซ็นทรัลลาดพร้าว", "ลาดพร้าว"] },
  impact: { name: "อิมแพ็ค เมืองทองธานี", aliases: ["impact", "muang thong thani", "เมืองทอง", "อิมแพ็ค"] },
  "don-mueang": { name: "ท่าอากาศยานดอนเมือง", aliases: ["don mueang", "don mueang airport", "ดอนเมือง", "สนามบินดอนเมือง"] },
  kasetsart: { name: "มหาวิทยาลัยเกษตรศาสตร์", aliases: ["kasetsart", "kasetsart university", "เกษตร", "มหาวิทยาลัยเกษตรศาสตร์"] },
  "min-buri": { name: "ตลาดมีนบุรี", aliases: ["min buri", "min buri market", "มีนบุรี", "ตลาดมีนบุรี"] },
  "bang-kapi": { name: "เดอะมอลล์ไลฟ์สโตร์ บางกะปิ", aliases: ["bang kapi", "bangkapi", "the mall bangkapi", "บางกะปิ", "เดอะมอลล์บางกะปิ"] },
  suvarnabhumi: { name: "ท่าอากาศยานสุวรรณภูมิ", aliases: ["suvarnabhumi", "suvarnabhumi airport", "สุวรรณภูมิ", "สนามบินสุวรรณภูมิ"] }
};

const extraAddressPoints = [
  { id: "chiang-mai", name: "เชียงใหม่", province: "Chiang Mai", lat: 18.7883, lng: 98.9853, aliases: ["chiang mai", "เชียงใหม่"] },
  { id: "phuket", name: "ภูเก็ต", province: "Phuket", lat: 7.8804, lng: 98.3923, aliases: ["phuket", "ภูเก็ต"] }
];

const reportTypes = {
  Construction: { label: "Construction", icon: "fa-helmet-safety" },
  "Road Damage": { label: "Road Damage", icon: "fa-road-circle-exclamation" },
  Accident: { label: "Accident", icon: "fa-car-burst" },
  Traffic: { label: "Traffic", icon: "fa-traffic-light" },
  Other: { label: "Other", icon: "fa-flag" }
};

let map = null;
let markerLayer = null;
let routeLayer = null;
let detailLayer = null;
let reportLayer = null;
let pinLayer = null;
let simulationLayer = null;
let activeFilter = "all";
let selectedProjectId = null;
let userMarker = null;
let fallbackZoom = 1;
let activeRoute = null;
let activeRouteEstimate = null;
let placePinMode = false;
let reportPickMode = false;
let placedPinMarker = null;
let placedPinFallback = null;
let placedPinCoords = null;
let reportImageData = "";
let currentUserCoords = null;
let driveState = null;

const markers = new Map();
const reportMarkers = new Map();
const projectList = document.getElementById("projectList");
const searchInput = document.getElementById("searchInput");
const toast = document.getElementById("toast");
const sidebar = document.querySelector(".sidebar");
const mapElement = document.getElementById("map");
const originInput = document.getElementById("originInput");
const destinationInput = document.getElementById("destinationInput");
const addressOptions = document.getElementById("addressOptions");
const routeSummary = document.getElementById("routeSummary");
const travelModesHost = document.getElementById("travelModes");
const avoidanceBox = document.getElementById("avoidanceBox");
const detailModal = document.getElementById("detailModal");
const reportsPanel = document.getElementById("reportsPanel");
const reportList = document.getElementById("reportList");
const driveReadout = document.getElementById("driveReadout");

const workTypes = ["Road resurfacing", "Drainage", "Utility relocation", "Bridge repair", "Signal upgrade"];
const photoPalettes = {
  "black-red-white": ["#111111", "#df4a43", "#ffffff"],
  "green-yellow-white": ["#23a455", "#f1b12c", "#ffffff"],
  "red-yellow-black": ["#df4a43", "#f1b12c", "#111111"],
  "white-green-black": ["#ffffff", "#23a455", "#111111"]
};

const defaultStatusNotes = {
  completed: "เปิดการจราจรตามปกติหลังตรวจรับงาน",
  "in-progress": "ปิดช่องจราจรบางส่วนและมีเครื่องจักรทำงาน",
  delayed: "งานล่าช้าจากการย้ายสาธารณูปโภค",
  planned: "เตรียมพื้นที่และกำหนดจุดเบี่ยงจราจร"
};

function loadLocalState(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.warn(`Could not load ${key}.`, error);
    return fallback;
  }
}

function saveLocalState(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Could not save ${key}.`, error);
    showToast("Browser storage is full, keeping changes for this session only.");
  }
}

const reports = loadLocalState("gpsConstructionReports", []);
const uploadedProjectImages = loadLocalState("gpsConstructionProjectImages", {});

function normalizedKey(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function displayPlaceName(value) {
  if (!value) {
    return value;
  }
  return String(value)
    .split(" - ")
    .map((part) => thaiPlaceNames[normalizedKey(part)] || part)
    .join(" - ");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function displayBilingualText(value) {
  let result = String(value || "");
  Object.entries(thaiPlaceNames)
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([english, thai]) => {
      result = result.replace(new RegExp(escapeRegExp(english), "gi"), thai);
    });
  return result;
}

function expandBilingualSearchText(value) {
  const text = String(value || "");
  const parts = [text, displayPlaceName(text)];
  const lower = normalizedKey(text);
  Object.entries(thaiPlaceNames).forEach(([english, thai]) => {
    if (lower.includes(english) || text.includes(thai)) {
      parts.push(english, thai);
    }
  });
  return parts.join(" ");
}

function hydrateAddressBook() {
  addressBook.forEach((point) => {
    const override = addressOverrides[point.id];
    if (override) {
      point.originalName ||= point.name;
      point.name = override.name;
      point.aliases = Array.from(new Set([...(point.aliases || []), ...override.aliases, point.originalName]));
    }
  });

  extraAddressPoints.forEach((point) => {
    if (!addressBook.some((item) => item.id === point.id)) {
      addressBook.push(point);
    }
  });
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function addDays(dateString, days) {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function hydrateProjectDetails() {
  projects.forEach((project, index) => {
    project.workType ||= workTypes[index % workTypes.length];
    project.timestamp ||= `${addDays(project.start, Math.min(21, index + 2))}T${String(8 + (index % 9)).padStart(2, "0")}:30`;
    project.boundaryMeters ||= Math.round((project.radiusKm || 0.32) * 1000);
    project.photoTheme ||= Object.keys(photoPalettes)[index % Object.keys(photoPalettes).length];
    project.photoColors ||= photoPalettes[project.photoTheme];
    project.statusNote ||= defaultStatusNotes[project.status];
  });
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(dateString));
}

function formatDateTime(dateString) {
  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(dateString));
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function projectBoundary(project) {
  const halfMeters = (project.boundaryMeters || 260) / 2;
  const latOffset = halfMeters / 111320;
  const lngOffset = halfMeters / (111320 * Math.cos(toRadians(project.lat)));
  return [
    [project.lat - latOffset, project.lng - lngOffset],
    [project.lat - latOffset, project.lng + lngOffset],
    [project.lat + latOffset, project.lng + lngOffset],
    [project.lat + latOffset, project.lng - lngOffset]
  ];
}

function drawProjectBoundary(project) {
  if (hasLeaflet) {
    if (!detailLayer) {
      return;
    }
    detailLayer.clearLayers();
    const boundary = projectBoundary(project);
    const polygon = L.polygon(boundary, {
      color: statuses[project.status].color,
      fillColor: statuses[project.status].color,
      fillOpacity: 0.16,
      opacity: 0.94,
      weight: 3
    }).addTo(detailLayer);
    L.circleMarker([project.lat, project.lng], {
      radius: 8,
      color: "#ffffff",
      fillColor: statuses[project.status].color,
      fillOpacity: 1,
      weight: 3
    }).addTo(detailLayer).bindTooltip("GPS Pin");
    map.fitBounds(polygon.getBounds().pad(0.7), { maxZoom: 16 });
    return;
  }

  const fallbackMarkers = document.getElementById("fallbackMarkers");
  if (!fallbackMarkers) {
    return;
  }
  fallbackMarkers.querySelectorAll(".fallback-boundary").forEach((item) => item.remove());
  const position = latLngToPercent(project);
  const boundary = document.createElement("div");
  boundary.className = "fallback-boundary";
  boundary.style.left = `${position.x}%`;
  boundary.style.top = `${position.y}%`;
  boundary.style.borderColor = statuses[project.status].color;
  fallbackMarkers.appendChild(boundary);
}

function clearProjectBoundary() {
  if (hasLeaflet && detailLayer) {
    detailLayer.clearLayers();
  }
  document.querySelectorAll(".fallback-boundary").forEach((item) => item.remove());
}

function renderDetailPhotos(project) {
  const host = document.getElementById("detailPhotos");
  if (!host) {
    return;
  }
  const colors = project.photoColors || photoPalettes[project.photoTheme] || photoPalettes["black-red-white"];
  const uploadedImages = uploadedProjectImages[project.id] || [];
  const swatches = colors
    .map((color) => `<span class="photo-swatch" style="background:${color}" aria-label="Mock area photo color"></span>`)
    .join("");
  const photos = uploadedImages
    .map((src) => `<img class="detail-photo" src="${src}" alt="Uploaded construction image preview">`)
    .join("");
  host.innerHTML = photos + swatches;
}

function openProjectDetail(project) {
  selectedProjectId = project.id;
  renderAll();
  setText("detailName", displayBilingualText(project.name));
  setText("detailType", project.workType || "-");
  setText("detailGps", `${project.lat.toFixed(6)}, ${project.lng.toFixed(6)}`);
  setText("detailBoundary", `${project.boundaryMeters || 260} m around pin`);
  setText("detailTimestamp", formatDateTime(project.timestamp || new Date().toISOString()));
  setText("detailStart", formatDateTime(project.start));
  setText("detailEnd", formatDateTime(project.end));
  setText("detailStatus", statuses[project.status].label);
  setText("detailStatusNote", project.statusNote || defaultStatusNotes[project.status]);
  renderDetailPhotos(project);
  drawProjectBoundary(project);
  detailModal.classList.add("visible");
  detailModal.setAttribute("aria-hidden", "false");
}

function closeProjectDetail() {
  detailModal.classList.remove("visible");
  detailModal.setAttribute("aria-hidden", "true");
  clearProjectBoundary();
}

function populateAddressOptions() {
  addressOptions.innerHTML = addressBook
    .map((point) => `<option value="${point.name}">${displayPlaceName(point.province)}</option>`)
    .join("");
  originInput.value = addressBook.find((point) => point.id === "impact").name;
  destinationInput.value = addressBook.find((point) => point.id === "min-buri").name;
}

function populateConstructionRoads() {
  const roadSelect = document.getElementById("constructionRoad");
  if (!roadSelect) {
    return;
  }
  roadSelect.innerHTML = roadAnchors
    .map((anchor, index) => `<option value="${index}">${displayPlaceName(anchor.name)}</option>`)
    .join("");
  fillConstructionCoordinates();
}

function fillConstructionCoordinates() {
  const roadSelect = document.getElementById("constructionRoad");
  const latInput = document.getElementById("constructionLat");
  const lngInput = document.getElementById("constructionLng");
  if (!roadSelect || !latInput || !lngInput) {
    return;
  }
  const anchor = roadAnchors[Number(roadSelect.value)] || roadAnchors[0];
  latInput.value = anchor.lat.toFixed(6);
  lngInput.value = anchor.lng.toFixed(6);
}

function populateConstructionDates() {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + 45);
  const toLocalInput = (date) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  };
  document.getElementById("constructionStart").value = toLocalInput(now);
  document.getElementById("constructionEnd").value = toLocalInput(end);
  document.getElementById("constructionTimestamp").value = toLocalInput(now);
}

function normalizeText(value) {
  return value.trim().toLowerCase();
}

function findKnownAddress(value) {
  const term = normalizeText(value);
  if (!term) {
    return null;
  }
  return addressBook.find((point) => {
    const names = [point.id, point.name, point.originalName, point.province, displayPlaceName(point.province), ...(point.aliases || [])];
    return names.some((name) => {
      const text = normalizeText(expandBilingualSearchText(name));
      return text === term || text.includes(term);
    });
  }) || null;
}

function parseCoordinate(value) {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) {
    return null;
  }
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { id: `coord-${lat}-${lng}`, name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, province: "Custom", lat, lng };
}

async function geocodeAddress(value) {
  const query = value.trim();
  if (!query) {
    return null;
  }
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=th&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!response.ok) {
    return null;
  }
  const results = await response.json();
  if (!results.length) {
    return null;
  }
  return {
    id: `geocode-${query}`,
    name: results[0].display_name.split(",").slice(0, 2).join(","),
    province: "Thailand",
    lat: Number(results[0].lat),
    lng: Number(results[0].lon)
  };
}

async function resolveAddress(value, fallbackId) {
  const known = findKnownAddress(value);
  if (known) {
    return known;
  }
  const coordinate = parseCoordinate(value);
  if (coordinate) {
    return coordinate;
  }
  try {
    const geocoded = await geocodeAddress(value);
    if (geocoded) {
      return geocoded;
    }
  } catch (error) {
    console.warn("Geocoding failed, using demo fallback.", error);
  }
  return addressBook.find((point) => point.id === fallbackId);
}

function toRadians(value) {
  return value * Math.PI / 180;
}

function haversineKm(a, b) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

function pointToSegmentKm(point, start, end) {
  const avgLat = toRadians((start.lat + end.lat) / 2);
  const toXY = (coord) => ({
    x: (coord.lng - start.lng) * 111.32 * Math.cos(avgLat),
    y: (coord.lat - start.lat) * 110.57
  });
  const p = toXY(point);
  const e = toXY(end);
  const lengthSq = e.x * e.x + e.y * e.y;

  if (!lengthSq) {
    return haversineKm(point, start);
  }

  const t = Math.max(0, Math.min(1, (p.x * e.x + p.y * e.y) / lengthSq));
  const projection = { x: t * e.x, y: t * e.y };
  const dx = p.x - projection.x;
  const dy = p.y - projection.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function pointToRouteKm(point, geometry) {
  let closest = Infinity;
  for (let index = 0; index < geometry.length - 1; index += 1) {
    const start = { lat: geometry[index][0], lng: geometry[index][1] };
    const end = { lat: geometry[index + 1][0], lng: geometry[index + 1][1] };
    closest = Math.min(closest, pointToSegmentKm(point, start, end));
  }
  return closest;
}

function routeBlockers(route) {
  return projects
    .filter((project) => project.status === "in-progress" || project.status === "delayed")
    .map((project) => ({
      ...project,
      routeDistanceKm: pointToRouteKm(project, route.geometry)
    }))
    .filter((project) => project.routeDistanceKm <= (project.radiusKm || 0.3) + 0.18)
    .sort((a, b) => a.routeDistanceKm - b.routeDistanceKm);
}

function scoreRoute(route) {
  const blockers = routeBlockers(route);
  const penalty = blockers.reduce((total, project) => total + (project.status === "delayed" ? 22 : 13), 0);
  return {
    ...route,
    blockers,
    delayMinutes: penalty,
    score: route.durationMinutes + penalty
  };
}

function fallbackRoadRoute(origin, destination) {
  const path = [
    [origin.lat, origin.lng],
    [13.8164, 100.5616],
    [13.8428, 100.5716],
    [13.8793, 100.5798],
    [13.8584, 100.6435],
    [13.8131, 100.7332],
    [destination.lat, destination.lng]
  ];
  const filtered = path.filter((coord, index) => {
    if (index === 0 || index === path.length - 1) {
      return true;
    }
    const waypoint = { lat: coord[0], lng: coord[1] };
    return pointToSegmentKm(waypoint, origin, destination) < 12;
  });
  const distanceKm = filtered.reduce((total, coord, index) => {
    if (index === 0) {
      return total;
    }
    const previous = filtered[index - 1];
    return total + haversineKm({ lat: previous[0], lng: previous[1] }, { lat: coord[0], lng: coord[1] });
  }, 0);
  return [{
    id: "fallback-road",
    geometry: filtered,
    distanceKm: distanceKm * 1.12,
    durationMinutes: distanceKm / 32 * 60,
    source: "local"
  }];
}

async function fetchRoadRoutes(origin, destination) {
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&alternatives=true&steps=false`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Routing service unavailable");
  }
  const data = await response.json();
  if (!data.routes || !data.routes.length) {
    throw new Error("No route found");
  }
  return data.routes.map((route, index) => ({
    id: `osrm-${index}`,
    geometry: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    distanceKm: route.distance / 1000,
    durationMinutes: route.duration / 60,
    source: "osrm"
  }));
}

async function buildRouteEstimate(origin, destination) {
  let routes;
  try {
    routes = await fetchRoadRoutes(origin, destination);
  } catch (error) {
    console.warn("OSRM route failed, using local demo route.", error);
    routes = fallbackRoadRoute(origin, destination);
  }

  const analyzed = routes.map(scoreRoute).sort((a, b) => a.score - b.score);
  const primary = scoreRoute(routes[0]);
  const recommended = analyzed[0];
  const savedMinutes = Math.max(0, Math.round(primary.score - recommended.score));

  return {
    primary,
    recommended,
    alternatives: analyzed,
    blockers: recommended.blockers,
    savedMinutes,
    source: recommended.source
  };
}

function formatMinutes(minutes) {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remaining = Math.round(minutes % 60);
  return remaining ? `${hours} hr ${remaining} min` : `${hours} hr`;
}

function renderRouteResult(origin, destination, estimate) {
  const hasBlockers = estimate.blockers.length > 0;
  const routeSource = estimate.source === "osrm" ? "ตามถนนจริงจาก OpenStreetMap/OSRM" : "เส้นทางสาธิตตามแนวถนนหลัก";
  const delayText = hasBlockers
    ? `พบงานก่อสร้างบนหรือชิดถนนที่ต้องผ่าน ${estimate.blockers.length} จุด`
    : "ไม่พบงานก่อสร้างที่รบกวนเส้นทางหลัก";

  routeSummary.innerHTML = `
    <strong>${origin.name} → ${destination.name}</strong>
    <p>${estimate.recommended.distanceKm.toFixed(1)} km • ${delayText}</p>
    <p class="route-source">${routeSource}</p>
  `;

  travelModesHost.innerHTML = travelModes.map((mode) => {
    const baseMinutes = mode.id === "car"
      ? estimate.recommended.durationMinutes
      : estimate.recommended.distanceKm / mode.speedKmh * 60;
    const minutes = baseMinutes + mode.setup + (hasBlockers ? Math.min(8, estimate.recommended.delayMinutes * 0.3) : 0);
    const saveText = estimate.savedMinutes > 0 ? `save ~${estimate.savedMinutes} min` : "recommended route";
    return `
      <article class="mode-card">
        <span>${mode.label}</span>
        <strong>${formatMinutes(minutes)}</strong>
        <small>${estimate.recommended.distanceKm.toFixed(1)} km • ${saveText}</small>
      </article>
    `;
  }).join("");

  if (hasBlockers) {
    const affected = estimate.blockers
      .slice(0, 4)
      .map((project) => `${project.name} (${project.roadName})`)
      .join(", ");
    avoidanceBox.innerHTML = `
      <strong>คำแนะนำเส้นทาง</strong>
      <p>เส้นทางนี้ผ่านบริเวณงานก่อสร้าง ให้เผื่อเวลาเพิ่ม หรือใช้ทางเลือกที่ระบบเน้นบนแผนที่เมื่อมี route alternative ที่เลี่ยงได้</p>
      <p class="affected-route">พื้นที่กระทบ: ${affected}</p>
    `;
  } else {
    avoidanceBox.innerHTML = `
      <strong>คำแนะนำเส้นทาง</strong>
      <p>ใช้เส้นทางนี้ได้ตามปกติ ระบบยังไม่พบงานก่อสร้างที่อยู่ติดแนวถนนในระยะกระทบ</p>
    `;
  }
}

function visibleProjects() {
  const term = searchInput.value.trim().toLowerCase();
  return projects.filter((project) => {
    // Closed Loop: hide zones that failed compliance (not published to drivers)
    const published = (typeof window.AiAuditor !== 'undefined' && window.AiAuditor.isZonePublished)
      ? window.AiAuditor.isZonePublished(project)
      : true;
    if (!published) return false;
    
    const matchesFilter = activeFilter === "all" || project.status === activeFilter;
    const searchable = [
      project.name,
      project.province,
      project.contractor,
      project.roadName,
      project.workType,
      statuses[project.status].label,
      expandBilingualSearchText(project.name),
      expandBilingualSearchText(project.province),
      expandBilingualSearchText(project.roadName)
    ].join(" ").toLowerCase();
    return matchesFilter && (!term || searchable.includes(term));
  });
}

function popupTemplate(project) {
  const status = statuses[project.status];
  return `
    <article class="project-popup">
      <h3>${displayBilingualText(project.name)}</h3>
      <dl>
        <dt>Status</dt><dd>${status.label}</dd>
        <dt>Type</dt><dd>${project.workType || "-"}</dd>
        <dt>Road</dt><dd>${displayPlaceName(project.roadName)}</dd>
        <dt>Province</dt><dd>${displayPlaceName(project.province)}</dd>
        <dt>Contractor</dt><dd>${project.contractor}</dd>
        <dt>Start</dt><dd>${formatDate(project.start)}</dd>
        <dt>End</dt><dd>${formatDate(project.end)}</dd>
      </dl>
      <a class="detail-button" href="#" data-detail="${project.id}">
        View Detail <i class="fa-solid fa-arrow-right"></i>
      </a>
    </article>
  `;
}

function createMarkerIcon(status) {
  const detail = statuses[status];
  return L.divIcon({
    className: "",
    html: `<div class="marker-pin status-${status}"><i class="fa-solid ${detail.icon}"></i><span>${detail.abbr}</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -28]
  });
}

function createReportIcon(type) {
  const detail = reportTypes[type] || reportTypes.Other;
  return L.divIcon({
    className: "",
    html: `<div class="report-pin"><i class="fa-solid ${detail.icon}"></i></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18]
  });
}

function createPlacedPinIcon() {
  return L.divIcon({
    className: "",
    html: '<div class="placed-pin"><i class="fa-solid fa-thumbtack"></i></div>',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28]
  });
}

function createCarIcon(bearing) {
  return L.divIcon({
    className: "",
    html: `<div class="car-marker" style="transform: rotate(${bearing}deg);"><i class="fa-solid fa-car-side"></i></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
}

function initLeafletMap() {
  map = L.map("map", {
    zoomControl: false,
    minZoom: 5
  }).setView(thailandCenter, 11);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  markerLayer = L.layerGroup().addTo(map);
  reportLayer = L.layerGroup().addTo(map);
  pinLayer = L.layerGroup().addTo(map);
  routeLayer = L.layerGroup().addTo(map);
  detailLayer = L.layerGroup().addTo(map);
  simulationLayer = L.layerGroup().addTo(map);
}

function initFallbackMap() {
  mapElement.classList.add("fallback-map");
  mapElement.innerHTML = `
    <div class="fallback-map-surface" id="fallbackSurface">
      <div class="fallback-water gulf">กรุงเทพฯ ตะวันออก</div>
      <div class="fallback-water andaman">นนทบุรี</div>
      <div class="fallback-land"></div>
      <div class="fallback-road north"></div>
      <div class="fallback-road central"></div>
      <div class="fallback-road south"></div>
      <div class="fallback-river"></div>
      <div class="fallback-label bangkok">ลาดพร้าว</div>
      <div class="fallback-label chiangmai">หลักสี่</div>
      <div class="fallback-label khonkaen">รามอินทรา</div>
      <div class="fallback-label phuket">มีนบุรี</div>
      <svg class="fallback-route-layer" id="fallbackRouteLayer" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>
      <div class="fallback-markers" id="fallbackMarkers"></div>
      <div class="fallback-popup" id="fallbackPopup"></div>
    </div>
  `;
  showToast("Offline mode: ใช้แผนที่สาธิตแทน Leaflet CDN");
}

function latLngToPercent(project) {
  const latMin = 13.68;
  const latMax = 13.94;
  const lngMin = 100.47;
  const lngMax = 100.76;
  const x = ((project.lng - lngMin) / (lngMax - lngMin)) * 100;
  const y = (1 - (project.lat - latMin) / (latMax - latMin)) * 100;
  return {
    x: Math.min(92, Math.max(8, x)),
    y: Math.min(90, Math.max(8, y))
  };
}

function drawLeafletRoute(origin, destination, estimate) {
  if (!routeLayer) {
    return;
  }

  routeLayer.clearLayers();
  const bounds = L.latLngBounds(estimate.recommended.geometry);

  if (estimate.primary.id !== estimate.recommended.id) {
    L.polyline(estimate.primary.geometry, {
      color: "#df4a43",
      weight: 4,
      opacity: 0.45,
      dashArray: "8 8"
    }).addTo(routeLayer);
    bounds.extend(estimate.primary.geometry);
  }

  L.polyline(estimate.recommended.geometry, {
    color: "#15382a",
    weight: 6,
    opacity: 0.88,
    lineJoin: "round"
  }).addTo(routeLayer);

  if (estimate.blockers.length) {
    L.polyline(estimate.recommended.geometry, {
      color: "#1f9a9a",
      weight: 4,
      opacity: 0.9,
      dashArray: "10 8"
    }).addTo(routeLayer);
  }

  L.circleMarker([origin.lat, origin.lng], {
    radius: 6,
    color: "#15382a",
    fillColor: "#ffffff",
    fillOpacity: 1,
    weight: 3
  }).addTo(routeLayer).bindTooltip("Origin");

  L.circleMarker([destination.lat, destination.lng], {
    radius: 6,
    color: "#1f9a9a",
    fillColor: "#ffffff",
    fillOpacity: 1,
    weight: 3
  }).addTo(routeLayer).bindTooltip("Destination");

  map.fitBounds(bounds.pad(0.18), { maxZoom: 13 });
}

function drawFallbackRoute(origin, destination, estimate) {
  const routeSvg = document.getElementById("fallbackRouteLayer");
  if (!routeSvg) {
    return;
  }

  const routePoints = estimate.recommended.geometry.map(([lat, lng]) => latLngToPercent({ lat, lng }));
  const points = routePoints.map((point) => `${point.x},${point.y}`).join(" ");
  routeSvg.innerHTML = `<polyline class="route-line" points="${points}" fill="none" vector-effect="non-scaling-stroke"></polyline>`;
}

function drawRoute(origin, destination, estimate) {
  if (hasLeaflet) {
    drawLeafletRoute(origin, destination, estimate);
  } else {
    drawFallbackRoute(origin, destination, estimate);
  }
}

function buildRouteCumulative(geometry) {
  const cumulative = [0];
  for (let index = 1; index < geometry.length; index += 1) {
    const previous = { lat: geometry[index - 1][0], lng: geometry[index - 1][1] };
    const current = { lat: geometry[index][0], lng: geometry[index][1] };
    cumulative.push(cumulative[index - 1] + haversineKm(previous, current));
  }
  return cumulative;
}

function bearingDegrees(from, to) {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const dLng = toRadians(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function interpolateRoute(geometry, cumulative, distanceKm) {
  if (distanceKm <= 0) {
    const first = geometry[0];
    const next = geometry[1] || first;
    return {
      lat: first[0],
      lng: first[1],
      bearing: bearingDegrees({ lat: first[0], lng: first[1] }, { lat: next[0], lng: next[1] }),
      traveled: [first]
    };
  }

  const total = cumulative[cumulative.length - 1];
  if (distanceKm >= total) {
    const last = geometry[geometry.length - 1];
    const previous = geometry[geometry.length - 2] || last;
    return {
      lat: last[0],
      lng: last[1],
      bearing: bearingDegrees({ lat: previous[0], lng: previous[1] }, { lat: last[0], lng: last[1] }),
      traveled: geometry.slice()
    };
  }

  let segmentIndex = 1;
  while (segmentIndex < cumulative.length && cumulative[segmentIndex] < distanceKm) {
    segmentIndex += 1;
  }
  const start = geometry[segmentIndex - 1];
  const end = geometry[segmentIndex];
  const segmentDistance = cumulative[segmentIndex] - cumulative[segmentIndex - 1] || 1;
  const segmentProgress = (distanceKm - cumulative[segmentIndex - 1]) / segmentDistance;
  const lat = start[0] + (end[0] - start[0]) * segmentProgress;
  const lng = start[1] + (end[1] - start[1]) * segmentProgress;
  return {
    lat,
    lng,
    bearing: bearingDegrees({ lat: start[0], lng: start[1] }, { lat: end[0], lng: end[1] }),
    traveled: [...geometry.slice(0, segmentIndex), [lat, lng]]
  };
}

function updateDriveReadout(remainingKm, etaMinutes, speedFactor, isRunning) {
  if (!driveReadout) {
    return;
  }
  driveReadout.innerHTML = `
    <strong>${isRunning ? `Driving ${speedFactor}x` : "Drive complete"}</strong>
    <span>${Math.max(0, remainingKm).toFixed(1)} km left • ETA ${formatMinutes(Math.max(0, etaMinutes))}</span>
  `;
}

function stopDriveSimulation(message) {
  if (driveState && driveState.frameId) {
    window.cancelAnimationFrame(driveState.frameId);
  }
  driveState = null;
  const button = document.getElementById("driveRoute");
  if (button) {
    button.querySelector("span").textContent = "Drive";
  }
  if (message) {
    showToast(message);
  }
}

function updateLeafletDrive(position) {
  if (!simulationLayer) {
    return;
  }
  if (!driveState.marker) {
    driveState.marker = L.marker([position.lat, position.lng], {
      icon: createCarIcon(position.bearing)
    }).addTo(simulationLayer);
    driveState.progressLine = L.polyline(position.traveled, {
      color: "#1f9a9a",
      weight: 6,
      opacity: 0.9
    }).addTo(simulationLayer);
  } else {
    driveState.marker.setLatLng([position.lat, position.lng]);
    const element = driveState.marker.getElement();
    const car = element && element.querySelector(".car-marker");
    if (car) {
      car.style.transform = `rotate(${position.bearing}deg)`;
    }
    driveState.progressLine.setLatLngs(position.traveled);
  }
  map.panTo([position.lat, position.lng], { animate: false });
}

function updateFallbackDrive(position) {
  const markerHost = document.getElementById("fallbackMarkers");
  const routeSvg = document.getElementById("fallbackRouteLayer");
  if (!markerHost || !routeSvg) {
    return;
  }
  if (!driveState.marker) {
    driveState.marker = document.createElement("div");
    driveState.marker.className = "car-marker fallback-marker";
    driveState.marker.innerHTML = '<i class="fa-solid fa-car-side"></i>';
    markerHost.appendChild(driveState.marker);
  }
  const percent = latLngToPercent(position);
  driveState.marker.style.left = `${percent.x}%`;
  driveState.marker.style.top = `${percent.y}%`;
  driveState.marker.style.transform = `translate(-50%, -50%) rotate(${position.bearing}deg)`;
  const points = position.traveled
    .map(([lat, lng]) => latLngToPercent({ lat, lng }))
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
  let progress = document.getElementById("fallbackDriveProgress");
  if (!progress) {
    progress = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    progress.setAttribute("id", "fallbackDriveProgress");
    progress.setAttribute("class", "route-line-alt");
    progress.setAttribute("fill", "none");
    progress.setAttribute("vector-effect", "non-scaling-stroke");
    routeSvg.appendChild(progress);
  }
  progress.setAttribute("points", points);
}

function stepDriveSimulation(timestamp) {
  if (!driveState) {
    return;
  }
  if (!driveState.startedAt) {
    driveState.startedAt = timestamp;
  }
  const elapsedHours = ((timestamp - driveState.startedAt) / 1000) / 3600;
  const traveledKm = elapsedHours * driveState.simulatedSpeedKmh;
  const totalKm = driveState.totalKm;
  const position = interpolateRoute(driveState.geometry, driveState.cumulative, traveledKm);
  const remainingKm = Math.max(0, totalKm - traveledKm);
  const etaMinutes = remainingKm / driveState.realSpeedKmh * 60;

  if (hasLeaflet) {
    updateLeafletDrive(position);
  } else {
    updateFallbackDrive(position);
  }
  updateDriveReadout(remainingKm, etaMinutes, driveState.speedFactor, remainingKm > 0.01);

  if (remainingKm <= 0.01) {
    stopDriveSimulation("Drive simulation complete");
    return;
  }
  driveState.frameId = window.requestAnimationFrame(stepDriveSimulation);
}

function startDriveSimulation(route) {
  if (!route || !route.estimate) {
    showToast("Calculate a route before driving");
    return;
  }
  stopDriveSimulation();
  if (simulationLayer) {
    simulationLayer.clearLayers();
  }
  const progress = document.getElementById("fallbackDriveProgress");
  if (progress) {
    progress.remove();
  }
  const geometry = route.estimate.recommended.geometry;
  const cumulative = buildRouteCumulative(geometry);
  const speedFactor = Number(document.getElementById("driveSpeed").value) || 1;
  const realSpeedKmh = 45;
  driveState = {
    geometry,
    cumulative,
    totalKm: cumulative[cumulative.length - 1],
    speedFactor,
    realSpeedKmh,
    simulatedSpeedKmh: realSpeedKmh * speedFactor,
    marker: null,
    progressLine: null,
    startedAt: 0,
    frameId: 0
  };
  document.getElementById("driveRoute").querySelector("span").textContent = "Stop";
  driveState.frameId = window.requestAnimationFrame(stepDriveSimulation);
}

async function driveRoute() {
  if (driveState) {
    stopDriveSimulation("Drive simulation stopped");
    return;
  }
  if (!activeRoute || !activeRoute.estimate) {
    await calculateRoute();
  }
  startDriveSimulation(activeRoute);
}

function renderLeafletMarkers() {
  markerLayer.clearLayers();
  markers.clear();

  for (const project of visibleProjects()) {
    const marker = L.marker([project.lat, project.lng], {
      icon: createMarkerIcon(project.status),
      title: project.name
    })
      .bindPopup(popupTemplate(project))
      .on("click", () => selectProject(project.id, false));

    marker.addTo(markerLayer);
    markers.set(project.id, marker);
  }
}

function renderFallbackMarkers() {
  const markerHost = document.getElementById("fallbackMarkers");
  const popup = document.getElementById("fallbackPopup");
  markerHost.innerHTML = "";
  markers.clear();
  reportMarkers.clear();
  placedPinFallback = null;

  if (popup && !selectedProjectId) {
    popup.classList.remove("visible");
  }

  for (const project of visibleProjects()) {
    const position = latLngToPercent(project);
    const button = document.createElement("button");
    button.className = `fallback-marker marker-pin status-${project.status} ${selectedProjectId === project.id ? "active" : ""}`;
    button.type = "button";
    button.title = project.name;
    button.style.left = `${position.x}%`;
    button.style.top = `${position.y}%`;
    button.innerHTML = `<span>${statuses[project.status].abbr}</span>`;
    button.addEventListener("click", () => selectProject(project.id, false));
    markerHost.appendChild(button);
    markers.set(project.id, button);
  }
}

function renderMarkers() {
  if (hasLeaflet) {
    renderLeafletMarkers();
  } else {
    renderFallbackMarkers();
  }
}

function reportPopupTemplate(report) {
  const image = report.image ? `<img src="${report.image}" alt="Report image">` : "";
  return `
    <article class="project-popup report-popup">
      <h3>${report.title}</h3>
      <dl>
        <dt>Type</dt><dd>${report.type}</dd>
        <dt>Location</dt><dd>${report.lat.toFixed(6)}, ${report.lng.toFixed(6)}</dd>
        <dt>Time</dt><dd>${formatDateTime(report.timestamp)}</dd>
        <dt>Reporter</dt><dd>${report.reporter}</dd>
      </dl>
      <p>${report.description || "-"}</p>
      ${image}
    </article>
  `;
}

function renderLeafletReportMarkers() {
  if (!reportLayer) {
    return;
  }
  reportLayer.clearLayers();
  reportMarkers.clear();
  reports.forEach((report) => {
    const marker = L.marker([report.lat, report.lng], {
      icon: createReportIcon(report.type),
      title: report.title
    }).bindPopup(reportPopupTemplate(report));
    marker.addTo(reportLayer);
    reportMarkers.set(report.id, marker);
  });
}

function renderFallbackReportMarkers() {
  const markerHost = document.getElementById("fallbackMarkers");
  if (!markerHost) {
    return;
  }
  reports.forEach((report) => {
    const position = latLngToPercent(report);
    const button = document.createElement("button");
    button.className = "fallback-marker report-marker";
    button.type = "button";
    button.title = report.title;
    button.style.left = `${position.x}%`;
    button.style.top = `${position.y}%`;
    button.innerHTML = '<i class="fa-solid fa-flag"></i>';
    button.addEventListener("click", () => openReportFromList(report.id));
    markerHost.appendChild(button);
    reportMarkers.set(report.id, button);
  });
}

function renderReportMarkers() {
  if (hasLeaflet) {
    renderLeafletReportMarkers();
  } else {
    renderFallbackReportMarkers();
  }
}

function renderFallbackPlacedPin() {
  if (!hasLeaflet && placedPinCoords) {
    setPlacedPin(placedPinCoords.lat, placedPinCoords.lng, false);
  }
}

function renderReportList() {
  if (!reportList) {
    return;
  }
  reportList.innerHTML = "";
  if (!reports.length) {
    reportList.innerHTML = '<div class="empty-state">No reports yet</div>';
    return;
  }
  reports
    .slice()
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .forEach((report) => {
      const button = document.createElement("button");
      button.className = "report-card";
      button.type = "button";
      button.innerHTML = `
        <strong>${report.title}</strong>
        <span>${report.type} • ${report.lat.toFixed(5)}, ${report.lng.toFixed(5)}</span>
        <small>${formatDateTime(report.timestamp)} • ${report.reporter}</small>
      `;
      button.addEventListener("click", () => openReportFromList(report.id));
      reportList.appendChild(button);
    });
}

function renderReports() {
  renderReportMarkers();
  renderReportList();
}

function toLocalInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function populateReportTimestamp() {
  const input = document.getElementById("reportTimestamp");
  if (input) {
    input.value = toLocalInputValue();
  }
}

function setReportCoordinates(lat, lng) {
  document.getElementById("reportLat").value = Number(lat).toFixed(6);
  document.getElementById("reportLng").value = Number(lng).toFixed(6);
}

function openReportsPanel() {
  reportsPanel.classList.add("visible");
  reportsPanel.setAttribute("aria-hidden", "false");
  populateReportTimestamp();
  renderReportList();
}

function closeReportsPanel() {
  reportsPanel.classList.remove("visible");
  reportsPanel.setAttribute("aria-hidden", "true");
  reportPickMode = false;
}

function focusReport(report) {
  if (hasLeaflet) {
    map.flyTo([report.lat, report.lng], 15, { duration: 0.8 });
    const marker = reportMarkers.get(report.id);
    if (marker) {
      marker.openPopup();
    }
    return;
  }
  openFallbackReportPopup(report);
}

function openReportFromList(reportId) {
  const report = reports.find((item) => item.id === reportId);
  if (!report) {
    return;
  }
  focusReport(report);
}

function openFallbackReportPopup(report) {
  const popup = document.getElementById("fallbackPopup");
  if (!popup) {
    return;
  }
  const position = latLngToPercent(report);
  popup.innerHTML = reportPopupTemplate(report);
  popup.style.left = `${Math.min(72, Math.max(8, position.x))}%`;
  popup.style.top = `${Math.min(68, Math.max(12, position.y))}%`;
  popup.classList.add("visible");
}

function copyCoordinates(lat, lng) {
  const value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(value).then(
      () => showToast("Copied coordinates"),
      () => showToast(value)
    );
  } else {
    showToast(value);
  }
}

function pinPopupTemplate(lat, lng) {
  return `
    <article class="project-popup">
      <h3>Placed Pin</h3>
      <dl>
        <dt>Latitude</dt><dd>${lat.toFixed(6)}</dd>
        <dt>Longitude</dt><dd>${lng.toFixed(6)}</dd>
      </dl>
      <button class="detail-button" type="button" data-copy-coords="${lat.toFixed(6)},${lng.toFixed(6)}">
        Copy Coordinates
      </button>
    </article>
  `;
}

function setPlacedPin(lat, lng, openPopup = true) {
  placedPinCoords = { lat, lng };
  if (hasLeaflet) {
    if (!placedPinMarker) {
      placedPinMarker = L.marker([lat, lng], {
        draggable: true,
        icon: createPlacedPinIcon()
      }).addTo(pinLayer);
      placedPinMarker.on("dragend", () => {
        const coords = placedPinMarker.getLatLng();
        setPlacedPin(coords.lat, coords.lng);
      });
    } else {
      placedPinMarker.setLatLng([lat, lng]);
    }
    placedPinMarker.bindPopup(pinPopupTemplate(lat, lng));
    if (openPopup) {
      placedPinMarker.openPopup();
    }
    return;
  }

  const markerHost = document.getElementById("fallbackMarkers");
  if (!markerHost) {
    return;
  }
  if (!placedPinFallback) {
    placedPinFallback = document.createElement("button");
    placedPinFallback.className = "fallback-marker placed-marker marker-pin";
    placedPinFallback.type = "button";
    placedPinFallback.innerHTML = '<span>P</span>';
    placedPinFallback.addEventListener("click", () => {
      openFallbackPinPopup(Number(placedPinFallback.dataset.lat), Number(placedPinFallback.dataset.lng));
    });
    markerHost.appendChild(placedPinFallback);
  }
  const position = latLngToPercent({ lat, lng });
  placedPinFallback.style.left = `${position.x}%`;
  placedPinFallback.style.top = `${position.y}%`;
  placedPinFallback.dataset.lat = String(lat);
  placedPinFallback.dataset.lng = String(lng);
  if (openPopup) {
    openFallbackPinPopup(lat, lng);
  }
}

function openFallbackPinPopup(lat, lng) {
  const popup = document.getElementById("fallbackPopup");
  if (!popup) {
    return;
  }
  const position = latLngToPercent({ lat, lng });
  popup.innerHTML = pinPopupTemplate(lat, lng);
  popup.style.left = `${Math.min(72, Math.max(8, position.x))}%`;
  popup.style.top = `${Math.min(68, Math.max(12, position.y))}%`;
  popup.classList.add("visible");
}

function togglePlacePinMode() {
  placePinMode = !placePinMode;
  reportPickMode = false;
  document.getElementById("placePinButton").classList.toggle("active", placePinMode);
  showToast(placePinMode ? "Place pin mode: click the map or drag the pin." : "Place pin mode off");
  if (placePinMode && hasLeaflet && !placedPinMarker) {
    const center = map.getCenter();
    setPlacedPin(center.lat, center.lng);
  }
}

function mapPointFromFallbackEvent(event) {
  const rect = mapElement.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  const latMin = 13.68;
  const latMax = 13.94;
  const lngMin = 100.47;
  const lngMax = 100.76;
  return {
    lat: latMax - y * (latMax - latMin),
    lng: lngMin + x * (lngMax - lngMin)
  };
}

function handleMapPlacement(lat, lng) {
  if (reportPickMode) {
    setReportCoordinates(lat, lng);
    reportPickMode = false;
    showToast("Report location selected");
    return;
  }
  if (placePinMode) {
    setPlacedPin(lat, lng);
  }
}

async function submitReport(event) {
  event.preventDefault();
  const title = document.getElementById("reportTitle").value.trim();
  const description = document.getElementById("reportDescription").value.trim();
  const type = document.getElementById("reportType").value;
  const reporter = document.getElementById("reporterName").value.trim() || "Demo Reporter";
  const lat = Number(document.getElementById("reportLat").value);
  const lng = Number(document.getElementById("reportLng").value);
  const timestamp = document.getElementById("reportTimestamp").value || toLocalInputValue();

  if (!title) {
    showToast("กรอกหัวข้อรายงานก่อน");
    return;
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    showToast("เลือกตำแหน่งรายงานบนแผนที่หรือกรอกพิกัดก่อน");
    return;
  }

  const report = {
    id: Date.now(),
    type,
    title,
    description,
    image: reportImageData,
    lat,
    lng,
    timestamp,
    reporter
  };

  reports.push(report);
  saveLocalState("gpsConstructionReports", reports);

  // Closed Loop: feed this citizen report as a compliance signal
  // (links to nearest zone + triggers re-audit if ≥3 same-type reports)
  if (typeof window.FeedbackModule !== "undefined" && window.FeedbackModule.ingestReportAsFeedback) {
    window.FeedbackModule.ingestReportAsFeedback(report);
  }

  renderReports();
  focusReport(report);
  document.getElementById("reportForm").reset();
  document.getElementById("reporterName").value = reporter;
  reportImageData = "";
  const preview = document.getElementById("reportImagePreview");
  preview.classList.remove("visible");
  preview.removeAttribute("src");
  populateReportTimestamp();
  showToast(`Report submitted: ${report.title}`);
}

async function handleDetailImageUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file || !selectedProjectId) {
    return;
  }
  try {
    const image = await readImageFile(file);
    uploadedProjectImages[selectedProjectId] ||= [];
    uploadedProjectImages[selectedProjectId].unshift(image);
    saveLocalState("gpsConstructionProjectImages", uploadedProjectImages);
    const project = projects.find((item) => item.id === selectedProjectId);
    if (project) {
      renderDetailPhotos(project);
    }
    event.target.value = "";
    showToast("Image uploaded");
  } catch (error) {
    console.warn("Image upload failed.", error);
    showToast("Could not read that image");
  }
}

async function handleReportImageUpload(event) {
  const file = event.target.files && event.target.files[0];
  const preview = document.getElementById("reportImagePreview");
  if (!file) {
    reportImageData = "";
    preview.classList.remove("visible");
    preview.removeAttribute("src");
    return;
  }
  try {
    reportImageData = await readImageFile(file);
    preview.src = reportImageData;
    preview.classList.add("visible");
  } catch (error) {
    console.warn("Report image upload failed.", error);
    showToast("Could not read that image");
  }
}

function renderList() {
  const items = visibleProjects();
  projectList.innerHTML = "";

  if (!items.length) {
    projectList.innerHTML = '<div class="empty-state">No projects found</div>';
    return;
  }

  for (const project of items) {
    const status = statuses[project.status];
    const button = document.createElement("button");
    button.className = `project-card ${selectedProjectId === project.id ? "active" : ""}`;
    button.type = "button";
    button.dataset.projectId = project.id;
    button.innerHTML = `
      <span class="status-stripe status-${project.status}"></span>
      <span>
        <h2>${displayBilingualText(project.name)}</h2>
        <span class="project-meta">
          <span><i class="fa-solid fa-road"></i> ${displayPlaceName(project.roadName)}</span>
          <span><i class="fa-solid fa-location-dot"></i> ${displayPlaceName(project.province)}</span>
        </span>
      </span>
      <span class="status-label status-${project.status}">${status.label}</span>
    `;
    button.addEventListener("click", () => selectProject(project.id, true));
    projectList.appendChild(button);
  }
}

function renderSummary() {
  document.getElementById("totalProjects").textContent = projects.length;
  document.getElementById("activeProjects").textContent = projects.filter((project) => project.status === "in-progress").length;
  document.getElementById("delayedProjects").textContent = projects.filter((project) => project.status === "delayed").length;
}

function renderAll() {
  renderMarkers();
  renderReportMarkers();
  renderFallbackPlacedPin();
  renderList();
}

function openFallbackPopup(project) {
  const popup = document.getElementById("fallbackPopup");
  if (!popup) {
    return;
  }

  const position = latLngToPercent(project);
  popup.innerHTML = popupTemplate(project);
  popup.style.left = `${Math.min(72, Math.max(8, position.x))}%`;
  popup.style.top = `${Math.min(68, Math.max(12, position.y))}%`;
  popup.classList.add("visible");
}

function selectProject(projectId, zoomToProject) {
  selectedProjectId = projectId;
  const project = projects.find((item) => item.id === projectId);
  renderList();

  if (!project) {
    return;
  }

  if (hasLeaflet) {
    const marker = markers.get(projectId);
    if (marker) {
      if (zoomToProject) {
        map.flyTo([project.lat, project.lng], 14, { duration: 0.8 });
      }
      marker.openPopup();
    }
  } else {
    renderFallbackMarkers();
    openFallbackPopup(project);
    if (zoomToProject) {
      showToast(`Zoom: ${project.roadName}`);
    }
  }

  if (zoomToProject && window.innerWidth <= 1024) {
    sidebar.classList.remove("open");
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("visible"), 2600);
}

function runSearch(event) {
  event.preventDefault();
  selectedProjectId = null;
  renderAll();
  const matches = visibleProjects();

  if (!matches.length) {
    showToast("ไม่พบโครงการที่ค้นหา");
    return;
  }

  if (hasLeaflet) {
    const group = L.featureGroup([...markers.values()]);
    map.fitBounds(group.getBounds().pad(0.22), { maxZoom: matches.length === 1 ? 14 : 12 });
  }

  selectProject(matches[0].id, false);
}

function setFallbackZoom(nextZoom) {
  fallbackZoom = Math.min(3, Math.max(1, nextZoom));
  const surface = document.getElementById("fallbackSurface");
  if (surface) {
    surface.dataset.zoom = fallbackZoom;
  }
}

async function calculateRoute() {
  const origin = await resolveAddress(originInput.value, "central-ladprao");
  const destination = await resolveAddress(destinationInput.value, "min-buri");

  if (!origin || !destination) {
    showToast("ใส่ต้นทางและปลายทางก่อน");
    return;
  }

  if (haversineKm(origin, destination) < 0.05) {
    showToast("ต้นทางและปลายทางต้องเป็นคนละจุด");
    return;
  }

  showToast("กำลังคำนวณเส้นทางตามถนน...");
  const estimate = await buildRouteEstimate(origin, destination);
  activeRoute = { origin, destination, estimate };
  activeRouteEstimate = estimate;
  renderRouteResult(origin, destination, estimate);
  drawRoute(origin, destination, estimate);
  return activeRoute;
}

function addConstructionProject() {
  const roadSelect = document.getElementById("constructionRoad");
  const anchor = roadAnchors[Number(roadSelect.value)] || roadAnchors[0];
  const name = document.getElementById("constructionName").value.trim();
  const workType = document.getElementById("constructionType").value;
  const status = document.getElementById("constructionStatus").value;
  const lat = Number(document.getElementById("constructionLat").value);
  const lng = Number(document.getElementById("constructionLng").value);
  const start = document.getElementById("constructionStart").value;
  const end = document.getElementById("constructionEnd").value;
  const timestamp = document.getElementById("constructionTimestamp").value;
  const boundaryMeters = Number(document.getElementById("constructionBoundary").value);
  const photoTheme = document.getElementById("constructionPhotoTheme").value;
  const statusNote = document.getElementById("constructionStatusNote").value.trim();

  if (!name) {
    showToast("กรอกชื่องานก่อน");
    return;
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    showToast("กรอกพิกัด GPS ให้ถูกต้อง");
    return;
  }

  if (!start || !end || !timestamp) {
    showToast("กรอกเวลาเริ่ม สิ้นสุด และ Timestamp ให้ครบ");
    return;
  }

  if (new Date(start) > new Date(end)) {
    showToast("เวลาเริ่มงานต้องไม่เกินเวลาสิ้นสุดงาน");
    return;
  }

  const nextId = Math.max(...projects.map((project) => project.id)) + 1;
  const project = {
    id: nextId,
    name,
    province: anchor.province,
    contractor: "User submitted",
    status,
    start,
    end,
    lat,
    lng,
    roadName: anchor.name.replace(/ - .+$/, ""),
    radiusKm: Math.max(0.12, boundaryMeters / 1000),
    workType,
    timestamp,
    boundaryMeters,
    photoTheme,
    photoColors: photoPalettes[photoTheme],
    statusNote: statusNote || defaultStatusNotes[status]
  };

  projects.push(project);
  selectedProjectId = project.id;
  activeFilter = "all";
  document.querySelectorAll(".filter-chip").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === "all");
  });
  renderSummary();
  renderAll();
  selectProject(project.id, true);
  openProjectDetail(project);
  showToast(`Added: ${project.name}`);

  if (activeRoute) {
    calculateRoute();
  }
}

function togglePanel(panelSelector, bodyId, button) {
  const panel = document.querySelector(panelSelector);
  panel.classList.toggle("collapsed");
  const isCollapsed = panel.classList.contains("collapsed");
  button.textContent = isCollapsed ? "+" : "-";
  button.setAttribute("aria-expanded", String(!isCollapsed));
  document.getElementById(bodyId).hidden = false;
}

function locateUser() {
  if (!navigator.geolocation) {
    showToast("เบราว์เซอร์นี้ไม่รองรับ Location");
    return;
  }

  showToast("กำลังขอตำแหน่งปัจจุบัน...");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const coords = [position.coords.latitude, position.coords.longitude];
      currentUserCoords = { lat: coords[0], lng: coords[1] };
      originInput.value = `${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}`;
      if (hasLeaflet) {
        if (userMarker) {
          userMarker.setLatLng(coords);
        } else {
          userMarker = L.marker(coords, {
            icon: L.divIcon({
              className: "",
              html: '<div class="marker-pin user-location"><i class="fa-solid fa-user"></i><span>U</span></div>',
              iconSize: [32, 32],
              iconAnchor: [16, 32]
            })
          }).addTo(map).bindPopup("ตำแหน่งของคุณ");
        }
        map.flyTo(coords, 14, { duration: 0.8 });
        userMarker.openPopup();
      } else {
        showToast(`ตำแหน่งของคุณ: ${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`);
      }
    },
    () => showToast("ไม่สามารถเข้าถึงตำแหน่งได้")
  );
}

// Unified panel router (Task 12): exactly one primary panel open at a time.
function showPanelUnified(name) {
  // Update nav active state
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.nav === name);
  });

  // Hide all panels first
  closeReportsPanel();
  const aiPanel = document.getElementById("aiPanel");
  const adminPanel = document.getElementById("adminPanel");
  if (aiPanel) aiPanel.setAttribute("aria-hidden", "true");
  if (adminPanel) adminPanel.setAttribute("aria-hidden", "true");
  if (window.FeedbackModule && window.FeedbackModule.closeFeedbackPanel) {
    window.FeedbackModule.closeFeedbackPanel();
  }

  // Show the requested panel
  if (name === "reports") {
    openReportsPanel();
  } else if (name === "ai") {
    if (aiPanel) aiPanel.setAttribute("aria-hidden", "false");
    if (window.AiAuditor && window.AiAuditor.populateAuditZoneSelector) {
      window.AiAuditor.populateAuditZoneSelector();
    }
  } else if (name === "admin") {
    if (adminPanel) adminPanel.setAttribute("aria-hidden", "false");
    if (window.AdminModule && window.AdminModule.renderAdminQueue) {
      window.AdminModule.renderAdminQueue();
    }
  } else if (name === "alerts") {
    if (window.DriverAlerts && window.DriverAlerts.renderAlertHistory) {
      window.DriverAlerts.renderAlertHistory();
    }
    showToast(`${projects.filter((project) => project.status === "delayed").length} delayed construction alerts`);
  }
  // name === "home" → all panels closed, just the map
}

window.PanelRouter = { show: showPanelUnified };

function bindEvents() {
  document.getElementById("searchForm").addEventListener("submit", runSearch);
  searchInput.addEventListener("input", () => {
    selectedProjectId = null;
    renderAll();
  });
  document.getElementById("locateButton").addEventListener("click", locateUser);
  document.getElementById("zoomIn").addEventListener("click", () => hasLeaflet ? map.zoomIn() : setFallbackZoom(fallbackZoom + 1));
  document.getElementById("zoomOut").addEventListener("click", () => hasLeaflet ? map.zoomOut() : setFallbackZoom(fallbackZoom - 1));
  document.getElementById("recenter").addEventListener("click", () => {
    if (hasLeaflet) {
      map.flyTo(thailandCenter, 11);
    } else {
      selectedProjectId = null;
      setFallbackZoom(1);
      renderAll();
    }
  });
  document.getElementById("openSidebar").addEventListener("click", () => sidebar.classList.add("open"));
  document.getElementById("closeSidebar").addEventListener("click", () => sidebar.classList.remove("open"));
  document.getElementById("calculateRoute").addEventListener("click", calculateRoute);
  document.getElementById("driveRoute").addEventListener("click", driveRoute);
  document.getElementById("placePinButton").addEventListener("click", togglePlacePinMode);
  document.getElementById("createReportFab").addEventListener("click", openReportsPanel);
  document.getElementById("createReportButton").addEventListener("click", openReportsPanel);
  document.getElementById("closeReports").addEventListener("click", closeReportsPanel);
  document.getElementById("reportForm").addEventListener("submit", submitReport);
  document.getElementById("detailImageUpload").addEventListener("change", handleDetailImageUpload);
  document.getElementById("reportImage").addEventListener("change", handleReportImageUpload);
  document.getElementById("selectReportLocation").addEventListener("click", () => {
    reportPickMode = true;
    placePinMode = false;
    document.getElementById("placePinButton").classList.remove("active");
    openReportsPanel();
    showToast("Click the map to set report location");
  });
  document.getElementById("useReportCurrentLocation").addEventListener("click", () => {
    if (currentUserCoords) {
      setReportCoordinates(currentUserCoords.lat, currentUserCoords.lng);
      showToast("Current location added to report");
      return;
    }
    if (!navigator.geolocation) {
      showToast("Browser does not support location");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        currentUserCoords = { lat: position.coords.latitude, lng: position.coords.longitude };
        setReportCoordinates(currentUserCoords.lat, currentUserCoords.lng);
        showToast("Current location added to report");
      },
      () => showToast("Could not access current location")
    );
  });
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => showPanelUnified(button.dataset.nav));
  });
  if (hasLeaflet) {
    map.on("click", (event) => handleMapPlacement(event.latlng.lat, event.latlng.lng));
  } else {
    mapElement.addEventListener("click", (event) => {
      if (event.target.closest(".fallback-marker, .fallback-popup")) {
        return;
      }
      const coords = mapPointFromFallbackEvent(event);
      handleMapPlacement(coords.lat, coords.lng);
    });
  }
  document.getElementById("addConstruction").addEventListener("click", addConstructionProject);
  document.getElementById("constructionRoad").addEventListener("change", fillConstructionCoordinates);
  document.getElementById("closeDetail").addEventListener("click", closeProjectDetail);
  detailModal.addEventListener("click", (event) => {
    if (event.target === detailModal) {
      closeProjectDetail();
    }
  });
  document.getElementById("toggleRoutePanel").addEventListener("click", (event) => togglePanel(".route-panel", "routePanelBody", event.currentTarget));
  document.getElementById("toggleConstructionPanel").addEventListener("click", (event) => togglePanel(".construction-panel", "constructionPanelBody", event.currentTarget));
  [originInput, destinationInput].forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        calculateRoute();
      }
    });
  });

  document.querySelectorAll(".filter-chip").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".filter-chip").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      activeFilter = button.dataset.filter;
      selectedProjectId = null;
      renderAll();
    });
  });

  document.addEventListener("click", (event) => {
    const copyButton = event.target.closest("[data-copy-coords]");
    if (copyButton) {
      event.preventDefault();
      const [lat, lng] = copyButton.dataset.copyCoords.split(",").map(Number);
      copyCoordinates(lat, lng);
      return;
    }
    const detailLink = event.target.closest("[data-detail]");
    if (detailLink) {
      event.preventDefault();
      const project = projects.find((item) => item.id === Number(detailLink.dataset.detail));
      if (project) {
        openProjectDetail(project);
      }
    }
  });
}

function init() {
  hydrateAddressBook();
  hydrateProjectDetails();
  renderSummary();
  populateAddressOptions();
  populateConstructionRoads();
  populateConstructionDates();
  populateReportTimestamp();

  // Restore persisted compliance state (Task 14) before first render
  if (typeof window.AiAuditor !== "undefined" && window.AiAuditor.loadComplianceState) {
    window.AiAuditor.loadComplianceState();
  }

  if (hasLeaflet) {
    initLeafletMap();
  } else {
    initFallbackMap();
  }

  bindEvents();
  renderAll();
  renderReports();
}

init();
