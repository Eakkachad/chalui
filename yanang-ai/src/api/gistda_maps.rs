//! OSM/GISTDA Maps API — ฟรี ไม่ต้องใช้บัตรเครดิต

use crate::AppState;
use std::sync::Arc;

/// Get driving directions from OSRM
pub async fn get_directions(
    state: &Arc<AppState>,
    origin_lat: f64,
    origin_lng: f64,
    dest_lat: f64,
    dest_lng: f64,
) -> Result<serde_json::Value, String> {
    let url = format!(
        "https://router.project-osrm.org/route/v1/driving/{},{};{},{}?steps=true&geometries=geojson&overview=full&language=th&continue_straight=true",
        origin_lng, origin_lat, dest_lng, dest_lat,
    );

    let resp = state
        .client
        .get(&url)
        .header("User-Agent", "yanang-ai/1.0 (prototype)")
        .send()
        .await
        .map_err(|e| format!("OSRM error: {}", e))?;

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    if body["code"] != "Ok" {
        return Err(format!("OSRM: {}", body["code"]));
    }

    let route = &body["routes"][0];
    let leg = &route["legs"][0];

    // Extract steps
    let steps: Vec<serde_json::Value> = leg["steps"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .map(|s| {
            serde_json::json!({
                "instruction": s["maneuver"]["type"].as_str().unwrap_or(""),
                "modifier": s["maneuver"]["modifier"].as_str().unwrap_or(""),
                "name": s["name"].as_str().unwrap_or(""),
                "distance": s["distance"].as_f64().unwrap_or(0.0),
                "duration": s["duration"].as_f64().unwrap_or(0.0),
            })
        })
        .collect();

    let result = serde_json::json!({
        "distance_m": route["distance"].as_f64().unwrap_or(0.0),
        "duration_s": route["duration"].as_f64().unwrap_or(0.0),
        "distance_km": format!("{:.1} กม.", route["distance"].as_f64().unwrap_or(0.0) / 1000.0),
        "duration_min": format!("{:.0} นาที", route["duration"].as_f64().unwrap_or(0.0) / 60.0),
        "polyline": route["geometry"],
        "steps": steps,
        "origin": [origin_lat, origin_lng],
        "destination": [dest_lat, dest_lng],
    });

    Ok(result)
}

/// Geocode address → lat/lng via Nominatim
pub async fn geocode(state: &Arc<AppState>, address: &str) -> Result<serde_json::Value, String> {
    let url = format!(
        "https://nominatim.openstreetmap.org/search?q={}&format=json&limit=3&accept-language=th",
        urlencode(address),
    );

    let resp = state
        .client
        .get(&url)
        .header("User-Agent", "yanang-ai/1.0")
        .send()
        .await
        .map_err(|e| format!("Nominatim error: {}", e))?;

    let results: Vec<serde_json::Value> = resp
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    if results.is_empty() {
        return Err(format!("ไม่พบสถานที่ '{}'", address));
    }

    let best = &results[0];
    Ok(serde_json::json!({
        "lat": best["lat"].as_str().unwrap_or("0").parse::<f64>().unwrap_or(0.0),
        "lng": best["lon"].as_str().unwrap_or("0").parse::<f64>().unwrap_or(0.0),
        "display_name": best["display_name"].as_str().unwrap_or(""),
        "all": results.iter().take(3).map(|r| serde_json::json!({
            "lat": r["lat"].as_str().unwrap_or("0").parse::<f64>().unwrap_or(0.0),
            "lng": r["lon"].as_str().unwrap_or("0").parse::<f64>().unwrap_or(0.0),
            "name": r["display_name"].as_str().unwrap_or("").split(',').next().unwrap_or(""),
        })).collect::<Vec<_>>(),
    }))
}

/// Search nearby places via Overpass API
pub async fn search_places(
    state: &Arc<AppState>,
    place_type: &str, // restaurant, cafe, hospital, etc
    lat: f64,
    lng: f64,
    radius: u32,
) -> Result<serde_json::Value, String> {
    let radius_m = (radius * 1000).max(100);

    let query = format!(
        r#"[out:json];(node["amenity"="{}"](around:{},{},{});way["amenity"="{}"](around:{},{},{}););out center 20;"#,
        place_type, radius_m, lat, lng, place_type, radius_m, lat, lng,
    );

    let resp = state
        .client
        .post("https://overpass-api.de/api/interpreter")
        .header("User-Agent", "yanang-ai/1.0")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(format!("data={}", urlencode(&query)))
        .send()
        .await
        .map_err(|e| format!("Overpass error: {}", e))?;

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    let places: Vec<serde_json::Value> = body["elements"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|e| {
            let name = e["tags"]["name"].as_str().or_else(|| e["tags"]["amenity"].as_str())?;
            let (plat, plng) = if e["type"] == "node" {
                (e["lat"].as_f64()?, e["lon"].as_f64()?)
            } else {
                (e["center"]["lat"].as_f64()?, e["center"]["lon"].as_f64()?)
            };
            Some(serde_json::json!({
                "name": name,
                "lat": plat,
                "lng": plng,
                "address": e["tags"]["addr:full"].as_str().or_else(|| e["tags"]["addr:street"].as_str()).unwrap_or(""),
                "type": place_type,
            }))
        })
        .collect();

    Ok(serde_json::json!({
        "places": places,
        "count": places.len(),
    }))
}

fn urlencode(s: &str) -> String {
    s.replace(' ', "+")
        .replace('&', "%26")
        .replace('?', "%3F")
        .replace(',', "%2C")
        .replace('/', "%2F")
        .replace("'", "%27")
}
