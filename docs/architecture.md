# Threadnote architecture

Threadnote is a Windows-first, local-first Tauri application. Public product pages are maintained separately in the portfolio repository. This refactor changes the desktop application, not its public site or Google Cloud settings.

## Responsibility boundaries

| Layer                 | Location                                                                              | Responsibility                                                               |
| --------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Composition           | `src/features/widget/desktop-widget.tsx`                                              | Assemble the current note and its optional sections                          |
| Window controls       | `widget-frame.tsx`, `use-window-bounds.ts`, `widget-manager.ts`                       | Independent note windows, pinning, geometry, restoration                     |
| Workspace persistence | `use-note-workspace.ts`, `src/lib/autosave.ts`                                        | Debounce, serialize, retry and flush local edits                             |
| Canvas                | `canvas-workspace.tsx`, `canvas-card.tsx`, `canvas-geometry.ts`, `canvas-minimap.tsx` | Pan/zoom, card gestures, fullscreen, directional connections                 |
| Local content         | `src/features/widget/sections/`                                                       | Text, images, mind maps, local tasks and website controls                    |
| Connected views       | `src/features/widget/google/`                                                         | Gmail, Calendar and Tasks views; shared gates and refresh behavior           |
| Service adapters      | `src/services/`                                                                       | Typed IPC requests, account status, safe email parsing, coordinated shutdown |
| Repositories          | `src/repositories/`                                                                   | Parameterized SQL for notes, sections, tasks and connections                 |
| Native authentication | `src-tauri/src/google.rs`                                                             | Credentials, PKCE, token renewal, account isolation                          |
| Native OAuth callback | `src-tauri/src/google/callback.rs`                                                    | Bounded, cancellable loopback listener and state validation                  |
| Native API policy     | `src-tauri/src/google/policy.rs`                                                      | Endpoint/method allowlist and redacted error classification                  |

`widget-repository.ts` and `google-panels.tsx` are small compatibility facades, not places to add new implementation.

## Persistence rules

The native tray (`src-tauri/src/tray.rs`) can show/hide notes, open settings, create notes, toggle startup and request a safe quit. Only the main note accepts tray commands, enabled after its handler registers. Quit delegates to the same all-window flush handshake used by Settings. The main native window hides on Alt+F4 instead of destroying the coordinator. Startup changes are synchronized between the native check item and Settings through an event; no polling loop is added.

- Local note edits use a debounced, ordered writer. A previous completion cannot mark a newer edit as saved. Failed latest writes remain available for retry.
- Each section has its own ordered writer. Saving content and committing a resize use the same path. Layout and initial content are inserted together when a section is created.
- Window close controls flush pending edits before hiding/destroying the window. Explicit Quit app asks every note window to acknowledge a flush; failure or timeout keeps the process open.
- Cross-window refreshes wait for pending local writes and ignore snapshots superseded by local edits.
- SQLite migrations are append-only history. Do not rewrite old migrations to remove obsolete tables or columns: existing installations must remain upgradeable.
- Section deletion relies on the SQLite trigger for atomic edge cleanup. UI state is removed only after the database operation succeeds.
- Note text and chosen images remain in local storage. The database is not an encrypted vault. Never silently export or upload local content.

## Security rules

- Google credentials and tokens stay in Rust/Windows Credential Manager, not React, SQLite or localStorage.
- The native policy restricts requests even if a frontend caller constructs an unexpected URL. Gmail and Calendar remain read-only.
- Email HTML is never rendered as active document content; only decoded plain text or an external Gmail fallback is shown.
- Live websites run in separate native WebViews. Do not add remote origins to the main window's IPC capability.
- Production CSP blocks arbitrary script origins, frames and plugin objects. Development has a separate policy for the local Vite connection.
- Logs and user-facing errors must not include credentials, raw Google responses or note/email contents.
- An error boundary offers recovery without deleting data or logging private content.

## Extending a section

Card geometry is shared by all section types. `card-resize.ts` handles eight-direction resizing in canvas coordinates, keeps opposite edges anchored and enforces 280 × 180 minimum dimensions. `CanvasCard` converts screen deltas by the current zoom; edge hit areas remain screen-sized. Collapsed and fullscreen cards do not expose resize handles. Native website slots reserve gutters so embedded content cannot cover the HTML resize edges. The outer native window uses the eight platform resize directions separately.

1. Add its type and data shape in `src/types/widget.ts`.
2. Add isolated initial config in `src/lib/section-config.ts` and display metadata in `section-catalog.ts`.
3. Implement its renderer under `sections/`, with changes passed to the workspace hook rather than direct SQL calls.
4. Wire the renderer into desktop composition and add a migration if the persisted schema changes.
5. Add persistence/validation tests and run the release checks before shipping.
