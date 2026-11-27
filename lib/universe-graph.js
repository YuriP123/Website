// Static SVG picture of the notes and their connections, laid out at build time
// with a small force simulation (no client JS, no dependencies).
//
// Input: { nodes: [{ g: group, p: isPublic }], links: [[a, b], ...] }
// Linked notes form the cluster in the middle; notes with no links sit on a
// hollow ring around it, like stray satellites.
//
// Black and white to match the classic Mac look: each group gets a
// MacPaint-style fill pattern instead of a colour.

const SIZE = 600;
const BACKGROUND = '#ffffff';
const INK = '#000000';
const ORPHAN = '#ffffff';
const OTHER = '#ffffff';
// Fill patterns, assigned to groups from largest to smallest.
// Each is [tile size, SVG drawn on a white tile].
const PATTERNS = [
  [4, `<rect width="4" height="4" fill="${INK}"/>`], // solid
  [4, `<rect width="2" height="2" fill="${INK}"/><rect x="2" y="2" width="2" height="2" fill="${INK}"/>`], // checker
  [6, `<path d="M0 6L6 0M-1 1L1 -1M5 7L7 5" stroke="${INK}" stroke-width="1.6"/>`], // diagonal
  [4, `<rect width="4" height="2" fill="${INK}"/>`], // horizontal lines
  [4, `<rect width="4" height="4" fill="${INK}"/><rect width="2" height="2" fill="${BACKGROUND}"/>`], // dark grey
  [4, `<rect width="2" height="4" fill="${INK}"/>`], // vertical lines
  [6, `<path d="M0 3H6M3 0V6" stroke="${INK}" stroke-width="1.4"/>`], // grid
  [4, `<rect width="2" height="2" fill="${INK}"/>`], // light grey
];
const patternDefs = () =>
  `<defs>${PATTERNS.map(
    ([size, tile], i) =>
      `<pattern id="universe-graph-p${i}" width="${size}" height="${size}" patternUnits="userSpaceOnUse">` +
      `<rect width="${size}" height="${size}" fill="${BACKGROUND}"/>${tile}</pattern>`,
  ).join('')}</defs>`;

// Deterministic PRNG so the picture only changes when the notes do
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function simulate(count, links, rand) {
  const pos = Array.from({ length: count }, () => {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 100;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r, vx: 0, vy: 0 };
  });

  for (let step = 0, alpha = 1; step < 400; step++, alpha *= 0.985) {
    // Repulsion between every pair
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const dx = pos[j].x - pos[i].x || 0.01;
        const dy = pos[j].y - pos[i].y || 0.01;
        const d2 = Math.max(dx * dx + dy * dy, 4);
        const f = (120 * alpha) / d2;
        pos[i].vx -= dx * f; pos[i].vy -= dy * f;
        pos[j].vx += dx * f; pos[j].vy += dy * f;
      }
    }
    // Links pull toward a resting length
    for (const [a, b] of links) {
      const dx = pos[b].x - pos[a].x;
      const dy = pos[b].y - pos[a].y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = ((d - 18) / d) * 0.08 * alpha;
      pos[a].vx += dx * f; pos[a].vy += dy * f;
      pos[b].vx -= dx * f; pos[b].vy -= dy * f;
    }
    // Gravity toward the centre, then move with damping
    for (const p of pos) {
      p.vx -= p.x * 0.06 * alpha;
      p.vy -= p.y * 0.06 * alpha;
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.6; p.vy *= 0.6;
    }
  }
  return pos;
}

export function renderGraphSvg(graph) {
  const { nodes, links } = graph;
  if (!nodes?.length) return '';
  const rand = mulberry32(nodes.length * 7919 + links.length);

  const degree = new Array(nodes.length).fill(0);
  for (const [a, b] of links) { degree[a]++; degree[b]++; }

  // Pattern by group, largest groups first
  const sizes = new Map();
  nodes.forEach((n) => sizes.set(n.g, (sizes.get(n.g) || 0) + 1));
  const fills = new Map(
    [...sizes]
      .sort((a, b) => b[1] - a[1])
      .map(([g], i) => [g, i < PATTERNS.length ? `url(#universe-graph-p${i})` : OTHER]),
  );

  // Lay out linked notes as a cluster
  const linked = nodes.map((_, i) => i).filter((i) => degree[i] > 0);
  const local = new Map(linked.map((i, k) => [i, k]));
  const pos = simulate(
    linked.length,
    links.map(([a, b]) => [local.get(a), local.get(b)]),
    rand,
  );
  const points = new Map(linked.map((i, k) => [i, pos[k]]));

  // Orphans on a loose ring outside the cluster
  const clusterRadius = Math.max(60, ...pos.map((p) => Math.hypot(p.x, p.y)));
  const orphans = nodes.map((_, i) => i).filter((i) => degree[i] === 0);
  orphans.forEach((i, k) => {
    const a = (k / orphans.length) * Math.PI * 2 + rand() * 0.05;
    const r = clusterRadius * (1.12 + rand() * 0.1);
    points.set(i, { x: Math.cos(a) * r, y: Math.sin(a) * r });
  });

  // Fit into the canvas
  const extent = Math.max(...[...points.values()].map((p) => Math.hypot(p.x, p.y)), 1);
  const scale = (SIZE / 2 - 16) / extent;
  const at = (i) => {
    const p = points.get(i);
    return [(SIZE / 2 + p.x * scale).toFixed(1), (SIZE / 2 + p.y * scale).toFixed(1)];
  };

  const edges = links
    .map(([a, b]) => {
      const [x1, y1] = at(a);
      const [x2, y2] = at(b);
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    })
    .join('');

  // Draw small nodes first so hubs sit on top
  const circles = nodes
    .map((n, i) => i)
    .sort((a, b) => degree[a] - degree[b])
    .map((i) => {
      const [cx, cy] = at(i);
      const r = degree[i] === 0 ? 3 : 3.5 + Math.sqrt(degree[i]) * 1.6;
      const fill = degree[i] === 0 ? ORPHAN : fills.get(nodes[i].g);
      return `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="${fill}"/>`;
    })
    .join('');

  return (
    `<figure class="universe-graph">` +
    `<svg viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-label="Graph of ${nodes.length} notes and ${links.length} connections">` +
    patternDefs() +
    `<rect width="${SIZE}" height="${SIZE}" fill="${BACKGROUND}"/>` +
    `<g stroke="${INK}" stroke-width="0.7" stroke-opacity="0.55">${edges}</g>` +
    `<g stroke="${INK}" stroke-width="1.2">${circles}</g>` +
    `</svg></figure>`
  );
}
