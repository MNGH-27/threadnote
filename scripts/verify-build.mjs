import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

// Source-only tests cannot catch Tailwind purging dynamically constructed classes.
const assets = new URL("../dist/assets/", import.meta.url);
const css = readdirSync(assets)
  .filter((file) => file.endsWith(".css"))
  .map((file) => readFileSync(new URL(file, assets), "utf8"))
  .join("\n");
const directions = [
  "North",
  "South",
  "East",
  "West",
  "NorthWest",
  "NorthEast",
  "SouthWest",
  "SouthEast",
];
for (const direction of directions) {
  assert.match(
    css,
    new RegExp(`\\.card-resize-${direction}\\b`),
    `Missing card resize CSS: ${direction}`,
  );
  const selector = `window-resize-${direction}`;
  assert.match(css, new RegExp(`\\.${selector}\\b`), `Missing window resize CSS: ${direction}`);
}
assert.match(css, /clip-path:polygon/, "Resize corners must not cover header controls");
assert.doesNotMatch(
  css,
  /\.resize-handle\b|\.window-resize-corner\b/,
  "Visible resize grips must not return",
);
assert.match(css, /\.mind-edges\b/, "Connected mind-map geometry must retain its CSS");
console.log(
  "PASS: production CSS retains every card/window resize direction and clipped corner hit areas.",
);
