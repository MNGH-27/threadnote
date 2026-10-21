fn main() {
    println!("cargo:rerun-if-env-changed=THREADNOTE_GOOGLE_CLIENT_ID");
    println!("cargo:rerun-if-env-changed=THREADNOTE_GOOGLE_CLIENT_SECRET");
    println!("cargo:rerun-if-changed=google-oauth.json");
    let mut id = std::env::var("THREADNOTE_GOOGLE_CLIENT_ID").unwrap_or_default();
    let mut secret = std::env::var("THREADNOTE_GOOGLE_CLIENT_SECRET").unwrap_or_default();
    let mut project = String::new();
    if let Ok(contents) = std::fs::read_to_string("google-oauth.json") {
        let document: serde_json::Value = serde_json::from_str(&contents)
            .expect("google-oauth.json must be a valid Google Desktop OAuth credential");
        let credentials = document.get("installed").expect("Threadnote requires a Desktop app OAuth client (installed), not a Web application client");
        id = credentials
            .get("client_id")
            .and_then(|value| value.as_str())
            .unwrap_or_default()
            .to_string();
        secret = credentials
            .get("client_secret")
            .and_then(|value| value.as_str())
            .unwrap_or_default()
            .to_string();
        project = credentials
            .get("project_id")
            .and_then(|value| value.as_str())
            .unwrap_or_default()
            .to_string();
    }
    let configured = id.ends_with(".apps.googleusercontent.com")
        && !secret.trim().is_empty()
        && !id.contains(['\r', '\n'])
        && !secret.contains(['\r', '\n']);
    if std::env::var("PROFILE").as_deref() == Ok("release") && !configured {
        panic!("Production builds require the product's Google Desktop OAuth credentials. Add src-tauri/google-oauth.json or set THREADNOTE_GOOGLE_CLIENT_ID and THREADNOTE_GOOGLE_CLIENT_SECRET in CI.");
    }
    if configured {
        println!("cargo:rustc-env=THREADNOTE_GOOGLE_CLIENT_ID={id}");
        println!("cargo:rustc-env=THREADNOTE_GOOGLE_CLIENT_SECRET={secret}");
    }
    if !project.is_empty()
        && project
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-')
    {
        println!("cargo:rustc-env=THREADNOTE_GOOGLE_PROJECT_ID={project}");
    }
    tauri_build::build()
}
