# Threadnote 0.1.4 preview

Fixes notification-area commands that stopped working after a live website was opened.

## Cause and fix

Adding a native child WebView converts a Tauri WebviewWindow host into a multi-webview Window. Tauri's Rust `get_webview_window` and `webview_windows` deliberately exclude such hosts. The tray therefore could not find the main note for Settings/Save and quit or include it in Show/Hide notes.

Tray lookup, enumeration and the frontend-ready command now use native Window handles. The shutdown adapter and existing-window lookup explicitly use the window API too. The original all-note save handshake remains in place: failed or timed-out persistence still prevents process exit.

## Verification

- Regression guard checks the actual native integration uses multi-webview-compatible window APIs.
- Tray command serialization, failed-save retry, all-window flush success/failure/timeout, canvas and persistence regression tests pass.
- Strict TypeScript, production CSS verification, native tests and Rust clippy pass.
- The user confirmed Hide notes and Save and quit work in the corrected build.
- The installer remains an unsigned Windows x64 preview; Google production verification requirements are unchanged.
