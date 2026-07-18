//! Navigation routes — OSM/GISTDA (ฟรี ไม่ต้องใช้บัตรเครดิต)

use axum::{extract::State, Json};
use serde::Deserialize;
use std::sync::Arc;

use crate::api::gistda_maps;
use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct DirectionRequest {
    pub origin_lat: f64,
    pub origin_lng: f64,
    pub dest_lat: f64,
    pub dest_lng: f64,
}

#[derive(Debug, Deserialize)]
pub struct GeocodeRequest {
    pub address: String,
}

#[derive(Debug, Deserialize)]
pub struct PlacesRequest {
    pub place_type: String, // restaurant, cafe, hospital, etc
    pub lat: f64,
    pub lng: f64,
    pub radius: Option<u32>,
}

/// POST /api/navigation/directions — ใช้ OSRM (Open Source Routing Machine)
pub async fn directions_handler(
    State(state): State<Arc<AppState>>,
    Json(req): Json<DirectionRequest>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    let result = gistda_maps::get_directions(
        &state,
        req.origin_lat,
        req.origin_lng,
        req.dest_lat,
        req.dest_lng,
    )
    .await
    .map_err(|e| (axum::http::StatusCode::BAD_GATEWAY, e))?;

    Ok(Json(result))
}

/// POST /api/navigation/geocode — ใช้ Nominatim (OpenStreetMap)
pub async fn geocode_handler(
    State(state): State<Arc<AppState>>,
    Json(req): Json<GeocodeRequest>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    let result = gistda_maps::geocode(&state, &req.address)
        .await
        .map_err(|e| (axum::http::StatusCode::BAD_GATEWAY, e))?;

    Ok(Json(result))
}

/// POST /api/navigation/places — ใช้ Overpass API
pub async fn places_handler(
    State(state): State<Arc<AppState>>,
    Json(req): Json<PlacesRequest>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    let radius = req.radius.unwrap_or(1); // km
    let result = gistda_maps::search_places(&state, &req.place_type, req.lat, req.lng, radius)
        .await
        .map_err(|e| (axum::http::StatusCode::BAD_GATEWAY, e))?;

    Ok(Json(result))
}
