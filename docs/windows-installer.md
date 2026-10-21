# Windows installer

Threadnote uses an NSIS `.exe` installer for Windows x64. It installs for the current user, creates a Start-menu entry and includes an uninstaller. The native app uses its packaged frontend, not a running localhost development server.

No Node.js, npm, Rust or development server is required on the customer's computer. The installer includes the Microsoft WebView2 bootstrapper; if the runtime is absent, its installation requires internet access. This is not a fully offline installer.

## Build and handoff

```sh
npm ci
npm run package:windows
npm run release:prepare
```

The first command sequence runs format/type/regression checks, native tests, builds the optimized release executable and produces the NSIS installer. Product Desktop OAuth configuration is required by the release build guard. Packaging never copies the raw OAuth JSON or local workspace database to the distribution folder.

`release:prepare` copies the generated installer to `releases/<version>/windows-x64/` with a readable filename, installation notes and a SHA-256 checksum. It does not publish/upload anything or modify the local Windows installation.

## Current distribution status

While the app runs, its notification-area icon provides Show/Hide notes, New note, Settings, Launch at Windows startup and Save and quit. Left-click restores notes; right-click opens the menu. Windows may put a new icon in the hidden-icons overflow rather than directly beside the clock. The tray uses native events, not a background polling loop. Save and quit waits for every note's persistence acknowledgment and keeps the process alive on save failure.

- The installer is an unsigned preview. A checksum is not a code-signing certificate. Do not describe it as signed or bypass corporate installation policies.
- Local notes and local tasks work without a Google account. Gmail/Calendar/Google Tasks access still depends on the actual Cloud project configuration, allowed audience and applicable verification.
- Startup is enabled by the current app on first launch and can be disabled in Settings. Closing a note is not the same action as Settings > Quit app.
- Uninstall may retain local workspace data. Disconnect Google before uninstalling when revocation is desired. Do not remove user data automatically during an update or uninstall without an explicit choice.
- The installer has not been installed on a clean machine by the packaging script. Test install, first launch, shortcuts, existing-data upgrade, startup, Quit app, Google connection and uninstall on a separate Windows test account/machine before broad distribution.

For remaining public-release gates, see [release readiness](release-readiness.md).
