export interface MindNode {
  id: string;
  text: string;
  parentId: string | null;
}

/** Upgrade legacy flat branches; repair invalid links without discarding topics. */
export function normalizeMindNodes(value: unknown): MindNode[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, MindNode>();
  for (const item of value) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.id !== "string" ||
      !item.id ||
      typeof item.text !== "string" ||
      byId.has(item.id)
    )
      continue;
    byId.set(item.id, {
      id: item.id,
      text: item.text,
      parentId: typeof item.parentId === "string" ? item.parentId : null,
    });
  }
  for (const node of byId.values()) {
    if (node.parentId === node.id || (node.parentId !== null && !byId.has(node.parentId)))
      node.parentId = null;
  }
  const complete = new Set<string>();
  for (const node of byId.values()) {
    const path = new Set<string>();
    let current: MindNode | undefined = node;
    while (current && !complete.has(current.id)) {
      if (path.has(current.id)) {
        current.parentId = null;
        break;
      }
      path.add(current.id);
      current = current.parentId === null ? undefined : byId.get(current.parentId);
    }
    for (const id of path) complete.add(id);
  }
  return [...byId.values()];
}

/** Promote children on deletion instead of silently deleting a whole subtree. */
export function removeMindNode(nodes: MindNode[], id: string): MindNode[] {
  const removed = nodes.find((node) => node.id === id);
  if (!removed) return nodes;
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => (node.parentId === id ? { ...node, parentId: removed.parentId } : node));
}

interface Topic {
  id: string | null;
  text: string;
  parentId: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Two-sided tree, laid out iteratively to handle deeply nested saved maps. */
export function layoutMindmap(center: string, nodes: MindNode[]) {
  const width = 168,
    height = 42,
    column = 232,
    gap = 18,
    padding = 24;
  const children = new Map<string | null, MindNode[]>();
  for (const node of nodes) {
    const siblings = children.get(node.parentId) ?? [];
    siblings.push(node);
    children.set(node.parentId, siblings);
  }
  const roots = children.get(null) ?? [];
  const order: MindNode[] = [],
    stack = [...roots];
  while (stack.length) {
    const node = stack.pop()!;
    order.push(node);
    for (const child of children.get(node.id) ?? []) stack.push(child);
  }
  const heights = new Map<string, number>();
  for (const node of order.reverse()) {
    const items = children.get(node.id) ?? [];
    heights.set(
      node.id,
      Math.max(
        height,
        items.reduce((sum, child) => sum + heights.get(child.id)!, 0) +
          Math.max(0, items.length - 1) * gap,
      ),
    );
  }
  const left: MindNode[] = [],
    right: MindNode[] = [];
  let leftHeight = 0,
    rightHeight = 0;
  for (const node of roots) {
    if (rightHeight <= leftHeight) {
      right.push(node);
      rightHeight += heights.get(node.id)! + gap;
    } else {
      left.push(node);
      leftHeight += heights.get(node.id)! + gap;
    }
  }
  const topics: Topic[] = [
    { id: null, text: center, parentId: null, x: -width / 2, y: -height / 2, width, height },
  ];
  const pending: Array<{ node: MindNode; top: number; depth: number; side: number }> = [];
  const enqueue = (items: MindNode[], top: number, depth: number, side: number) => {
    for (const node of items) {
      pending.push({ node, top, depth, side });
      top += heights.get(node.id)! + gap;
    }
  };
  enqueue(left, -Math.max(0, leftHeight - gap) / 2, 1, -1);
  enqueue(right, -Math.max(0, rightHeight - gap) / 2, 1, 1);
  while (pending.length) {
    const { node, top, depth, side } = pending.pop()!;
    topics.push({
      ...node,
      x: side * depth * column - width / 2,
      y: top + heights.get(node.id)! / 2 - height / 2,
      width,
      height,
    });
    enqueue(children.get(node.id) ?? [], top, depth + 1, side);
  }
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const node of topics) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + width);
    maxY = Math.max(maxY, node.y + height);
  }
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;
  for (const node of topics) {
    node.x -= minX;
    node.y -= minY;
  }
  const positions = new Map(topics.map((node) => [node.id, node]));
  const edges = topics
    .filter((node) => node.id !== null)
    .map((node) => {
      const parent = positions.get(node.parentId)!;
      const sign = node.x > parent.x ? 1 : -1;
      const x1 = parent.x + (sign > 0 ? width : 0),
        y1 = parent.y + height / 2;
      const x2 = node.x + (sign > 0 ? 0 : width),
        y2 = node.y + height / 2;
      const bend = Math.abs(x2 - x1) / 2;
      return {
        id: node.id!,
        path: `M ${x1} ${y1} C ${x1 + sign * bend} ${y1}, ${x2 - sign * bend} ${y2}, ${x2} ${y2}`,
      };
    });
  return { topics, edges, width: maxX - minX, height: maxY - minY };
}
