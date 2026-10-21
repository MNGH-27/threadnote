import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

async function loadTypescript(path) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}
const { createAutosave } = await loadTypescript("../src/lib/autosave.ts");
const { normalizeWebsite } = await loadTypescript("../src/lib/website.ts");
const { readSectionConfig, createSectionConfig } = await loadTypescript(
  "../src/lib/section-config.ts",
);

const { flushBeforeShutdown } = await loadTypescript("../src/lib/workspace-shutdown.ts");
const { plainMail } = await loadTypescript("../src/services/google/mail-parser.ts");
const { createInvalidationScheduler } = await loadTypescript(
  "../src/lib/invalidation-scheduler.ts",
);
const { createSingleFlight } = await loadTypescript("../src/lib/single-flight.ts");
const { reconcileAutostart } = await loadTypescript("../src/lib/autostart.ts");
const { createTrayActionHandler } = await loadTypescript("../src/lib/tray-actions.ts");
const { normalizeMindNodes, layoutMindmap, removeMindNode } =
  await loadTypescript("../src/lib/mindmap.ts");
const { taskDay, taskDayLabel, groupTasksByDay } = await loadTypescript("../src/lib/task-days.ts");
const { createTasksApi } = await loadTypescript("../src/services/google/tasks-api.ts");

test("task day grouping preserves Google date-only days and never mutates source order", () => {
  assert.equal(taskDay("2026-10-21T00:00:00.000Z"), "2026-10-21");
  assert.equal(taskDay("2026-02-30"), "");
  assert.equal(taskDay("invalid"), "");
  const tasks = [
    { id: "done", dueDate: "2026-10-21T00:00:00Z", completed: true },
    { id: "none", dueDate: null, completed: false },
    { id: "open", dueDate: "2026-10-21", completed: false },
    { id: "older", dueDate: "2026-10-20", completed: false },
  ];
  const groups = groupTasksByDay(tasks);
  assert.deepEqual(
    groups.map((g) => g.day),
    ["2026-10-20", "2026-10-21", ""],
  );
  assert.deepEqual(
    groups[1].tasks.map((t) => t.id),
    ["open", "done"],
  );
  assert.equal(tasks[0].id, "done");
});

test("task day labels handle month/year rollover using local calendar days", () => {
  const now = new Date(2026, 11, 31, 23, 59);
  assert.match(taskDayLabel("2026-12-31", now), /^Today/);
  assert.match(taskDayLabel("2027-01-01", now), /^Tomorrow/);
  assert.match(taskDayLabel("2026-12-30", now), /^Yesterday/);
  assert.equal(taskDayLabel("", now), "No date");
});

test("Google task edits patch only editable fields, clear date explicitly and escape IDs", async () => {
  const calls = [];
  const api = createTasksApi(
    async (...args) => {
      calls.push(args);
      return {};
    },
    () => "owner",
  );
  await api.updateTask(
    "list/1",
    { id: "task?#", status: "completed" },
    { title: "Updated", description: "Full details", dueDate: "" },
  );
  assert.equal(calls[0][0], "PATCH");
  assert.match(calls[0][1], /list%2F1\/tasks\/task%3F%23$/);
  assert.deepEqual(calls[0][2], { title: "Updated", notes: "Full details", due: null });
  assert.equal(calls[0][3], "owner");
  await api.updateTask(
    "list",
    { id: "task", assignmentInfo: { surfaceType: "DOCUMENT" } },
    { title: "Doc", description: "Restricted", dueDate: "2026-10-21" },
  );
  assert.deepEqual(calls[1][2], { title: "Doc", due: "2026-10-21T00:00:00.000Z" });
});

test("Google task deletion uses DELETE with no body and explicit account ownership", async () => {
  const calls = [];
  const api = createTasksApi(
    async (...args) => {
      calls.push(args);
      return {};
    },
    () => "other-owner",
  );
  await api.deleteTask("list", "task/id", "selected-owner");
  assert.equal(calls[0][0], "DELETE");
  assert.match(calls[0][1], /\/tasks\/task%2Fid$/);
  assert.equal(calls[0][2], undefined);
  assert.equal(calls[0][3], "selected-owner");
});

test("Google task pagination retains completed/hidden tasks and filters deleted rows", async () => {
  const calls = [];
  let owner = "original-owner";
  const api = createTasksApi(
    async (...args) => {
      calls.push(args);
      owner = "different-owner";
      return calls.length === 1
        ? { items: [{ id: "one" }, { id: "deleted", deleted: true }], nextPageToken: "second" }
        : { items: [{ id: "two", status: "completed" }] };
    },
    () => owner,
  );
  assert.deepEqual(
    (await api.tasks("list")).items.map((t) => t.id),
    ["one", "two"],
  );
  assert.equal(calls[1][3], "original-owner");
  const params = new URL(calls[1][1]).searchParams;
  assert.equal(params.get("pageToken"), "second");
  assert.equal(params.get("showCompleted"), "true");
  assert.equal(params.get("showHidden"), "true");
});

test("Google task pagination fails safely if Google repeats a page token", async () => {
  const api = createTasksApi(
    async () => ({ items: [], nextPageToken: "repeat" }),
    () => "owner",
  );
  await assert.rejects(api.tasks("list"), /GOOGLE_API_ERROR/);
});

test("legacy mind-map topics survive normalization and invalid links cannot create cycles", () => {
  const original = [
    { id: "a", text: "موضوع" },
    { id: "b", text: "Keep", parentId: "missing" },
  ];
  const result = normalizeMindNodes(original);
  assert.deepEqual(result, [
    { id: "a", text: "موضوع", parentId: null },
    { id: "b", text: "Keep", parentId: null },
  ]);
  assert.equal(original[0].parentId, undefined);
  const repaired = normalizeMindNodes([
    { id: "a", text: "A", parentId: "b" },
    { id: "b", text: "B", parentId: "a" },
    { id: "a", text: "duplicate" },
    null,
  ]);
  assert.equal(repaired.length, 2);
  assert.equal(layoutMindmap("Root", repaired).topics.length, 3);
});

test("mind map renders all branches and subbranches with non-overlapping connected topics", () => {
  const nodes = normalizeMindNodes(
    Array.from({ length: 40 }, (_, index) => ({
      id: String(index),
      text: `Topic ${index}`,
      parentId: index >= 8 ? String(index % 8) : null,
    })),
  );
  const graph = layoutMindmap("Main topic", nodes);
  assert.equal(graph.topics.length, nodes.length + 1);
  assert.equal(graph.edges.length, nodes.length);
  const root = graph.topics.find((node) => node.id === null);
  assert.ok(graph.topics.some((node) => node.x < root.x));
  assert.ok(graph.topics.some((node) => node.x > root.x));
  for (const topic of graph.topics) {
    assert.ok(topic.x >= 0 && topic.y >= 0);
    assert.ok(topic.x + topic.width <= graph.width && topic.y + topic.height <= graph.height);
    for (const other of graph.topics) {
      if (other === topic) continue;
      assert.ok(
        topic.x + topic.width <= other.x ||
          other.x + other.width <= topic.x ||
          topic.y + topic.height <= other.y ||
          other.y + other.height <= topic.y,
        `${topic.id} overlaps ${other.id}`,
      );
    }
  }
  for (const edge of graph.edges) assert.doesNotMatch(edge.path, /NaN|Infinity/);
  assert.equal(layoutMindmap("Empty", []).topics.length, 1);
});

test("deleting a mind-map topic preserves and reconnects its children", () => {
  const nodes = normalizeMindNodes([
    { id: "a", text: "A" },
    { id: "b", text: "B", parentId: "a" },
    { id: "c", text: "C", parentId: "b" },
  ]);
  const result = removeMindNode(nodes, "b");
  assert.deepEqual(
    result.map((node) => [node.id, node.parentId]),
    [
      ["a", null],
      ["c", "a"],
    ],
  );
  assert.equal(nodes.length, 3);
  assert.equal(removeMindNode(nodes, "a").find((node) => node.id === "b").parentId, null);
});

test("deep mind-map trees do not overflow the JS call stack", () => {
  const nodes = normalizeMindNodes(
    Array.from({ length: 2000 }, (_, i) => ({
      id: String(i),
      text: "Deep",
      parentId: i ? String(i - 1) : null,
    })).reverse(),
  );
  const graph = layoutMindmap("Root", nodes);
  assert.equal(graph.topics.length, 2001);
  assert.ok(Number.isFinite(graph.width));
});

test("visible resize grips are removed without removing southeast resize targets", () => {
  const card = readFileSync(
    new URL("../src/features/widget/canvas-card.tsx", import.meta.url),
    "utf8",
  );
  const window = readFileSync(
    new URL("../src/features/widget/window-resize-handles.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(card, /resize-handle/);
  assert.doesNotMatch(window, /window-resize-corner|<svg/);
  assert.match(card, /card-resize-SouthEast/);
  assert.match(window, /window-resize-SouthEast/);
});

test("tray controls include native windows that host live child webviews", () => {
  const native = readFileSync(new URL("../src-tauri/src/tray.rs", import.meta.url), "utf8");
  // Tauri get_webview_window/webview_windows filter out multi-webview hosts.
  // Guard the actual integration calls, not just the label-filter helper.
  assert.doesNotMatch(native, /\.(get_webview_window|webview_windows)\(/);
  assert.match(native, /app\.windows\(\)/);
  assert.match(native, /app\.get_window\("widget"\)/);
  assert.match(native, /tray_frontend_ready\(window: Window/);
  const lifecycle = readFileSync(
    new URL("../src/services/workspace-lifecycle.ts", import.meta.url),
    "utf8",
  );
  assert.match(lifecycle, /await getAllWindows\(\)/);
});

test("tray routes commands, serializes quit, and allows retry after a failed save", async () => {
  const calls = [];
  const errors = [];
  let release;
  let fail = true;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const handle = createTrayActionHandler({
    settings: () => calls.push("settings"),
    newNote: async () => calls.push("new-note"),
    quit: async () => {
      calls.push("quit");
      await gate;
      if (fail) throw new Error("disk unavailable");
    },
    error: (message) => errors.push(message),
  });
  await handle("settings");
  await handle("new-note");
  await handle("unrecognized");
  const quitting = handle("quit");
  await handle("quit");
  await handle("new-note");
  assert.deepEqual(calls, ["settings", "new-note", "quit"]);
  release();
  await quitting;
  assert.match(errors[0], /app is still running/);
  fail = false;
  await handle("quit");
  assert.equal(calls.filter((item) => item === "quit").length, 2);
  await handle("startup-error");
  assert.match(errors[1], /Windows startup/);
});

test("startup upgrades refresh enabled paths but preserve a user's opt-out", async () => {
  for (const [configured, active, expected] of [
    [false, false, 1],
    [true, true, 1],
    [true, false, 0],
  ]) {
    let enabled = 0;
    let marked = false;
    await reconcileAutostart(
      configured,
      async () => active,
      async () => {
        enabled++;
      },
      () => {
        marked = true;
      },
    );
    assert.equal(enabled, expected);
    assert.equal(marked, true);
  }
  let marked = false;
  await assert.rejects(
    reconcileAutostart(
      false,
      async () => false,
      async () => {
        throw new Error("registry unavailable");
      },
      () => {
        marked = true;
      },
    ),
    /registry unavailable/,
  );
  assert.equal(marked, false);
});

test("native layout sync is idle until invalidated and coalesces overlapping changes", async () => {
  const frames = new Map();
  let id = 0;
  let runs = 0;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const scheduler = createInvalidationScheduler(
    async () => {
      runs++;
      await gate;
    },
    assert.fail,
    (callback) => {
      frames.set(++id, callback);
      return id;
    },
    (key) => frames.delete(key),
  );
  const tick = async () => {
    for (const [key, callback] of [...frames]) {
      frames.delete(key);
      callback();
    }
    await new Promise(setImmediate);
  };
  assert.equal(frames.size, 0);
  scheduler.invalidate();
  scheduler.invalidate();
  assert.equal(frames.size, 1);
  await tick();
  scheduler.invalidate();
  scheduler.invalidate();
  assert.equal(runs, 1);
  assert.equal(frames.size, 0);
  release();
  await new Promise(setImmediate);
  assert.equal(frames.size, 1);
  await tick();
  assert.equal(runs, 2);
  assert.equal(frames.size, 0); // No perpetual RAF loop after settling.
  scheduler.invalidate();
  scheduler.dispose();
  assert.equal(frames.size, 0);
  scheduler.invalidate();
  assert.equal(frames.size, 0);
});

test("failed layout sync can retry, but never runs after disposal", async () => {
  let callback;
  const errors = [];
  const scheduler = createInvalidationScheduler(
    async () => {
      throw new Error("IPC failed");
    },
    (error) => errors.push(error.message),
    (next) => {
      callback = next;
      return 1;
    },
    () => {},
  );
  scheduler.invalidate();
  callback();
  await new Promise(setImmediate);
  assert.deepEqual(errors, ["IPC failed"]);
  scheduler.invalidate();
  callback();
  scheduler.dispose();
  await new Promise(setImmediate);
  assert.deepEqual(errors, ["IPC failed"]);
});

test("concurrent reads share work but completed data, failures and accounts are not cached", async () => {
  const reads = createSingleFlight();
  let calls = 0;
  const read = async () => ++calls;
  const first = reads.run("account-A:inbox", read);
  assert.equal(reads.run("account-A:inbox", read), first);
  await reads.run("account-B:inbox", read);
  await first;
  assert.equal(calls, 2);
  await reads.run("account-A:inbox", read);
  assert.equal(calls, 3);
  await assert.rejects(
    reads.run("failure", async () => {
      throw new Error("retry");
    }),
    /retry/,
  );
  assert.equal(await reads.run("failure", async () => "recovered"), "recovered");
  const old = reads.run("mutation", read);
  reads.clear();
  const fresh = reads.run("mutation", read);
  assert.notEqual(old, fresh);
  await Promise.all([old, fresh]);
});

test("email parsing decodes Unicode text but never returns active HTML", () => {
  const text = "Hello سلام";
  assert.equal(
    plainMail({ mimeType: "text/plain", body: { data: Buffer.from(text).toString("base64url") } }),
    text,
  );
  assert.equal(
    plainMail({
      mimeType: "text/html",
      body: { data: Buffer.from("<script>alert(1)</script>").toString("base64url") },
    }),
    "",
  );
  assert.equal(plainMail({ mimeType: "text/plain", body: { data: "not!base64" } }), "");
});

test("quit waits for all windows and ignores unrelated acknowledgements", async () => {
  let accept;
  let quit = false;
  let cleaned = false;
  const sent = [];
  const operation = flushBeforeShutdown({
    labels: ["a", "b"],
    requestId: "current",
    listen: async (handler) => {
      accept = handler;
      return () => {
        cleaned = true;
      };
    },
    send: async (label) => {
      sent.push(label);
    },
    quit: async () => {
      quit = true;
    },
  });
  await Promise.resolve();
  accept({ requestId: "old", label: "a", success: true });
  accept({ requestId: "current", label: "unknown", success: true });
  accept({ requestId: "current", label: "a", success: true });
  await Promise.resolve();
  assert.equal(quit, false);
  accept({ requestId: "current", label: "b", success: true });
  await operation;
  assert.deepEqual(sent, ["a", "b"]);
  assert.equal(quit, true);
  assert.equal(cleaned, true);
});

test("failed window save prevents process exit and cleans listeners", async () => {
  let cleaned = false;
  let quit = false;
  let accept;
  const operation = flushBeforeShutdown({
    labels: ["a"],
    requestId: "current",
    listen: async (handler) => {
      accept = handler;
      return () => {
        cleaned = true;
      };
    },
    send: async (label) => {
      accept({ requestId: "current", label, success: false });
    },
    quit: async () => {
      quit = true;
    },
  });
  await assert.rejects(operation, /could not be saved/);
  assert.equal(quit, false);
  assert.equal(cleaned, true);
});

test("unresponsive window prevents process exit rather than dropping edits", async () => {
  let quit = false;
  await assert.rejects(
    flushBeforeShutdown({
      labels: ["a"],
      requestId: "current",
      listen: async () => () => {},
      send: async () => {},
      quit: async () => {
        quit = true;
      },
      timeoutMs: 10,
    }),
    /Timed out/,
  );
  assert.equal(quit, false);
});

test("website input only permits HTTP(S), without embedded credentials", () => {
  assert.equal(normalizeWebsite("example.com/path"), "https://example.com/path");
  assert.equal(normalizeWebsite(" http://localhost:1420/ "), "http://localhost:1420/");
  for (const value of [
    "",
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///C:/Windows",
    "https://user:password@example.com",
    "https://",
  ]) {
    assert.equal(normalizeWebsite(value), null, value);
  }
});

test("damaged and non-object section JSON falls back safely", () => {
  for (const json of ["null", "[]", "42", "true", '"text"', "{broken"])
    assert.deepEqual(readSectionConfig(json), {});
  assert.deepEqual(readSectionConfig('{"title":"Kept"}'), { title: "Kept" });
});

test("section defaults do not share mutable arrays", () => {
  const first = createSectionConfig("mindmap");
  first.nodes.push({ id: "one", text: "Hello" });
  assert.deepEqual(createSectionConfig("mindmap").nodes, []);
});

test("autosave coalesces keystrokes and flushes before closing", async () => {
  const values = [];
  const writer = createAutosave(
    async (value) => {
      values.push(value);
    },
    { delay: 60_000 },
  );
  writer.schedule("first");
  writer.schedule("latest");
  await writer.flush();
  assert.deepEqual(values, ["latest"]);
});

test("older completion cannot mark a newer edit as saved; writes stay ordered", async () => {
  const values = [];
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let saved = 0;
  const writer = createAutosave(
    async (value) => {
      if (value === "old") await gate;
      values.push(value);
    },
    { delay: 60_000, onSaved: () => saved++ },
  );
  writer.schedule("old");
  const first = writer.flush();
  writer.schedule("new");
  const second = writer.flush();
  release();
  await first;
  await second;
  assert.deepEqual(values, ["old", "new"]);
  assert.equal(saved, 1);
});

test("a failed save is reported, retained for retry, and does not poison the queue", async () => {
  let attempts = 0;
  const errors = [];
  const writer = createAutosave(
    async () => {
      if (++attempts === 1) throw new Error("disk unavailable");
    },
    { delay: 60_000, onError: (reason) => errors.push(reason.message) },
  );
  writer.schedule("keep me");
  await assert.rejects(writer.flush(), /disk unavailable/);
  await writer.flush();
  assert.equal(attempts, 2);
  assert.deepEqual(errors, ["disk unavailable"]);
});

test("remote website views are not granted IPC capabilities", () => {
  const capability = JSON.parse(
    readFileSync(new URL("../src-tauri/capabilities/default.json", import.meta.url), "utf8"),
  );
  assert.equal(capability.remote, undefined);
  const config = JSON.parse(
    readFileSync(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8"),
  );
  assert.match(config.app.security.csp, /script-src 'self'/);
  assert.match(config.app.security.csp, /object-src 'none'/);
});
