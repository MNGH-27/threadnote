//! Least-privilege endpoint allowlist and stable, redacted Google error codes.
use super::permissions;
use serde_json::Value;
use url::Url;

pub(super) fn permitted_api(method: &str, url: &Url, scopes: &[String]) -> bool {
    if url.scheme() != "https"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some()
        || url.fragment().is_some()
    {
        return false;
    }
    let parts: Vec<_> = url.path().trim_matches('/').split('/').collect();
    let permission = permissions(scopes);
    match url.host_str() {
        Some("gmail.googleapis.com") => {
            permission.gmail
                && method == "GET"
                && (parts == ["gmail", "v1", "users", "me", "messages"]
                    || (parts.len() == 6
                        && parts[..5] == ["gmail", "v1", "users", "me", "messages"]))
        }
        Some("tasks.googleapis.com") => {
            permission.tasks
                && ((method == "GET" && parts == ["tasks", "v1", "users", "@me", "lists"])
                    || (parts.len() == 5
                        && parts[..3] == ["tasks", "v1", "lists"]
                        && parts[4] == "tasks"
                        && matches!(method, "GET" | "POST"))
                    || (parts.len() == 6
                        && parts[..3] == ["tasks", "v1", "lists"]
                        && parts[4] == "tasks"
                        && matches!(method, "GET" | "PATCH" | "DELETE")))
        }
        Some("www.googleapis.com") => {
            permission.calendar
                && method == "GET"
                && (parts == ["calendar", "v3", "users", "me", "calendarList"]
                    || (parts.len() == 5
                        && parts[..3] == ["calendar", "v3", "calendars"]
                        && parts[4] == "events"))
        }
        _ => false,
    }
}

pub(super) fn api_error(code: u16, payload: &Value, host: Option<&str>) -> &'static str {
    let error = &payload["error"];
    let reasons: Vec<&str> = error["errors"]
        .as_array()
        .into_iter()
        .flatten()
        .chain(error["details"].as_array().into_iter().flatten())
        .filter_map(|item| item["reason"].as_str())
        .collect();
    let has = |values: &[&str]| reasons.iter().any(|reason| values.contains(reason));
    match code {
        401 => "GOOGLE_RECONNECT_REQUIRED",
        429 => "GOOGLE_RATE_LIMITED",
        404 => "GOOGLE_ITEM_NOT_FOUND",
        403 if has(&["accessNotConfigured", "SERVICE_DISABLED", "API_DISABLED"]) => match host {
            Some("gmail.googleapis.com") => "GOOGLE_GMAIL_API_DISABLED",
            Some("tasks.googleapis.com") => "GOOGLE_TASKS_API_DISABLED",
            Some("www.googleapis.com") => "GOOGLE_CALENDAR_API_DISABLED",
            _ => "GOOGLE_API_DISABLED",
        },
        403 if has(&[
            "rateLimitExceeded",
            "userRateLimitExceeded",
            "dailyLimitExceeded",
            "quotaExceeded",
            "RATE_LIMIT_EXCEEDED",
            "QUOTA_EXCEEDED",
        ]) =>
        {
            "GOOGLE_RATE_LIMITED"
        }
        403 if has(&["insufficientPermissions", "ACCESS_TOKEN_SCOPE_INSUFFICIENT"]) => {
            "GOOGLE_PERMISSION_REQUIRED"
        }
        403 if has(&["domainPolicy", "ORG_RESTRICTION_VIOLATION"]) => "GOOGLE_ORGANIZATION_POLICY",
        403 => "GOOGLE_ACCESS_FORBIDDEN",
        _ => "GOOGLE_API_ERROR",
    }
}
