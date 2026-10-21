import type { CardGeometry, Point } from "./canvas-geometry";

export const resizeDirections = [
  "North",
  "South",
  "East",
  "West",
  "NorthWest",
  "NorthEast",
  "SouthWest",
  "SouthEast",
] as const;
export type CardResizeDirection = (typeof resizeDirections)[number];

/** Keep the opposite edge anchored, including when the minimum size is reached. */
export function resizeCard(
  origin: CardGeometry,
  direction: CardResizeDirection,
  delta: Point,
): CardGeometry {
  const result = { ...origin };
  if (direction.includes("West")) {
    result.x = Math.min(origin.x + delta.x, origin.x + origin.width - 280);
    result.width = origin.x + origin.width - result.x;
  } else if (direction.includes("East")) result.width = Math.max(280, origin.width + delta.x);
  if (direction.includes("North")) {
    result.y = Math.min(origin.y + delta.y, origin.y + origin.height - 180);
    result.height = origin.y + origin.height - result.y;
  } else if (direction.includes("South")) result.height = Math.max(180, origin.height + delta.y);
  return result;
}
