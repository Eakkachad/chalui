//! Google Maps API client for navigation
//! Directions, Geocoding, Places APIs

use crate::AppState;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Route request from frontend
#[derive(Debug, Deserialize)]
pub struct RouteRequest {
    pub origin: String,
    pub destination: String,
    pub mode: Option<String>,
}

/// Route response
#[derive(Debug, Serialize)]
pub struct RouteResponse {
    pub routes: Vec<RouteInfo>,
    pub origin_text: String,
    pub destination_text: String,
}

#[derive(Debug, Serialize)]
pub struct RouteInfo {
    pub distance: String,
    pub duration: String,
    pub steps: Vec<StepInfo>,
    pub polyline: String,
}

#[derive(Debug, Serialize)]
pub struct StepInfo {
    pub instruction: String,
    pub distance: String,
    pub duration: String,
}

/// Geocoding response
#[derive(Debug, Serialize)]
pub struct GeocodeResponse {
    pub lat: f64,
    pub lng: f64,
    pub address: String,
}

/// Places search
#[derive(Debug, Serialize)]
pub struct PlaceResult {
    pub name: String,
    pub lat: f64,
    pub lng: f64,
    pub address: String,
    pub rating: Option<f64>,
}

/// Get directions from Google Maps Directions API
pub async fn get_directions(
    state: &Arc<AppState>,
    origin: &str,
    destination: &str,
    mode: &str,
) -> Result<RouteResponse, String> {
    let api_key = &state.api_key; // Reuse same key slot, or use separate env
    let maps_key = std::env::var("GOOGLE_MAPS_KEY").unwrap_or_else(|_| api_key.clone());

    let travel_mode = match mode {
        "walking" => "walking",
        "bicycling" => "bicycling",
        "transit" => "transit",
        _ => "driving",
    };

    let url = format!(
        "https://maps.googleapis.com/maps/api/directions/json?origin={}&destination={}&mode={}&language=th&key={}",
        urlencoding(origin),
        urlencoding(destination),
        travel_mode,
        maps_key,
    );

    let resp = state
        .client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Maps API error: {}", e))?;

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    if body["status"] != "OK" {
        return Err(format!("Directions API: {}", body["status"]));
    }

    let routes: Vec<RouteInfo> = body["routes"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .map(|r| {
            let leg = &r["legs"][0];
            RouteInfo {
                distance: leg["distance"]["text"].as_str().unwrap_or("").to_string(),
                duration: leg["duration"]["text"].as_str().unwrap_or("").to_string(),
                steps: leg["steps"]
                    .as_array()
                    .unwrap_or(&vec![])
                    .iter()
                    .map(|s| StepInfo {
                        instruction: s["html_instructions"].as_str().unwrap_or("").to_string(),
                        distance: s["distance"]["text"].as_str().unwrap_or("").to_string(),
                        duration: s["duration"]["text"].as_str().unwrap_or("").to_string(),
                    })
                    .collect(),
                polyline: r["overview_polyline"]["points"]
                    .as_str()
                    .unwrap_or("")
                    .to_string(),
            }
        })
        .collect();

    let origin_text = body["routes"][0]["legs"][0]["start_address"]
        .as_str()
        .unwrap_or(origin)
        .to_string();
    let destination_text = body["routes"][0]["legs"][0]["end_address"]
        .as_str()
        .unwrap_or(destination)
        .to_string();

    Ok(RouteResponse {
        routes,
        origin_text,
        destination_text,
    })
}

/// Geocode an address to coordinates
pub async fn geocode(state: &Arc<AppState>, address: &str) -> Result<GeocodeResponse, String> {
    let maps_key = std::env::var("GOOGLE_MAPS_KEY").unwrap_or_else(|_| state.api_key.clone());

    let url = format!(
        "https://maps.googleapis.com/maps/api/geocode/json?address={}&language=th&key={}",
        urlencoding(address),
        maps_key,
    );

    let resp = state
        .client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Geocode error: {}", e))?;

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    if body["status"] != "OK" {
        return Err(format!("Geocode: {}", body["status"]));
    }

    let loc = &body["results"][0]["geometry"]["location"];
    Ok(GeocodeResponse {
        lat: loc["lat"].as_f64().unwrap_or(0.0),
        lng: loc["lng"].as_f64().unwrap_or(0.0),
        address: body["results"][0]["formatted_address"]
            .as_str()
            .unwrap_or("")
            .to_string(),
    })
}

/// Search places nearby
pub async fn search_places(
    state: &Arc<AppState>,
    query: &str,
    lat: f64,
    lng: f64,
    radius: u32,
) -> Result<Vec<PlaceResult>, String> {
    let maps_key = std::env::var("GOOGLE_MAPS_KEY").unwrap_or_else(|_| state.api_key.clone());

    let url = format!(
        "https://maps.googleapis.com/maps/api/place/nearbysearch/json?location={},{}&radius={}&keyword={}&language=th&key={}",
        lat, lng, radius, urlencoding(query), maps_key,
    );

    let resp = state
        .client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Places error: {}", e))?;

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    let places: Vec<PlaceResult> = body["results"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .map(|p| PlaceResult {
            name: p["name"].as_str().unwrap_or("").to_string(),
            lat: p["geometry"]["location"]["lat"].as_f64().unwrap_or(0.0),
            lng: p["geometry"]["location"]["lng"].as_f64().unwrap_or(0.0),
            address: p["vicinity"].as_str().unwrap_or("").to_string(),
            rating: p["rating"].as_f64(),
        })
        .collect();

    Ok(places)
}

/// Simple URL encoding (replaces spaces, etc)
fn urlencoding(s: &str) -> String {
    s.replace(' ', "+")
        .replace('&', "%26")
        .replace('?', "%3F")
        .replace(',', "%2C")
        .replace('/', "%2F")
        .replace('(', "%28")
        .replace(')', "%29")
        .replace(':', "%3A")
}
