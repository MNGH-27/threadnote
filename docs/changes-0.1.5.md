# Threadnote 0.1.5

## Canvas and window resizing

- Removed the visible bottom-right grip and its dark square from cards and note windows.
- Kept transparent resize targets on all eight edges/corners, including bottom-right.
- Production CSS checks guard against accidentally dropping a resize direction.

## Mind maps

- Replaced the flat branch list with a two-sided tree and curved, edge-attached connections.
- Added nested topics, selected-topic deletion, and child promotion when a parent is removed.
- Added background panning, zoom controls, Ctrl+wheel zoom, and Fit map.
- Kept a readable root-centered view in small cards; Fit map shows the entire tree.
- Added Enter for a sibling and Tab for a child, with automatic focus on new topics.
- Preserved legacy flat branches and repaired invalid parent links without discarding valid topics.
- Preserved mixed English/Persian topic direction and existing section configuration.

## Task details and daily grouping

- Click a task to open its full details inline, in both Google and local lists.
- Edit its title, description and calendar date; save updates Google Tasks or local SQLite as appropriate.
- Group tasks by their exact calendar day, with Today/Tomorrow/Yesterday labels and a separate No date group. Incomplete tasks appear first within each day.
- Delete through an inline confirmation that explains account-side effects, including assigned tasks. Opening/cancelling the confirmation does not delete anything.
- Preserve drafts on request failure; disable overlapping actions while saving.
- Load all Google Tasks pages rather than silently stopping at 100 tasks.
- Keep date-only Google values independent of timezone conversions and omit unsupported notes edits for Google Docs assignments.
- Use the existing Tasks scope and native endpoint restrictions; no new OAuth permissions.

API references: [Task resource and date semantics](https://developers.google.com/workspace/tasks/reference/rest/v1/tasks), [patch](https://developers.google.com/workspace/tasks/reference/rest/v1/tasks/patch), [delete and assigned-task behavior](https://developers.google.com/workspace/tasks/reference/rest/v1/tasks/delete).

### Task verification

- Synthetic browser fixture: `tests/manual/tasks.html`. No real Google tasks or user databases are touched.
- Checked opening full details, saving title/description, moving a task to a different day, a failed save retaining edits, cancelling deletion, confirming deletion, and a 280px-wide layout without horizontal overflow.
- Adapter tests cover PATCH/DELETE payloads, clearing dates, URL encoding, account ownership, Docs assignment restrictions and pagination. Day-grouping tests cover invalid dates and year rollover.
- Live account write/delete acceptance still requires the user to try the installed app with a disposable task.

## General verification

- Formatting, TypeScript, canvas/migration and utility tests, native tests, and production CSS checks pass.
- Browser fixture: `tests/manual/mindmap.html` (run the Vite development server).
- Manually checked compact/wide layouts, adding a main branch and child, and Fit map keeping all topics inside the viewport.
- Tree tests cover legacy data, invalid/cyclic links, non-overlapping layout, child promotion, and a 2,000-topic deep chain.
- Windows installer built locally. Clean-machine installation and native edge-drag acceptance remain manual checks.

This build does not change Google OAuth publication/verification status and is still an unsigned preview.
