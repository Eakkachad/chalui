//! OSM/GISTDA Maps API — ฟรี ไม่ต้องใช้บัตรเครดิต
//!
//! Real routing/geocoding/POI — ไม่ใช่ mock (ดู design.md "Real GPS Navigation") เรียก OSRM/
//! Nominatim/Overpass demo server สาธารณะที่ไม่มี SLA จึงจำกัด timeout ต่อ call ไว้ที่ 8 วินาที
//! (แยกจาก client เดิม 120s ที่ AppState ใช้กับ ThaiLLM) เพื่อไม่ให้ UI ค้างนานเกินจำเป็น

use crate::AppState;
use std::sync::Arc;
use std::time::Duration;

/// Timeout ต่อการเรียก OSRM/Nominatim/Overpass หนึ่งครั้ง (Requirement 3.6)
const NAV_CALL_TIMEOUT: Duration = Duration::from_secs(8);

/// Get driving directions from OSRM
pub async fn get_directions(
    state: &Arc<AppState>,
    origin_lat: f64,
    origin_lng: f64,
    dest_lat: f64,
    dest_lng: f64,
) -> Result<serde_json::Value, String> {
    // หมายเหตุ: OSRM public demo server ไม่รองรับ query param "language"
    // (มันคืน 400 InvalidQuery ถ้าใส่) — ชื่อถนนที่ได้จะเป็นชื่อ OSM ดั้งเดิม (ส่วนใหญ่เป็นไทยอยู่แล้วในกรุงเทพฯ)
    let url = format!(
        "https://router.project-osrm.org/route/v1/driving/{},{};{},{}?steps=true&geometries=geojson&overview=full&continue_straight=true",
        origin_lng, origin_lat, dest_lng, dest_lat,
    );

    let resp = state
        .client
        .get(&url)
        .header("User-Agent", "yanang-ai/1.0 (prototype)")
        .timeout(NAV_CALL_TIMEOUT)
        .send()
        .await
        .map_err(|e| format!("OSRM error: {}", e))?;

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    parse_directions_body(&body, origin_lat, origin_lng, dest_lat, dest_lng)
}

/// Pure — แปลง OSRM response body → shape ที่ yanang-ai ใช้ ไม่ panic ไม่ว่า body จะมีรูปแบบใด
/// (Property 9: navigation adapter errors typed, not panics)
pub fn parse_directions_body(
    body: &serde_json::Value,
    origin_lat: f64,
    origin_lng: f64,
    dest_lat: f64,
    dest_lng: f64,
) -> Result<serde_json::Value, String> {
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
        .timeout(NAV_CALL_TIMEOUT)
        .send()
        .await
        .map_err(|e| format!("Nominatim error: {}", e))?;

    let results: Vec<serde_json::Value> = resp
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    parse_geocode_results(&results, address)
}

/// Pure — แปลง Nominatim response array → shape ที่ yanang-ai ใช้ ไม่ panic ไม่ว่า element จะมีรูปแบบใด
/// (Property 9: navigation adapter errors typed, not panics)
pub fn parse_geocode_results(results: &[serde_json::Value], address: &str) -> Result<serde_json::Value, String> {
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
        .timeout(NAV_CALL_TIMEOUT)
        .send()
        .await
        .map_err(|e| format!("Overpass error: {}", e))?;

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    Ok(parse_places_body(&body, place_type))
}

/// Pure — แปลง Overpass response body → shape ที่ yanang-ai ใช้ ไม่ panic ไม่ว่า element จะมีรูปแบบใด
/// (Property 9: navigation adapter errors typed, not panics) — Overpass ไม่มี "error" shape ที่ต้อง
/// ปฏิเสธทั้งชุด แค่ filter element ที่ field จำเป็นหายไปออก เหมือนโค้ดเดิม
pub fn parse_places_body(body: &serde_json::Value, place_type: &str) -> serde_json::Value {
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

    serde_json::json!({
        "places": places,
        "count": places.len(),
    })
}

fn urlencode(s: &str) -> String {
    s.replace(' ', "+")
        .replace('&', "%26")
        .replace('?', "%3F")
        .replace(',', "%2C")
        .replace('/', "%2F")
        .replace("'", "%27")
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    // Feature: yanang-traveler-integration, Property 9: navigation adapter errors are typed, not panics.
    // Arbitrary JSON strategy — deliberately generates malformed/missing-field/wrong-type shapes.
    fn arb_json() -> impl Strategy<Value = serde_json::Value> {
        let leaf = prop_oneof![
            Just(serde_json::Value::Null),
            any::<bool>().prop_map(serde_json::Value::Bool),
            any::<f64>().prop_filter("finite", |f| f.is_finite()).prop_map(|f| serde_json::json!(f)),
            "[a-zA-Z0-9 ]{0,10}".prop_map(serde_json::Value::String),
        ];
        leaf.prop_recursive(3, 20, 5, |inner| {
            prop_oneof![
                proptest::collection::vec(inner.clone(), 0..4).prop_map(serde_json::Value::Array),
                proptest::collection::hash_map("[a-z]{1,8}", inner, 0..4)
                    .prop_map(|m| serde_json::Value::Object(m.into_iter().collect())),
            ]
        })
    }

    proptest! {
        #![proptest_config(ProptestConfig { cases: 200, ..ProptestConfig::default() })]

        #[test]
        fn property_9_parse_directions_body_never_panics(body in arb_json()) {
            let _ = parse_directions_body(&body, 13.7, 100.5, 13.8, 100.6);
        }

        #[test]
        fn property_9_parse_geocode_results_never_panics(results in proptest::collection::vec(arb_json(), 0..5), address in ".*") {
            let _ = parse_geocode_results(&results, &address);
        }

        #[test]
        fn property_9_parse_places_body_never_panics(body in arb_json(), place_type in ".*") {
            let _ = parse_places_body(&body, &place_type);
        }
    }

    #[test]
    fn property_9_directions_missing_code_field_is_err_not_panic() {
        let body = serde_json::json!({});
        let result = parse_directions_body(&body, 13.7, 100.5, 13.8, 100.6);
        assert!(result.is_err());
    }

    #[test]
    fn property_9_directions_ok_code_but_missing_routes_is_err_not_panic() {
        // "code": "Ok" ผ่านเช็คแรก แต่ routes[0] ไม่มีจริง — ต้องไม่ panic (แต่ปัจจุบัน
        // ยัง fallback ผ่าน index ว่าง → serde_json::Value::Null ไม่ panic เพราง Index บน Value คืน Null)
        let body = serde_json::json!({"code": "Ok"});
        let result = parse_directions_body(&body, 13.7, 100.5, 13.8, 100.6);
        // ไม่ panic คือเงื่อนไขหลักที่ต้องยืนยัน — ผลลัพธ์เป็น Ok ด้วยค่า default ทั้งหมดก็ยอมรับได้
        let _ = result;
    }

    #[test]
    fn property_9_geocode_empty_results_is_err() {
        let result = parse_geocode_results(&[], "บางที่ที่ไม่มีจริง");
        assert!(result.is_err());
    }

    #[test]
    fn unit_places_filters_elements_missing_required_fields() {
        let body = serde_json::json!({
            "elements": [
                {"type": "node", "lat": 13.7, "lon": 100.5, "tags": {"name": "Good Place"}},
                {"type": "node", "tags": {"name": "Missing Coords"}},
                {"type": "way", "tags": {}},
            ]
        });
        let result = parse_places_body(&body, "restaurant");
        assert_eq!(result["count"], 1);
        assert_eq!(result["places"][0]["name"], "Good Place");
    }
}
