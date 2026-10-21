mod callback;
mod policy;
use callback::wait_for_callback;
#[cfg(test)]
use callback::{parse_callback, Callback};
use policy::{api_error, permitted_api};
#[cfg(test)]
use std::{
    io::{Read, Write},
    net::TcpStream,
};

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use keyring::Entry;
use rand::{distributions::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    net::TcpListener,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex, OnceLock,
    },
    time::{Duration, Instant},
};
use tauri::{Emitter, State};
use url::Url;

const SERVICE: &str = "app.threadnote.desktop";
const ACCOUNT_KEY: &str = "google_account_v2";
const GMAIL: &str = "https://www.googleapis.com/auth/gmail.readonly";
const GMAIL_MANAGE: &str = "https://www.googleapis.com/auth/gmail.modify";
const TASKS: &str = "https://www.googleapis.com/auth/tasks";
const CALENDAR: &str = "https://www.googleapis.com/auth/calendar.events.readonly";
const CALENDAR_LIST: &str = "https://www.googleapis.com/auth/calendar.calendarlist.readonly";

#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GooglePermissions {
    gmail: bool,
    calendar: bool,
    tasks: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleStatus {
    configured: bool,
    connected: bool,
    email: Option<String>,
    account_id: Option<String>,
    permissions: GooglePermissions,
    login_pending: bool,
}

#[derive(Clone, Serialize, Deserialize)]
struct Account {
    client_id: String,
    account_id: String,
    email: String,
    refresh_token: String,
    scopes: Vec<String>,
}

struct CachedToken {
    value: String,
    expires: Instant,
    account_id: String,
}

#[derive(Default)]
pub struct GoogleState {
    login_pending: AtomicBool,
    cancel: Arc<AtomicBool>,
    generation: AtomicU64,
    token: Mutex<Option<CachedToken>>,
    refresh_lock: tauri::async_runtime::Mutex<()>,
    session_lock: tauri::async_runtime::Mutex<()>,
}

fn client_id() -> Option<String> {
    option_env!("THREADNOTE_GOOGLE_CLIENT_ID")
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
}
fn client_secret() -> Option<String> {
    option_env!("THREADNOTE_GOOGLE_CLIENT_SECRET")
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
}
fn client() -> Result<reqwest::Client, String> {
    static HTTP: OnceLock<reqwest::Client> = OnceLock::new();
    if let Some(client) = HTTP.get() {
        return Ok(client.clone());
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "GOOGLE_NETWORK_ERROR")?;
    let _ = HTTP.set(client.clone());
    Ok(client)
}
fn entry(name: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, name).map_err(|_| "GOOGLE_SECURE_STORAGE_ERROR".into())
}
fn read_secret(name: &str) -> Result<Option<String>, String> {
    match entry(name)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err("GOOGLE_SECURE_STORAGE_ERROR".into()),
    }
}
fn delete_secret(name: &str) -> Result<(), String> {
    match entry(name)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err("GOOGLE_SECURE_STORAGE_ERROR".into()),
    }
}
fn account() -> Result<Option<Account>, String> {
    let Some(id) = client_id() else {
        return Ok(None);
    };
    if let Some(raw) = read_secret(ACCOUNT_KEY)? {
        let Ok(saved) = serde_json::from_str::<Account>(&raw) else {
            return Ok(None);
        };
        return Ok((saved.client_id == id).then_some(saved));
    }
    // Old development installs may reconnect, but cannot override the product's client.
    Ok(None)
}
fn permissions(scopes: &[String]) -> GooglePermissions {
    let has = |value: &str| scopes.iter().any(|scope| scope == value);
    GooglePermissions {
        gmail: has(GMAIL) || has(GMAIL_MANAGE),
        calendar: has(CALENDAR) && has(CALENDAR_LIST),
        tasks: has(TASKS),
    }
}
fn status(state: &GoogleState) -> Result<GoogleStatus, String> {
    let saved = account()?;
    Ok(GoogleStatus {
        configured: client_id().is_some() && client_secret().is_some(),
        connected: saved.is_some(),
        email: saved.as_ref().map(|value| value.email.clone()),
        account_id: saved.as_ref().map(|value| value.account_id.clone()),
        permissions: saved
            .as_ref()
            .map(|value| permissions(&value.scopes))
            .unwrap_or_default(),
        login_pending: state.login_pending.load(Ordering::SeqCst),
    })
}
fn notify(app: &tauri::AppHandle, state: &GoogleState) {
    if let Ok(value) = status(state) {
        let _ = app.emit("google:auth-changed", value);
    }
}

#[tauri::command]
pub fn google_auth_status(state: State<'_, GoogleState>) -> Result<GoogleStatus, String> {
    status(&state)
}

#[tauri::command]
pub fn google_cancel_connect(state: State<'_, GoogleState>) {
    state.cancel.store(true, Ordering::SeqCst);
}

fn service_setup_url(service: &str) -> Result<Url, String> {
    let api = match service {
        "gmail" => "gmail.googleapis.com",
        "calendar" => "calendar-json.googleapis.com",
        "tasks" => "tasks.googleapis.com",
        _ => return Err("GOOGLE_REQUEST_NOT_ALLOWED".into()),
    };
    let mut url = Url::parse(&format!(
        "https://console.cloud.google.com/apis/library/{api}"
    ))
    .map_err(|_| "GOOGLE_REQUEST_NOT_ALLOWED")?;
    if let Some(project) = option_env!("THREADNOTE_GOOGLE_PROJECT_ID") {
        url.query_pairs_mut().append_pair("project", project);
    }
    Ok(url)
}
#[tauri::command]
pub fn google_open_service_setup(service: String) -> Result<(), String> {
    open::that_detached(service_setup_url(&service)?.as_str())
        .map_err(|_| "GOOGLE_BROWSER_ERROR".into())
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: Option<u64>,
    scope: Option<String>,
}

async fn authorize(app: &tauri::AppHandle, state: &GoogleState) -> Result<GoogleStatus, String> {
    let id = client_id().ok_or("GOOGLE_NOT_CONFIGURED")?;
    let secret = client_secret().ok_or("GOOGLE_NOT_CONFIGURED")?;
    let generation = state.generation.load(Ordering::SeqCst);
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|_| "GOOGLE_CALLBACK_ERROR")?;
    listener
        .set_nonblocking(true)
        .map_err(|_| "GOOGLE_CALLBACK_ERROR")?;
    let redirect = format!(
        "http://127.0.0.1:{}/",
        listener
            .local_addr()
            .map_err(|_| "GOOGLE_CALLBACK_ERROR")?
            .port()
    );
    let random = || {
        rand::thread_rng()
            .sample_iter(&Alphanumeric)
            .take(64)
            .map(char::from)
            .collect::<String>()
    };
    let nonce = random();
    let verifier = random();
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let scopes = format!("openid email {GMAIL} {CALENDAR} {CALENDAR_LIST} {TASKS}");
    let mut url = Url::parse("https://accounts.google.com/o/oauth2/v2/auth").unwrap();
    url.query_pairs_mut()
        .append_pair("client_id", &id)
        .append_pair("redirect_uri", &redirect)
        .append_pair("response_type", "code")
        .append_pair("scope", &scopes)
        .append_pair("access_type", "offline")
        .append_pair("prompt", "select_account consent")
        .append_pair("code_challenge", &challenge)
        .append_pair("code_challenge_method", "S256")
        .append_pair("state", &nonce);
    open::that_detached(url.as_str()).map_err(|_| "GOOGLE_BROWSER_ERROR")?;
    let cancel = state.cancel.clone();
    let code = tauri::async_runtime::spawn_blocking(move || {
        wait_for_callback(listener, nonce, cancel, Duration::from_secs(300))
    })
    .await
    .map_err(|_| "GOOGLE_CALLBACK_ERROR")??;
    let http = client()?;
    let response = http
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("client_id", id.as_str()),
            ("client_secret", secret.as_str()),
            ("code", code.as_str()),
            ("code_verifier", verifier.as_str()),
            ("grant_type", "authorization_code"),
            ("redirect_uri", redirect.as_str()),
        ])
        .send()
        .await
        .map_err(|_| "GOOGLE_NETWORK_ERROR")?;
    if !response.status().is_success() {
        return Err("GOOGLE_TOKEN_ERROR".into());
    }
    let token: TokenResponse = response.json().await.map_err(|_| "GOOGLE_TOKEN_ERROR")?;
    let profile = http
        .get("https://www.googleapis.com/oauth2/v2/userinfo")
        .bearer_auth(&token.access_token)
        .send()
        .await
        .map_err(|_| "GOOGLE_NETWORK_ERROR")?;
    if !profile.status().is_success() {
        return Err("GOOGLE_PROFILE_ERROR".into());
    }
    let profile: Value = profile.json().await.map_err(|_| "GOOGLE_PROFILE_ERROR")?;
    let account_id = profile
        .get("id")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or("GOOGLE_PROFILE_ERROR")?
        .to_string();
    let email = profile
        .get("email")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or("GOOGLE_PROFILE_ERROR")?
        .to_string();
    let refresh_token = token.refresh_token.ok_or("GOOGLE_OFFLINE_ACCESS_ERROR")?;
    let saved = Account {
        client_id: id,
        account_id: account_id.clone(),
        email,
        refresh_token,
        scopes: token
            .scope
            .unwrap_or_default()
            .split_whitespace()
            .map(str::to_string)
            .collect(),
    };
    let _session = state.session_lock.lock().await;
    if state.cancel.load(Ordering::SeqCst) || generation != state.generation.load(Ordering::SeqCst)
    {
        return Err("GOOGLE_LOGIN_CANCELLED".into());
    }
    entry(ACCOUNT_KEY)?
        .set_password(&serde_json::to_string(&saved).map_err(|_| "GOOGLE_SECURE_STORAGE_ERROR")?)
        .map_err(|_| "GOOGLE_SECURE_STORAGE_ERROR")?;
    state.generation.fetch_add(1, Ordering::SeqCst);
    *state.token.lock().map_err(|_| "GOOGLE_SESSION_ERROR")? = Some(CachedToken {
        value: token.access_token,
        account_id,
        expires: Instant::now()
            + Duration::from_secs(token.expires_in.unwrap_or(3600).saturating_sub(60)),
    });
    // Remove obsolete development credentials; the product identity is build-time only.
    for name in [
        "google_refresh_token",
        "google_client_id",
        "google_client_secret",
        "google_account_email",
    ] {
        let _ = delete_secret(name);
    }
    notify(app, state);
    status(state)
}

#[tauri::command]
pub async fn google_connect(
    app: tauri::AppHandle,
    state: State<'_, GoogleState>,
) -> Result<GoogleStatus, String> {
    if state
        .login_pending
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err("GOOGLE_LOGIN_IN_PROGRESS".into());
    }
    state.cancel.store(false, Ordering::SeqCst);
    notify(&app, &state);
    let result = authorize(&app, &state).await;
    state.login_pending.store(false, Ordering::SeqCst);
    notify(&app, &state);
    result.map(|mut value| {
        value.login_pending = false;
        value
    })
}

#[tauri::command]
pub async fn google_disconnect(
    app: tauri::AppHandle,
    state: State<'_, GoogleState>,
) -> Result<GoogleStatus, String> {
    state.cancel.store(true, Ordering::SeqCst);
    let _session = state.session_lock.lock().await;
    let saved = account()?;
    // Revoke first: if offline, retain the credential so the user can retry revocation.
    if let Some(saved) = &saved {
        let response = client()?
            .post("https://oauth2.googleapis.com/revoke")
            .form(&[("token", saved.refresh_token.as_str())])
            .send()
            .await
            .map_err(|_| "GOOGLE_REVOKE_NETWORK_ERROR")?;
        if !response.status().is_success() && response.status().as_u16() != 400 {
            return Err("GOOGLE_REVOKE_ERROR".into());
        }
    }
    delete_secret(ACCOUNT_KEY)?;
    state.generation.fetch_add(1, Ordering::SeqCst);
    *state.token.lock().map_err(|_| "GOOGLE_SESSION_ERROR")? = None;
    for name in [
        "google_refresh_token",
        "google_client_id",
        "google_client_secret",
        "google_account_email",
    ] {
        let _ = delete_secret(name);
    }
    notify(&app, &state);
    status(&state)
}

async fn access_token(
    app: &tauri::AppHandle,
    state: &GoogleState,
    expected_account: &str,
    force: bool,
) -> Result<String, String> {
    let _refresh = state.refresh_lock.lock().await;
    let saved = account()?.ok_or("GOOGLE_RECONNECT_REQUIRED")?;
    if saved.account_id != expected_account {
        return Err("GOOGLE_ACCOUNT_CHANGED".into());
    }
    if !force {
        let cached = state.token.lock().map_err(|_| "GOOGLE_SESSION_ERROR")?;
        if let Some(token) = cached
            .as_ref()
            .filter(|value| value.account_id == expected_account && value.expires > Instant::now())
        {
            return Ok(token.value.clone());
        }
    }
    let generation = state.generation.load(Ordering::SeqCst);
    let response = client()?
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("client_id", saved.client_id.as_str()),
            (
                "client_secret",
                client_secret().ok_or("GOOGLE_NOT_CONFIGURED")?.as_str(),
            ),
            ("refresh_token", saved.refresh_token.as_str()),
            ("grant_type", "refresh_token"),
        ])
        .send()
        .await
        .map_err(|_| "GOOGLE_NETWORK_ERROR")?;
    if !response.status().is_success() {
        let error: Value = response.json().await.unwrap_or_default();
        if error.get("error").and_then(Value::as_str) == Some("invalid_grant") {
            let _session = state.session_lock.lock().await;
            if generation == state.generation.load(Ordering::SeqCst) {
                delete_secret(ACCOUNT_KEY)?;
                state.generation.fetch_add(1, Ordering::SeqCst);
                *state.token.lock().map_err(|_| "GOOGLE_SESSION_ERROR")? = None;
                notify(app, state);
            }
            return Err("GOOGLE_RECONNECT_REQUIRED".into());
        }
        return Err("GOOGLE_TOKEN_ERROR".into());
    }
    let token: TokenResponse = response.json().await.map_err(|_| "GOOGLE_TOKEN_ERROR")?;
    let _session = state.session_lock.lock().await;
    if generation != state.generation.load(Ordering::SeqCst) {
        return Err("GOOGLE_ACCOUNT_CHANGED".into());
    }
    *state.token.lock().map_err(|_| "GOOGLE_SESSION_ERROR")? = Some(CachedToken {
        value: token.access_token.clone(),
        account_id: expected_account.to_string(),
        expires: Instant::now()
            + Duration::from_secs(token.expires_in.unwrap_or(3600).saturating_sub(60)),
    });
    Ok(token.access_token)
}

#[tauri::command]
pub async fn google_api_request(
    app: tauri::AppHandle,
    state: State<'_, GoogleState>,
    method: String,
    url: String,
    body: Option<Value>,
    account_id: String,
) -> Result<Value, String> {
    let url = Url::parse(&url).map_err(|_| "GOOGLE_REQUEST_NOT_ALLOWED")?;
    let saved = account()?.ok_or("GOOGLE_RECONNECT_REQUIRED")?;
    if saved.account_id != account_id {
        return Err("GOOGLE_ACCOUNT_CHANGED".into());
    }
    if !permitted_api(&method, &url, &saved.scopes) {
        return Err("GOOGLE_PERMISSION_REQUIRED".into());
    }
    let http = client()?;
    let request_method =
        reqwest::Method::from_bytes(method.as_bytes()).map_err(|_| "GOOGLE_REQUEST_NOT_ALLOWED")?;
    let generation = state.generation.load(Ordering::SeqCst);
    for retry in 0..2 {
        let token = access_token(&app, &state, &account_id, retry > 0).await?;
        let mut request = http
            .request(request_method.clone(), url.clone())
            .bearer_auth(token);
        if let Some(payload) = &body {
            request = request.json(payload);
        }
        let response = request.send().await.map_err(|_| "GOOGLE_NETWORK_ERROR")?;
        let code = response.status().as_u16();
        if code == 401 && retry == 0 {
            continue;
        }
        if generation != state.generation.load(Ordering::SeqCst) {
            return Err("GOOGLE_ACCOUNT_CHANGED".into());
        }
        if !response.status().is_success() {
            // Classify trusted structured reasons, never expose raw responses or tokens.
            let payload: Value = response.json().await.unwrap_or_default();
            return Err(api_error(code, &payload, url.host_str()).into());
        }
        let text = response.text().await.map_err(|_| "GOOGLE_NETWORK_ERROR")?;
        if generation != state.generation.load(Ordering::SeqCst) {
            return Err("GOOGLE_ACCOUNT_CHANGED".into());
        }
        return if text.is_empty() {
            Ok(json!({}))
        } else {
            serde_json::from_str(&text).map_err(|_| "GOOGLE_API_ERROR".into())
        };
    }
    Err("GOOGLE_RECONNECT_REQUIRED".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn service_setup_links_are_fixed_and_project_bound() {
        let url = service_setup_url("tasks").unwrap();
        assert_eq!(url.host_str(), Some("console.cloud.google.com"));
        assert_eq!(url.path(), "/apis/library/tasks.googleapis.com");
        if let Some(project) = option_env!("THREADNOTE_GOOGLE_PROJECT_ID") {
            assert!(url
                .query_pairs()
                .any(|(key, value)| key == "project" && value == project));
        }
        assert_eq!(
            service_setup_url("calendar").unwrap().path(),
            "/apis/library/calendar-json.googleapis.com"
        );
        assert!(service_setup_url("https://other.test").is_err());
    }
    #[test]
    fn gmail_remains_read_only_even_for_legacy_manage_grants() {
        let url =
            Url::parse("https://gmail.googleapis.com/gmail/v1/users/me/messages/a/modify").unwrap();
        assert!(!permitted_api("POST", &url, &[GMAIL.into()]));
        assert!(!permitted_api("POST", &url, &[GMAIL_MANAGE.into()]));
        assert!(!permitted_api(
            "DELETE",
            &Url::parse("https://gmail.googleapis.com/gmail/v1/users/me/messages/a").unwrap(),
            &[GMAIL_MANAGE.into()]
        ));
        assert!(permitted_api(
            "GET",
            &Url::parse("https://gmail.googleapis.com/gmail/v1/users/me/messages").unwrap(),
            &[GMAIL_MANAGE.into()]
        ));
    }
    #[test]
    fn api_errors_distinguish_configuration_from_consent() {
        let disabled = json!({"error": {"details": [{"reason": "SERVICE_DISABLED"}]}});
        assert_eq!(
            api_error(403, &disabled, Some("gmail.googleapis.com")),
            "GOOGLE_GMAIL_API_DISABLED"
        );
        assert_eq!(
            api_error(403, &disabled, Some("tasks.googleapis.com")),
            "GOOGLE_TASKS_API_DISABLED"
        );
        assert_eq!(
            api_error(403, &disabled, Some("www.googleapis.com")),
            "GOOGLE_CALENDAR_API_DISABLED"
        );
        let legacy = json!({"error": {"errors": [{"reason": "accessNotConfigured"}]}});
        assert_eq!(
            api_error(403, &legacy, Some("gmail.googleapis.com")),
            "GOOGLE_GMAIL_API_DISABLED"
        );
        for reason in ["insufficientPermissions", "ACCESS_TOKEN_SCOPE_INSUFFICIENT"] {
            assert_eq!(
                api_error(
                    403,
                    &json!({"error": {"errors": [{"reason": reason}]}}),
                    None
                ),
                "GOOGLE_PERMISSION_REQUIRED"
            );
        }
        assert_eq!(
            api_error(
                403,
                &json!({"error": {"errors": [{"reason": "userRateLimitExceeded"}]}}),
                None
            ),
            "GOOGLE_RATE_LIMITED"
        );
        assert_eq!(
            api_error(
                403,
                &json!({"error": {"errors": [{"reason": "domainPolicy"}]}}),
                None
            ),
            "GOOGLE_ORGANIZATION_POLICY"
        );
        assert_eq!(
            api_error(403, &Value::Null, None),
            "GOOGLE_ACCESS_FORBIDDEN"
        );
        assert_eq!(
            api_error(401, &Value::Null, None),
            "GOOGLE_RECONNECT_REQUIRED"
        );
        assert_eq!(api_error(429, &Value::Null, None), "GOOGLE_RATE_LIMITED");
        assert_eq!(api_error(500, &Value::Null, None), "GOOGLE_API_ERROR");
    }
    #[test]
    fn embedded_client_matches_publisher_configuration_when_present() {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("google-oauth.json");
        if !path.exists() {
            return;
        }
        let contents =
            std::fs::read_to_string(path).expect("Product OAuth configuration must be readable");
        let document: Value = serde_json::from_str(&contents)
            .expect("Product OAuth configuration must be valid JSON");
        let installed = document
            .get("installed")
            .expect("Product must use a Desktop OAuth client");
        // Boolean assertions avoid including credential values in failure output.
        assert!(
            client_id().as_deref() == installed.get("client_id").and_then(Value::as_str),
            "Embedded product client ID was not loaded"
        );
        assert!(
            client_secret().as_deref() == installed.get("client_secret").and_then(Value::as_str),
            "Embedded desktop client configuration was not loaded"
        );
    }
    #[test]
    fn callback_rejects_unrelated_requests_and_csrf() {
        assert_eq!(parse_callback("/favicon.ico", "state"), Callback::Ignore);
        assert_eq!(
            parse_callback("/?state=wrong&code=secret", "state"),
            Callback::Ignore
        );
        assert_eq!(
            parse_callback("/?state=state&state=state&code=a", "state"),
            Callback::Ignore
        );
        assert_eq!(
            parse_callback("/?state=state&code=a&code=b", "state"),
            Callback::Ignore
        );
        assert_eq!(
            parse_callback("/?state=state&code=ok", "state"),
            Callback::Code("ok".into())
        );
        assert_eq!(
            parse_callback("/?state=state&error=access_denied", "state"),
            Callback::Denied
        );
    }
    #[test]
    fn requests_are_scoped_to_needed_resources_and_permissions() {
        let scopes = vec![
            GMAIL.into(),
            TASKS.into(),
            CALENDAR.into(),
            CALENDAR_LIST.into(),
        ];
        let allowed = |method, url| permitted_api(method, &Url::parse(url).unwrap(), &scopes);
        assert!(allowed(
            "GET",
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/a"
        ));
        assert!(!allowed(
            "POST",
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
        ));
        assert!(!allowed(
            "GET",
            "https://gmail.googleapis.com/gmail/v1/users/other/messages"
        ));
        assert!(allowed(
            "GET",
            "https://www.googleapis.com/calendar/v3/calendars/primary/events"
        ));
        assert!(!allowed(
            "POST",
            "https://www.googleapis.com/calendar/v3/calendars/primary/events"
        ));
        assert!(allowed(
            "PATCH",
            "https://tasks.googleapis.com/tasks/v1/lists/list/tasks/task"
        ));
        assert!(!allowed("GET", "https://www.googleapis.com/drive/v3/files"));
        assert!(!allowed(
            "GET",
            "https://attacker.test/gmail/v1/users/me/messages"
        ));
        assert!(!permitted_api(
            "GET",
            &Url::parse("https://gmail.googleapis.com/gmail/v1/users/me/messages").unwrap(),
            &[]
        ));
    }
    #[test]
    fn callback_listener_times_out_and_cancels() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        assert_eq!(
            wait_for_callback(
                listener,
                "state".into(),
                Arc::new(AtomicBool::new(true)),
                Duration::from_secs(1)
            )
            .unwrap_err(),
            "GOOGLE_LOGIN_CANCELLED"
        );
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        assert_eq!(
            wait_for_callback(
                listener,
                "state".into(),
                Arc::new(AtomicBool::new(false)),
                Duration::ZERO
            )
            .unwrap_err(),
            "GOOGLE_LOGIN_TIMEOUT"
        );
    }
    #[test]
    fn unrelated_request_cannot_terminate_real_login() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        let address = listener.local_addr().unwrap();
        let worker = std::thread::spawn(move || {
            wait_for_callback(
                listener,
                "expected".into(),
                Arc::new(AtomicBool::new(false)),
                Duration::from_secs(3),
            )
        });
        let request = |target: &str| {
            let mut stream = TcpStream::connect(address).unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(2)))
                .unwrap();
            write!(
                stream,
                "GET {target} HTTP/1.1\r\nHost: {address}\r\nConnection: close\r\n\r\n"
            )
            .unwrap();
            let mut response = String::new();
            stream.read_to_string(&mut response).unwrap();
            response
        };
        assert!(request("/favicon.ico").starts_with("HTTP/1.1 400"));
        assert!(request("/?state=attacker&code=wrong").starts_with("HTTP/1.1 400"));
        let response = request("/?state=expected&code=valid-code");
        assert!(response.starts_with("HTTP/1.1 200"));
        assert!(!response.contains("valid-code"));
        assert_eq!(worker.join().unwrap().unwrap(), "valid-code");
    }
}
