export const prerender = false;

// Initial project list
const initialProjects = [
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

if (!global._sharedProjects) {
  global._sharedProjects = [...initialProjects];
}

export async function GET() {
  return new Response(JSON.stringify(global._sharedProjects), {
    headers: { "Content-Type": "application/json" }
  });
}

export async function POST({ request }) {
  try {
    const data = await request.json();
    global._sharedProjects.push(data);
    return new Response(JSON.stringify({ success: true, project: data }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function PUT({ request }) {
  try {
    const data = await request.json();
    const index = global._sharedProjects.findIndex(p => p.id === data.id);
    if (index !== -1) {
      global._sharedProjects[index] = { ...global._sharedProjects[index], ...data };
      return new Response(JSON.stringify({ success: true, project: global._sharedProjects[index] }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ error: "Project not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
}
