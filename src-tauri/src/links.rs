//! System-browser commands reject non-web protocols and embedded credentials.
use url::Url;

#[tauri::command]
pub(crate) fn open_external(url: String) -> Result<(), String> {
    let parsed = Url::parse(&url).map_err(|_| "Invalid URL".to_string())?;
    let allowed = matches!(
        parsed.host_str(),
        Some("mail.google.com") | Some("calendar.google.com") | Some("tasks.google.com")
    );
    if parsed.scheme() != "https"
        || !allowed
        || parsed.port().is_some()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err("This link is not allowed".into());
    }
    open::that_detached(parsed.as_str()).map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) fn open_website(url: String) -> Result<(), String> {
    let parsed = Url::parse(&url).map_err(|_| "Invalid website URL".to_string())?;
    if !matches!(parsed.scheme(), "http" | "https")
        || parsed.host_str().is_none()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err("Only valid http and https websites can be opened".into());
    }
    open::that_detached(parsed.as_str()).map_err(|error| error.to_string())
}
