import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";

const geometrySource = readFileSync(
  new URL("../src/features/widget/canvas-geometry.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(geometrySource, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText;
const { connectionPath, sectionGeometry, enclosingBounds, visibleCanvasRect } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);
const box = { x: 10, y: 20, width: 300, height: 200 };
const resizeSource = readFileSync(
  new URL("../src/features/widget/card-resize.ts", import.meta.url),
  "utf8",
);
const resizeCompiled = ts.transpileModule(resizeSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText;
const { resizeCard, resizeDirections } = await import(
  `data:text/javascript;base64,${Buffer.from(resizeCompiled).toString("base64")}`
);
assert.equal(resizeDirections.length, 8);
for (const direction of resizeDirections) {
  const origin = { x: 100, y: 200, width: 400, height: 300 };
  const result = resizeCard(origin, direction, { x: 40, y: 30 });
  assert.equal(result.x, direction.includes("West") ? 140 : 100, direction);
  assert.equal(result.y, direction.includes("North") ? 230 : 200, direction);
  assert.equal(
    result.width,
    direction.includes("West") ? 360 : direction.includes("East") ? 440 : 400,
    direction,
  );
  assert.equal(
    result.height,
    direction.includes("North") ? 270 : direction.includes("South") ? 330 : 300,
    direction,
  );
  for (const delta of [
    { x: 10000, y: 10000 },
    { x: -10000, y: -10000 },
  ]) {
    const clamped = resizeCard(origin, direction, delta);
    assert.ok(clamped.width >= 280 && clamped.height >= 180, direction);
    if (direction.includes("West"))
      assert.equal(clamped.x + clamped.width, origin.x + origin.width);
    else assert.equal(clamped.x, origin.x);
    if (direction.includes("North"))
      assert.equal(clamped.y + clamped.height, origin.y + origin.height);
    else assert.equal(clamped.y, origin.y);
  }
}
assert.equal(
  resizeCard(box, "East", { x: 30 / 0.5, y: 0 }).width,
  360,
  "screen delta is converted to canvas units at non-default zoom",
);
for (const [destination, start, end] of [
  [
    { x: 500, y: 20, width: 200, height: 200 },
    { x: 310, y: 120 },
    { x: 500, y: 120 },
  ],
  [
    { x: -400, y: 20, width: 200, height: 200 },
    { x: 10, y: 120 },
    { x: -200, y: 120 },
  ],
  [
    { x: 10, y: 500, width: 300, height: 100 },
    { x: 160, y: 220 },
    { x: 160, y: 500 },
  ],
  [
    { x: 10, y: -400, width: 300, height: 100 },
    { x: 160, y: 20 },
    { x: 160, y: -300 },
  ],
]) {
  const line = connectionPath(box, destination);
  assert.deepEqual(line.start, start, "connection begins on the facing source edge");
  assert.deepEqual(line.end, end, "arrow ends on the facing target edge");
}
const invalid = sectionGeometry({ width: -5, height: 0, x: NaN }, 0, false);
assert.equal(invalid.width, 280);
assert.equal(invalid.height, 180);
assert.equal(invalid.x, 430);
assert.deepEqual(
  visibleCanvasRect({ x: -100, y: 50 }, 0.5, { width: 320, height: 400 }),
  { x: 200, y: -100, width: 640, height: 800 },
  "minimap viewport accounts for both zoom and pan",
);
assert.deepEqual(
  enclosingBounds(
    [
      { x: 10, y: 20, width: 300, height: 200 },
      { x: 900, y: -100, width: 200, height: 400 },
    ],
    20,
  ),
  { x: -10, y: -120, width: 1130, height: 440 },
  "minimap bounds include distant and negative-position content",
);

const database = new DatabaseSync(":memory:");
database.exec("PRAGMA foreign_keys=ON");
const migrations = new URL("../src-tauri/migrations/", import.meta.url);
for (const filename of readdirSync(migrations)
  .filter((name) => name.endsWith(".sql"))
  .sort()) {
  if (filename.startsWith("0006")) {
    database.exec(`INSERT INTO widget_notes (id,title,body,color,created_at,updated_at) VALUES ('migration-note','Keep me','','amber',1,1);
      INSERT INTO note_sections (id,note_id,section_type,position,config_json,created_at,updated_at) VALUES ('migration-section','migration-note','note',0,'{"title":"preserved"}',1,1);
      INSERT INTO note_connections VALUES ('migration-edge','migration-note','root','migration-section',1);`);
  }
  database.exec(readFileSync(new URL(filename, migrations), "utf8"));
  if (filename.startsWith("0006")) {
    assert.equal(
      database.prepare("SELECT config_json FROM note_sections WHERE id='migration-section'").get()
        .config_json,
      '{"title":"preserved"}',
      "Calendar migration preserves existing section content",
    );
    assert.equal(
      database
        .prepare("SELECT COUNT(*) AS count FROM note_connections WHERE id='migration-edge'")
        .get().count,
      1,
      "Calendar migration preserves existing connections",
    );
    database.prepare("DELETE FROM widget_notes WHERE id='migration-note'").run();
  }
}
database.exec(`INSERT INTO widget_notes (id,title,body,color,created_at,updated_at) VALUES ('board','Test','','amber',1,1);
  INSERT INTO note_sections (id,note_id,section_type,position,config_json,created_at,updated_at) VALUES
    ('a','board','note',0,'{}',1,1),('b','board','tasks',1,'{}',1,1);
  INSERT INTO note_connections VALUES ('ab','board','a','b',1),('root-b','board','root','b',1);`);
assert.equal(
  database.prepare("SELECT COUNT(*) AS count FROM note_connections").get().count,
  2,
  "an unconfirmed deletion has not removed connections",
);
database.prepare("DELETE FROM note_sections WHERE id=?").run("a");
assert.deepEqual(
  database
    .prepare("SELECT id FROM note_connections")
    .all()
    .map((item) => item.id),
  ["root-b"],
  "deleting a card removes only its own edges atomically",
);
database.close();
console.log(
  "PASS: eight-direction resizing, anchored minimum dimensions, zoom, edge anchors, minimap, migrations, and atomic deletion cleanup.",
);
