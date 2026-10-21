# Threadnote

Threadnote is a local-first Windows note widget. Every window is the same flexible note and can contain optional content sections.

## Download for Windows

[Download Threadnote 0.1.3 for Windows x64](https://github.com/MNGH-27/threadnote/releases/download/v0.1.3/Threadnote-0.1.3-Windows-x64-Setup.exe). This is an **unsigned preview**, not a Google-verified unrestricted public release. Local notes work without Google sign-in. See [release notes and checksums](https://github.com/MNGH-27/threadnote/releases/tag/v0.1.3).

While running, Threadnote has an icon in the Windows notification area (possibly under the hidden-icons arrow). Left-click shows notes; right-click offers Show/Hide notes, New note, Settings, Launch at Windows startup, and Save and quit. Closing a note does not quit the app.

## Current behavior

- The main window is a note; there is no separate launcher or widget-type screen.
- The header add button creates another independent note window.
- Every note remembers its own size, position, color, and always-on-top state.
- Notes are stored locally in SQLite and save automatically.
- A note can contain Email, Calendar, Tasks, Mind map, Image, and Live website sections.
- Canvas cards can be moved, resized, expanded to the workspace, and connected with persistent directional links.
- Resize note windows and canvas cards from all four edges and corners; canvas resizing respects zoom and minimum dimensions.
- Additional text-note cards can be added and linked to notes, task panels, and other section cards.
- Local tasks work offline. A separate Google Tasks view shows the signed-in user's lists and tasks and supports creating/completing tasks.
- Gmail messages can be read inside the widget or opened in Gmail. HTML-only emails have a safe preview and external-view fallback.
- Google Calendar shows the signed-in user's calendars and upcoming events with read-only access.
- Images are stored locally inside the note (up to 5 MB per image).
- Live websites only accept `http` and `https` URLs and use isolated native child WebViews, so sites that block iframe embedding can still load.
- OAuth tokens are stored in Windows Credential Manager.

## Google OAuth setup

1. Create a Google Cloud OAuth credential with application type **Desktop app**.
2. Enable Gmail API, Google Tasks API, and Google Calendar API.
3. Configure the OAuth consent screen and add the intended account as a test user while the app is in testing.
4. Save the downloaded credential as `src-tauri/google-oauth.json`.
5. Rebuild the application.

The credential file is ignored by Git and is embedded at build time. End users only see **Sign in with Google**; each user selects their own account in the system browser through OAuth 2.0 with PKCE. Account switching, cancellation, refresh, partial consent, and revocation are handled by the app. Release builds require valid product credentials.

Public distribution requires the publisher's External audience and applicable Google verification, especially for Gmail's restricted read scope. Code implementation alone does not enable production Google access. See [the product setup and release requirements](docs/google-product-setup.md).

## Installable Windows build

Use `npm run package:windows` to build the Release NSIS installer, then `npm run release:prepare` to create the handoff folder and checksum. End users only run the installer; they do not need developer tools. See [installer requirements and distribution notes](docs/windows-installer.md).

## Development

See [architecture and module boundaries](docs/architecture.md) and the [release readiness checklist](docs/release-readiness.md). This is a Windows-first application; the current build and tests do not claim Google verification or a signed public release.

```sh
npm install
npm run check
npm run typecheck
npm run tauri dev
```

Use `npm run format` to apply the shared formatting rules. `npm run test:native` runs the Rust security/regression tests. The Windows CI workflow repeats the frontend checks, native tests and clippy. Node 24 is required for the SQLite migration test runner.

Build the local Windows executable with:

```sh
npm run tauri build -- --debug --no-bundle
```
