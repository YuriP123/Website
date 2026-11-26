'use client';

import { useEffect, useRef } from 'react';

// Ported from spin.py: extrudes the ASCII logo and spins it around the Y axis.
const ART = [
  ' /...      /.\\                               /.       ..',
  ' //.\\\\    //.\\\\                             //.\\\\    //\\\\',
  '``\\@\\\\\\   ``@\\\\\\                            ``@\\\\\\  ```@\\\\\\',
  ' \\\\\\@\\\\\\  \\\\\\@@\\\\                           \\\\\\@\\\\\\  \\\\@@\\\\\\',
  '  \\\\\\@\\\\\\  \\\\\\@@\\\\                           \\\\\\@\\\\\\  \\\\@@\\\\\\',
  '   \\\\\\@@\\\\  \\\\\\@\\\\\\                           \\\\\\@\\\\\\  \\\\@@\\\\\\',
  '    \\\\\\@@\\\\  \\\\\\@\\\\\\                           \\\\@@\\\\\\  \\\\@@\\\\    ....',
  '     \\\\\\@@\\\\  \\\\@@\\\\\\                           \\\\@@\\\\\\  \\\\@@\\\\  `/..\\\\',
  '      \\\\\\@@\\\\  \\\\\\@\\\\\\                           \\\\@@\\\\\\  \\\\@@\\\\ \\\\\\@@\\\\',
  '       \\\\\\@@\\\\  \\\\@@\\\\\\                           \\\\@@\\\\\\  \\\\@@\\\\ \\\\\\@@\\\\',
  '        \\\\\\@@\\\\  \\\\@@\\\\\\    ...\\              ...  \\\\@@\\\\\\  \\\\@@\\\\ \\\\\\@@\\\\',
  '         \\\\../`   \\\\@@\\\\\\  `/..\\\\            //.\\\\  \\\\@@\\\\\\  \\\\@@`` \\\\\\@@\\\\',
  '          \\.../    \\\\@@\\\\\\ `\\@@\\\\\\           ``@\\\\\\  \\\\@@\\\\\\ \\\\\\.//  \\\\\\@@\\\\',
  '                    \\\\@@\\\\\\ \\\\@@\\\\\\          \\\\\\@@\\\\  \\\\@@\\\\\\  ../    \\\\\\@@\\\\',
  '                     \\\\@@\\\\\\ \\\\@@\\\\\\     /.\\  \\\\\\@@\\\\  \\\\@@\\\\          \\\\\\@@\\\\',
  '                      \\\\@@\\\\  \\\\@@\\\\\\   //.\\\\  \\\\\\@@\\\\  \\\\@@\\\\          \\\\\\@@\\\\',
  '                       \\\\@@\\\\\\ \\\\@@\\\\\\  ``@\\\\\\  \\\\\\@@\\\\  \\\\@@\\\\          \\\\\\@\\\\\\',
  '                        \\\\@@\\\\  \\\\@@\\\\\\ \\\\\\@@\\\\  \\\\\\@@\\\\  \\\\@@\\\\          \\\\\\@\\\\\\',
  '                         \\\\@@\\\\  \\\\@@\\\\\\ \\\\\\@@\\\\  \\\\\\@@\\\\  \\\\@@\\\\          \\\\\\@\\\\\\',
  '                          \\\\@@\\\\  \\\\\\@\\\\` \\\\\\@@\\\\  \\\\\\@@\\\\  \\\\@@\\\\          \\\\@@\\\\\\',
  '                           \\\\./``  \\\\../`  \\\\../`   \\\\../`   \\\\./`           \\\\../`',
  '                            ....    ....    \\...     \\.../   \\.../            ....',
];

const MIRROR = { '/': '\\', '\\': '/', '(': ')', ')': '(', '<': '>', '>': '<', '[': ']', ']': '[', '{': '}', '}': '{' };
const RAMP = '.,-~:;=!*#$'; // dark -> bright
const LIGHT_X = -0.5;
const LIGHT_Z = -0.87;
const THICKNESS = 2;
const SECONDS_PER_TURN = 4;
const FRAME_MS = 1000 / 30;

const HEIGHT = ART.length;
const WIDTH = Math.max(...ART.map((l) => l.length));
const COLS = WIDTH + 4;
const ROWS = HEIGHT;

// (x, y, char, tilt) per cell; tilt is -1..1 across each horizontal run so
// strokes shade like rounded tubes.
const POINTS = (() => {
  const pts = [];
  const cx = (WIDTH - 1) / 2;
  const cy = (HEIGHT - 1) / 2;
  ART.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] === ' ') {
        x += 1;
        continue;
      }
      const start = x;
      while (x < row.length && row[x] !== ' ') x += 1;
      const run = x - start;
      for (let i = start; i < x; i += 1) {
        const tilt = run === 1 ? 0 : (2 * (i - start)) / (run - 1) - 1;
        pts.push([i - cx, y - cy, row[i], tilt]);
      }
    }
  });
  return pts;
})();

const LAYERS = (() => {
  const n = THICKNESS * 2;
  const out = [];
  for (let i = 0; i <= n; i += 1) out.push(-THICKNESS / 2 + i * (THICKNESS / n));
  return out;
})();

const shade = (nx, nz) => {
  const lit = nx * LIGHT_X + nz * LIGHT_Z;
  return Math.max(0, Math.min(1, 0.12 + 0.88 * Math.max(0, lit)));
};

const ramp = (b) => RAMP[Math.min(RAMP.length - 1, Math.floor(b * (RAMP.length - 1) + 0.5))];

function render(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const depth = new Float32Array(COLS * ROWS).fill(Infinity);
  const glyphs = new Array(COLS * ROWS).fill(' ');
  const sideB = (s < 0 ? shade(c, s) : shade(-c, -s)) * 0.8;
  const sideGlyph = ramp(sideB);
  const first = LAYERS[0];
  const last = LAYERS[LAYERS.length - 1];

  for (const [x, y, ch, tilt] of POINTS) {
    const sy = Math.floor(ROWS / 2 + y + 0.5);
    if (sy < 0 || sy >= ROWS) continue;
    for (const lz of LAYERS) {
      const rx = x * c - lz * s;
      const rz = x * s + lz * c;
      const sx = Math.floor(COLS / 2 + rx + 0.5);
      if (sx < 0 || sx >= COLS) continue;
      const key = sy * COLS + sx;
      if (depth[key] <= rz) continue;

      const onFront = lz === first && c > 0;
      const onBack = lz === last && c < 0;
      let glyph;
      if (onFront || onBack) {
        if (ch === '@') {
          let nx = 0.75 * tilt;
          let nz = -Math.sqrt(1 - nx * nx);
          if (onBack) {
            nx = -nx;
            nz = -nz;
          }
          glyph = ramp(shade(nx * c - nz * s, nx * s + nz * c));
        } else {
          glyph = onFront ? ch : MIRROR[ch] || ch;
        }
      } else {
        glyph = sideGlyph;
      }
      depth[key] = rz;
      glyphs[key] = glyph;
    }
  }

  const lines = [];
  for (let r = 0; r < ROWS; r += 1) {
    lines.push(glyphs.slice(r * COLS, (r + 1) * COLS).join(''));
  }
  return lines.join('\n');
}

export default function SpinningLogo() {
  const preRef = useRef(null);

  useEffect(() => {
    const pre = preRef.current;
    if (!pre) return undefined;

    pre.textContent = render(0);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    let raf;
    let lastDraw = 0;
    const start = performance.now();
    const tick = (now) => {
      if (now - lastDraw >= FRAME_MS) {
        lastDraw = now;
        pre.textContent = render((2 * Math.PI * (now - start)) / (SECONDS_PER_TURN * 1000));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <pre ref={preRef} className="spinning-logo" aria-label="Yuri logo" />;
}
