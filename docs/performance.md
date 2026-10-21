# Performance and silent startup (0.1.1)

## Changes

- Both debug and release Windows executables use the GUI subsystem. Starting the application directly no longer allocates a console. A terminal explicitly opened by the user to run development tools remains independent.
- Enabled startup entries are refreshed to the current executable on launch, replacing stale debug paths after installation. A previous opt-out stays disabled.
- Native website positioning is invalidation-driven rather than a perpetual animation-frame loop with a 70 ms polling check. Resize, canvas transforms, stacking, overlays, hover/focus, scrolling and document visibility invalidate the layout. Updates are coalesced and serialized; changes during IPC trigger a trailing update.
- Offscreen websites do not create a native browser until first intersecting the viewport. After opening, their browser is kept alive when panned away to preserve forms and navigation. This deliberately does not promise zero offscreen website memory or CPU.
- Automatic Google polling stops while the document is hidden and refreshes on return if overdue or invalidated. Manual refresh remains available. Polling does not depend on focus, so visible desktop widgets still update while another application is focused.
- Concurrent identical Google GET requests within a note window share the in-flight request, keyed by account and URL. Responses are not cached after completion; mutations invalidate pending reads. Gmail metadata requests include only fields used by the UI.
- Section bodies and their runtime context are memoized independently of card frames, avoiding repeated editor/list rendering during canvas panning or card resizing when the content has not changed.

## Measuring

Run `./scripts/measure-performance.ps1` with exactly one Threadnote instance, or pass `-AppProcessId`. It samples the app and descendant processes, excluding unrelated WebView applications. It does not collect command lines, account details or note/email contents.

Compare the same cards, websites, viewport, window visibility and idle period. Website content and WebView runtime versions can dominate memory use. CPU is normalized across logical processors. Private commit is not physical RAM; summed working sets can count shared pages more than once. Processes exiting during sampling are not included in the final CPU total.

An initial 12-second idle sample on the developer's machine (debug binary, nine processes) recorded CPU 0.26%, private commit 375.9 MiB, and summed working sets 555.1 MiB. This is one observation, not a release baseline, performance guarantee or controlled before/after benchmark.

After launching 0.1.1 release and displaying the restored window, a 15.13-second idle sample (eight processes) recorded CPU below the two-decimal reporting precision (0.00%), private commit 378.1 MiB and summed working sets 552.3 MiB. An earlier sample before foreground activation was 376.0 MiB private commit and 539.8 MiB working sets. These samples do **not** demonstrate a meaningful RAM reduction. Debug versus release, foreground state and website activity prevent treating the CPU readings as an isolated percentage improvement from the scheduling changes.

The release PE header was verified as Windows GUI subsystem 2. The app window opened and canvas panning was exercised then restored; no Threadnote console window appeared. The enabled Windows startup entry was verified to point to the release executable instead of the old debug executable. Installing the supplied installer and launching the installed app will reconcile it to that installed path. Website navigation/fullscreen behavior was not comprehensively acceptance-tested in this performance pass.

## Regression coverage

Utility tests verify idle scheduling, event coalescing, serialized/trailing updates, disposal, recovery after errors, concurrent read sharing, no completed-response cache, account isolation, mutation invalidation and startup opt-out preservation. Native website pan/zoom/fullscreen/hover layering and a clean-machine installation still need manual acceptance testing.
