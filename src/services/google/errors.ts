export function googleError(reason: unknown) {
  const code = reason instanceof Error ? reason.message : String(reason);
  const messages: Record<string, string> = {
    GOOGLE_NOT_CONFIGURED: "Google sign-in is not configured in this build.",
    GOOGLE_LOGIN_CANCELLED: "Sign-in cancelled. You can try again whenever you are ready.",
    GOOGLE_LOGIN_TIMEOUT: "Sign-in timed out. Please try again.",
    GOOGLE_LOGIN_IN_PROGRESS:
      "Sign-in is open in your browser. Complete it or cancel to try again.",
    GOOGLE_NETWORK_ERROR: "Could not reach Google. Check your internet connection and try again.",
    GOOGLE_RECONNECT_REQUIRED: "Your connection has expired. Sign in with Google again.",
    GOOGLE_PERMISSION_REQUIRED:
      "This service needs additional permission. Reconnect and approve access.",
    GOOGLE_GMAIL_API_DISABLED:
      "Gmail API is disabled in the app’s Google Cloud project. The app publisher needs to enable it. You do not need to sign in again.",
    GOOGLE_CALENDAR_API_DISABLED:
      "Google Calendar API is disabled in the app’s Google Cloud project. The app publisher needs to enable it. You do not need to sign in again.",
    GOOGLE_TASKS_API_DISABLED:
      "Google Tasks API is disabled in the app’s Google Cloud project. The app publisher needs to enable it. You do not need to sign in again.",
    GOOGLE_API_DISABLED:
      "This API is disabled in the app’s Google Cloud project. Contact the app publisher.",
    GOOGLE_ORGANIZATION_POLICY:
      "Your Google organization blocks this access. Contact your account administrator.",
    GOOGLE_ACCESS_FORBIDDEN:
      "Google blocked this request. This does not necessarily mean you denied permission. Check the API configuration and account restrictions.",
    GOOGLE_RATE_LIMITED: "Google’s request limit has been reached. Please try again later.",
    GOOGLE_SECURE_STORAGE_ERROR: "Could not securely store your account on this Windows device.",
    GOOGLE_ACCOUNT_CHANGED: "The account changed. Please refresh.",
    GOOGLE_ITEM_NOT_FOUND: "This item no longer exists in your Google account.",
    GOOGLE_REVOKE_NETWORK_ERROR:
      "An internet connection is needed to revoke access. Please try again.",
    GOOGLE_REVOKE_ERROR: "Could not revoke access. Please try again.",
    GOOGLE_BROWSER_ERROR: "Could not open sign-in. Check your default browser.",
  };
  return messages[code] ?? "Could not complete the Google request. Please try again.";
}
