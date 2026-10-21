# Google access for a distributed Threadnote desktop product

## Product identity versus user identity

The publisher creates one **Desktop app** OAuth client in the product's Google Cloud project. Its client configuration is included in the executable at build time. Every customer then clicks **Sign in with Google**, chooses their own account in their system browser, and grants the requested permissions. Customers never create a Cloud project, copy tokens, enter a client ID, or share their Google password with Threadnote.

This implementation is a public desktop client using PKCE S256, unpredictable state, a random loopback port, a five-minute deadline, and a cancellable login. Desktop client configuration is not a confidential server secret. Do not substitute a Web application client or distribute a service-account key.

The current product uses direct desktop-to-Google API requests; no Threadnote backend receives tokens or mailbox/calendar/task data. A web-hosted OAuth broker is not required for this architecture. Introducing a backend later changes the privacy and Google verification requirements and requires a separate design review.

## Publisher setup (once, not per customer)

1. Use a Google Cloud project owned by the product publisher. Separate development and production projects are recommended.
2. Enable Gmail API, Google Calendar API, and Google Tasks API.
3. In Google Auth Platform, configure Branding using the real product name, support contact, public product home page, privacy policy, and verified publisher domains. Do not invent or use another party's domain.
4. Configure the audience as **External** for a product distributed to arbitrary Google accounts. **Internal** only works within the selected Workspace organization.
5. Create a client whose application type is **Desktop app**. Download its JSON and save it locally as `src-tauri/google-oauth.json`. Only the `installed` format is accepted; a `web` client is rejected.
6. Add the scopes listed below in Data Access. Explain each scope and demonstrate the corresponding visible product feature when submitting verification.
7. While developing, add named test accounts. Test mode is not a general-public launch and refresh tokens can be short-lived under Google's testing rules.
8. Complete the applicable branding/sensitive/restricted-scope verification, then publish the OAuth app for production. Changing the publishing switch alone does not complete verification.
9. Build and sign the Windows release with the product's own client configuration. Release builds deliberately fail when the Google client is missing or invalid.

No product OAuth client is present in this repository by default. Consequently the current credential-free development build cannot complete live Google sign-in. Code-level tests do not establish Google verification or production readiness.

## Requested permissions and visible features

| Scope                                                            | Feature                                                               | Access                                |
| ---------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------- |
| `openid`, `email`                                                | Identify the selected user account                                    | Basic identity                        |
| `https://www.googleapis.com/auth/gmail.readonly`                 | Inbox and reading message text                                        | Read only; no sending/deleting mail   |
| `https://www.googleapis.com/auth/calendar.calendarlist.readonly` | Choose one of the user's calendars                                    | Read only                             |
| `https://www.googleapis.com/auth/calendar.events.readonly`       | Show upcoming calendar events                                         | Read only; no event creation/deletion |
| `https://www.googleapis.com/auth/tasks`                          | Choose task lists, read tasks, create tasks, change completion status | Task management                       |

Gmail read access is a **restricted** scope and requires the applicable OAuth app verification for public distribution. Google documents additional security assessment requirements when restricted-scope data is stored on or transmitted through servers. This implementation keeps Google data on the user's device and does not include a product server; do not assume that applies if analytics, sync servers, crash reports, or hosted processing later receive this data. Confirm the applicable requirements in the publisher's actual Google verification process.

Users may decline individual services. The app stores the scopes Google actually grants and disables only the affected features, with a reconnect path. Installed-app incremental authorization is not assumed: reconnecting requests the product's scope set again.

## Storage, lifecycle, and account isolation

- The refresh token, account subject, email, granted scopes, and client association are one record in Windows Credential Manager for the current Windows user. Refresh/access tokens never go to the web UI, localStorage, SQLite, source control, or product logs.
- Access tokens are cached only in Rust process memory and refreshed before expiry. The network client has a timeout and does not follow redirects carrying authorization headers.
- Google API requests are restricted to the product's supported Gmail/Calendar/Tasks endpoints and methods and bound to the selected account. Results arriving after an account change are rejected.
- Remote inbox messages, events, and task lists are displayed in memory. Switching or disconnecting resets those views. Local notes and explicitly local tasks remain on the device; they are not silently uploaded to another account.
- Disconnect revokes the Google grant before deleting the stored credential. If revocation cannot reach Google, the UI reports the failure so the user can retry. A user can also revoke Threadnote in their Google Account's third-party access settings.
- Sign-in completion, cancellation, disconnect, and expired-token status are broadcast to other open Threadnote windows.

## Build configuration

The JSON file is Git-ignored. CI can instead supply `THREADNOTE_GOOGLE_CLIENT_ID` and `THREADNOTE_GOOGLE_CLIENT_SECRET` as build environment variables. Do not paste real credentials into issue descriptions or documentation. The provided `.env.google.example` is documentation, not an automatically loaded environment file.

```powershell
npm run typecheck
cargo test --manifest-path src-tauri/Cargo.toml --lib
node scripts/test-canvas.mjs
npm run tauri build
```

Before public launch, test sign-in from a fresh Windows account, two different Google accounts, denied/partial consent, browser cancellation, disconnect/revocation, revoked refresh tokens, Gmail plain-text versus HTML-only messages, secondary calendars, large task lists, offline recovery, and signed installation on a machine without development tools. This checklist still requires a real configured OAuth client; it cannot be replaced by mocks.

## Google primary references

- [Desktop OAuth and PKCE](https://developers.google.com/identity/protocols/oauth2/native-app)
- [OAuth production readiness](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview)
- [Gmail scopes and restricted data](https://developers.google.com/workspace/gmail/api/auth/scopes)
- [Restricted-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)

The publisher must provide the actual domain/contact/privacy policy and perform or authorize the Google Cloud verification. No Google Cloud settings, credentials, publication status, or verification have been changed by this implementation.
