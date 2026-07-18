//! ย่านาง AI — HTTPS + HTTP for mobile voice support

mod api;
mod engine;
mod prompts;
mod routes;

use axum::Router;
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;

/// Shared application state
pub struct AppState {
    pub api_key: String,
    pub api_url: String,
    pub model: String,
    pub client: reqwest::Client,
}

#[tokio::main]
async fn main() {
    println!("🧞 ย่านาง AI v0.2 — กำลังเริ่มระบบ...");

    // ── Config ──
    let api_key = std::env::var("YANANG_API_KEY")
        .unwrap_or_else(|_| "YOo9UCZRrU8BhdndNlN1aNkQ1aq3li0j".to_string());
    let api_url = "http://thaillm.or.th/api/v1/chat/completions".to_string();
    let model = "typhoon-s-thaillm-8b-instruct".to_string();
    let http_port: u16 = std::env::var("YANANG_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080);
    let https_port: u16 = std::env::var("YANANG_HTTPS_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8443);
    let local_ip = detect_local_ip();

    let state = Arc::new(AppState {
        api_key,
        api_url,
        model,
        client: reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .expect("สร้าง HTTP client ล้มเหลว"),
    });

    // ── Print info ──
    println!("✅ ย่านาง AI พร้อมใช้งาน!");
    println!("   📍 Local:    http://localhost:{}", http_port);
    if let Some(ref ip) = local_ip {
        println!("   📱 HTTP:     http://{}:{}", ip, http_port);
        println!("   🔒 HTTPS:    https://{}:{}  (Voice)", ip, https_port);
        println!("");
        println!("   💡 เปิด https://{}:{} ใน Chrome มือถือ", ip, https_port);
        println!("      → กด 'ดำเนินการต่อ' (warning) → ไมค์จะทำงาน!");
    }
    println!("   💡 set YANANG_PORT=<p> YANANG_HTTPS_PORT=<p>");

    // ── Build router ──
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/chat", axum::routing::post(routes::chat::chat_handler))
        .route(
            "/api/chat/stream",
            axum::routing::post(routes::chat::chat_stream_handler),
        )
        .route(
            "/api/styles",
            axum::routing::get(routes::chat::styles_handler),
        )
        .route(
            "/api/personality",
            axum::routing::get(routes::chat::personality_handler),
        )
        .route(
            "/api/personality/set",
            axum::routing::post(routes::chat::set_personality_handler),
        )
        // Navigation routes
        .route(
            "/api/navigation/directions",
            axum::routing::post(routes::navigation::directions_handler),
        )
        .route(
            "/api/navigation/geocode",
            axum::routing::post(routes::navigation::geocode_handler),
        )
        .route(
            "/api/navigation/places",
            axum::routing::post(routes::navigation::places_handler),
        )
        .fallback_service(ServeDir::new("static"))
        .layer(cors)
        .with_state(state);

    let app_for_https = app.clone();

    // ── Start HTTP ──
    let http_addr = format!("0.0.0.0:{}", http_port);
    let http_listener = tokio::net::TcpListener::bind(&http_addr)
        .await
        .expect(&format!("❌ ไม่สามารถเปิดพอร์ต {} ได้", http_port));

    let http_handle = tokio::spawn(async move {
        axum::serve(http_listener, app)
            .await
            .expect("HTTP เซิร์ฟเวอร์หยุดทำงาน");
    });

    // ── Start HTTPS ──
    let https_addr: SocketAddr = format!("0.0.0.0:{}", https_port).parse().unwrap();

    match create_self_signed_tls() {
        Ok(tls_config) => {
            let https_handle = tokio::spawn(async move {
                println!("   🔒 HTTPS เริ่มที่ https://0.0.0.0:{}", https_port);
                axum_server::bind_rustls(https_addr, tls_config)
                    .serve(app_for_https.into_make_service())
                    .await
                    .expect("HTTPS เซิร์ฟเวอร์หยุดทำงาน");
            });
            tokio::select! {
                _ = http_handle => {}
                _ = https_handle => {}
            }
        }
        Err(e) => {
            println!("⚠️ ไม่สามารถสร้าง TLS: {}", e);
            println!("   ใช้ HTTP แทน (Voice ไม่ทำงานบน HTTP)");
            http_handle.await.expect("HTTP error");
        }
    }
}

/// Generate self-signed TLS certificate for local development
fn create_self_signed_tls(
) -> Result<axum_server::tls_rustls::RustlsConfig, Box<dyn std::error::Error>> {
    use rcgen::{CertificateParams, DistinguishedName, DnType, KeyPair};
    use rustls::ServerConfig;

    let mut params = CertificateParams::new(vec![
        "192.168.1.171".to_string(),
        "localhost".to_string(),
        "127.0.0.1".to_string(),
        "yanang.local".to_string(),
    ])?;
    params.distinguished_name = DistinguishedName::new();
    params
        .distinguished_name
        .push(DnType::CommonName, "Yanang AI Dev");

    let key_pair = KeyPair::generate()?;
    let cert = params.self_signed(&key_pair)?;

    let cert_der = rustls_pki_types::CertificateDer::from(cert.der().to_vec());
    let key_der = rustls_pki_types::PrivateKeyDer::from(
        rustls_pki_types::PrivatePkcs8KeyDer::from(key_pair.serialize_der().to_vec()),
    );

    let config = ServerConfig::builder()
        .with_no_client_auth()
        .with_single_cert(vec![cert_der], key_der)?;

    println!("   🔒 HTTPS พร้อมใช้งาน");
    println!("   📜 ใช้ self-signed certificate (เฉพาะ dev)");

    Ok(axum_server::tls_rustls::RustlsConfig::from_config(
        Arc::new(config),
    ))
}

/// Detect local IP
fn detect_local_ip() -> Option<String> {
    if let Ok(ip) = std::env::var("YANANG_HOST") {
        if !ip.is_empty() && ip.contains('.') {
            return Some(ip);
        }
    }
    for &ip in &[
        "192.168.1.171",
        "192.168.0.171",
        "192.168.1.100",
        "10.0.0.171",
        "10.0.1.171",
        "172.16.0.171",
    ] {
        if format!("{}:0", ip).parse::<std::net::SocketAddr>().is_ok() {
            return Some(ip.to_string());
        }
    }
    None
}
