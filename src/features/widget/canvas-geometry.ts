export interface Point {
  x: number;
  y: number;
}
export interface CardSize {
  width: number;
  height: number;
}
export type CardGeometry = Point & CardSize;

export function enclosingBounds(cards: CardGeometry[], padding = 60): CardGeometry {
  if (!cards.length)
    return { x: -padding, y: -padding, width: 400 + padding * 2, height: 300 + padding * 2 };
  const left = Math.min(...cards.map((card) => card.x));
  const top = Math.min(...cards.map((card) => card.y));
  const right = Math.max(...cards.map((card) => card.x + card.width));
  const bottom = Math.max(...cards.map((card) => card.y + card.height));
  return {
    x: left - padding,
    y: top - padding,
    width: right - left + padding * 2,
    height: bottom - top + padding * 2,
  };
}

export function visibleCanvasRect(pan: Point, zoom: number, viewport: CardSize): CardGeometry {
  return {
    x: -pan.x / zoom,
    y: -pan.y / zoom,
    width: viewport.width / zoom,
    height: viewport.height / zoom,
  };
}

export function connectionPath(from: CardGeometry, to: CardGeometry) {
  const dx = to.x + to.width / 2 - from.x - from.width / 2;
  const dy = to.y + to.height / 2 - from.y - from.height / 2;
  // Choose facing edges, including vertical connections, instead of card centers.
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const direction = (horizontal ? dx : dy) >= 0 ? 1 : -1;
  const start = horizontal
    ? { x: from.x + (direction > 0 ? from.width : 0), y: from.y + from.height / 2 }
    : { x: from.x + from.width / 2, y: from.y + (direction > 0 ? from.height : 0) };
  const end = horizontal
    ? { x: to.x + (direction > 0 ? 0 : to.width), y: to.y + to.height / 2 }
    : { x: to.x + to.width / 2, y: to.y + (direction > 0 ? 0 : to.height) };
  const bend = Math.max(40, Math.abs(horizontal ? end.x - start.x : end.y - start.y) * 0.45);
  const c1 = horizontal
    ? { x: start.x + direction * bend, y: start.y }
    : { x: start.x, y: start.y + direction * bend };
  const c2 = horizontal
    ? { x: end.x - direction * bend, y: end.y }
    : { x: end.x, y: end.y - direction * bend };
  return {
    start,
    end,
    path: `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`,
  };
}

export function readPoint(key: string, fallback: Point) {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null") as Partial<Point> | null;
    return value && Number.isFinite(value.x) && Number.isFinite(value.y)
      ? { x: Number(value.x), y: Number(value.y) }
      : fallback;
  } catch {
    return fallback;
  }
}

export function sectionGeometry(layout: unknown, index: number, site: boolean): CardGeometry {
  const raw = (layout ?? {}) as Partial<CardGeometry>;
  return {
    x: Number.isFinite(raw.x) ? Number(raw.x) : 430 + (index % 3) * 390,
    y: Number.isFinite(raw.y) ? Number(raw.y) : 60 + Math.floor(index / 3) * 400,
    width: Math.max(280, Number.isFinite(raw.width) ? Number(raw.width) : site ? 520 : 340),
    height: Math.max(180, Number.isFinite(raw.height) ? Number(raw.height) : site ? 460 : 310),
  };
}
