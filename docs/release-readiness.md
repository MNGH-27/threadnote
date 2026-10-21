# Release readiness

This is a preparation checklist, not a claim that Threadnote is already verified, signed or ready for unrestricted distribution.

## Reproducible checks

Use Node 24, npm with the committed lockfile, the Rust stable toolchain, rustfmt/clippy, and the Windows Tauri build prerequisites.

```sh
npm ci
npm run check
npm run test:native
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
npm audit --omit=dev --audit-level=moderate
npm run tauri build -- --debug --no-bundle
```

`npm run check` covers formatting, strict TypeScript, regression tests and the frontend production build. Native tests separately cover OAuth callback validation, account/API boundaries and error classification. CI is configured for Windows; adding the workflow locally does not mean a remote CI run has occurred.

## Changes verified by automated tests

- Canvas edge anchors, safe dimensions, minimap coordinates, migration preservation and atomic connection cleanup.
- Debounced writes, ordering of concurrent saves, stale-completion prevention, final flush and retry after storage failure.
- Coordinated shutdown waits for every note, ignores stale acknowledgements, and refuses to quit on a failed save or timeout.
- Safe defaults for invalid section JSON and independent initial mind-map arrays.
- Website protocol/credential validation and production security configuration invariants.
- Unicode/plain-text email decoding and rejection of active HTML email content.
- Native callback CSRF checks, cancellation, deadlines, API allowlists and non-sensitive error codes.

## Manual release gates

- [ ] Select and include an explicit open-source license and the correct copyright owner. No license has been chosen on the owner's behalf.
- The desktop source repository is [MNGH-27/threadnote](https://github.com/MNGH-27/threadnote). The portfolio/policy site remains a separate repository.
- [ ] Review all files to be published. Exclude OAuth JSON, environment files, local databases, images, account data, build output and private logs.
- [ ] Complete Google API enablement, External audience/production configuration and the applicable scope/brand verification. Published policy pages do not perform these steps.
- [ ] Test two different Google accounts, partial consent, cancellation, expired grants and revocation, offline recovery and disconnected views.
- [ ] Test many task lists, HTML-only messages, secondary calendars and account switching while requests are in flight. Current lists are bounded to a single API page; pagination remains a product limitation to resolve or document before a broad release.
- [ ] Test multiple note windows: type then immediately close/quit, reopen, resize, pan/zoom, fullscreen, delete/cancel and native website layering. Include Windows sign-in and different DPI/multi-monitor layouts.
- [ ] Test disk/database errors and confirm Quit app does not exit after a failed flush.
- [ ] Build the release installer, sign it and test on a clean Windows machine without development tools. A debug executable is not a signed release installer.
- [ ] Confirm application icons, publisher/support details, versioning, backup/export behavior and privacy text before distributing.

## Dependency audit finding (October 19, 2026)

The compatible npm audit fix updated available non-breaking packages. The remaining npm audit report contains seven findings in the Tailwind 3 development dependency tree: five high and two moderate, propagated through `braces`, `chokidar`, `micromatch`, `fast-glob`, `postcss-nested` and `postcss-selector-parser`.

These are build-tool dependencies, not shipped JavaScript runtime packages. They are not automatically harmless: only trusted source/style files should enter the build pipeline. npm currently proposes a breaking Tailwind 4 migration. That migration has not been forced into this cleanup because it requires a separate CSS/build migration and visual regression pass. Resolve or explicitly accept/document this release risk; do not describe the full dependency tree as clean.

Rust dependency advisory scanning is not included in clippy or unit tests. Add a RustSec/cargo-audit review before the public release; passing compilation is not a security audit.

## Known durability limits

The coordinated quit protocol handles the application's explicit Quit app action. Forced termination, power loss and operating-system shutdown can interrupt asynchronous writes. The application does not yet provide a general backup/export UI. Do not promise zero data loss.
