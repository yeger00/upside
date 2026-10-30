/* Upside level format: one shared checker for the game, the editor and the tests.
 *
 * A level file (levels/<id>.json):
 *   {
 *     "format": "upside-level",
 *     "version": 1,
 *     "id": "stepping-stones",      lowercase-hyphen, unique, never changes
 *     "name": "Stepping stones",
 *     "author": "yeger00",          optional
 *     "notes": "...",               optional, never shown in the game
 *     "map": ["###...", "..."]      text grid, one string per row
 *   }
 *
 * Map legend:
 *   #  wall                 1 / 2  Black / White start
 *   X  Black exit           Y      White exit
 *   a-d plate  ->  A-D door with the same letter (a door is one vertical run)
 *   K  black crate          W      white crate
 *   ^  thorns on the floor  v      thorns on the ceiling
 *   space  empty
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.UpsideLevelFormat = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FORMAT = 'upside-level';
  const VERSION = 1;
  const MIN_SIZE = 10, MAX_SIZE = 16;
  const LEGEND = '#12XYabcdABCDKW^v ';
  const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  const ONE_OF_EACH = { '1': 'Black start (1)', '2': 'White start (2)', X: 'Black exit (X)', Y: 'White exit (Y)' };

  function slugify(name) {
    return String(name || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  /* Returns { ok, errors: [plain-language strings] }. opts.fileId: expected id (file name). */
  function checkLevel(def, opts) {
    opts = opts || {};
    const errors = [];
    if (!def || typeof def !== 'object' || Array.isArray(def)) return { ok: false, errors: ['This is not a level (expected a JSON object).'] };
    if (def.format !== FORMAT) errors.push(`"format" must be "${FORMAT}".`);
    if (def.version !== VERSION) errors.push(`"version" must be ${VERSION}.`);
    if (typeof def.id !== 'string' || !ID_RE.test(def.id)) errors.push('The id must be lowercase letters and digits joined by hyphens, like "stepping-stones".');
    else if (opts.fileId && def.id !== opts.fileId) errors.push(`The id "${def.id}" doesn't match the file name "${opts.fileId}.json".`);
    if (typeof def.name !== 'string' || !def.name.trim()) errors.push('The level needs a name.');
    for (const k of ['author', 'notes']) if (k in def && typeof def[k] !== 'string') errors.push(`"${k}" must be text.`);

    const map = def.map;
    if (!Array.isArray(map) || !map.length || !map.every(r => typeof r === 'string')) {
      errors.push('"map" must be a list of text rows.');
      return { ok: false, errors };
    }
    const h = map.length, w = map[0].length;
    if (!map.every(r => r.length === w)) { errors.push('Every map row must be the same width.'); return { ok: false, errors }; }
    if (w < MIN_SIZE || w > MAX_SIZE || h < MIN_SIZE || h > MAX_SIZE) errors.push(`The map is ${w}×${h}; width and height must each be ${MIN_SIZE}–${MAX_SIZE}.`);

    const bad = new Set();
    for (const r of map) for (const ch of r) if (!LEGEND.includes(ch)) bad.add(ch);
    if (bad.size) errors.push(`Unknown map characters: ${[...bad].map(c => `"${c}"`).join(', ')}.`);

    let edgeOk = true;
    for (let x = 0; x < w; x++) if (map[0][x] !== '#' || map[h - 1][x] !== '#') edgeOk = false;
    for (let y = 0; y < h; y++) if (map[y][0] !== '#' || map[y][w - 1] !== '#') edgeOk = false;
    if (!edgeOk) errors.push('The outer edge of the map must be all walls (#).');

    const count = {};
    const cells = {};
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = map[y][x];
      count[ch] = (count[ch] || 0) + 1;
      (cells[ch] = cells[ch] || []).push({ x, y });
    }
    for (const ch in ONE_OF_EACH) {
      const n = count[ch] || 0;
      if (n !== 1) errors.push(n === 0 ? `Missing the ${ONE_OF_EACH[ch]}.` : `There are ${n} of the ${ONE_OF_EACH[ch]}; there must be exactly one.`);
    }
    for (const p of 'abcd') {
      const D = p.toUpperCase();
      if (count[p] && !count[D]) errors.push(`Plate ${p} has no door ${D}.`);
      if (count[D] && !count[p]) errors.push(`Door ${D} has no plate ${p}.`);
      if (count[D]) {
        const cs = cells[D];
        const x0 = cs[0].x;
        const ys = cs.map(c => c.y).sort((a, b) => a - b);
        const straight = cs.every(c => c.x === x0) && ys.every((y, i) => i === 0 || y === ys[i - 1] + 1);
        if (!straight) errors.push(`Door ${D} must be one straight vertical run of ${D} tiles.`);
      }
    }
    return { ok: errors.length === 0, errors };
  }

  /* Soft hints for the editor: things that are allowed but are often mistakes. */
  function hints(map) {
    const out = [];
    if (!Array.isArray(map) || !map.length) return out;
    const h = map.length, w = map[0].length;
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? '#' : map[y][x];
    const solid = (x, y) => at(x, y) === '#';
    const seen = new Set();
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      if (solid(x, y)) continue;
      for (const g of [1, -1]) {                   // 1 = Black (floor below), -1 = White (ceiling above)
        if (!solid(x, y + g)) continue;
        for (const dir of [-1, 1]) {
          const nx = x + dir;
          if (nx < 1 || nx > w - 2) continue;
          let k = 0;
          while (solid(nx, y - g * k) && k < 6) k++;
          if ((k === 3 || k === 4) && !solid(nx, y - g * k)) {
            const key = `${g}:${nx}:${y - g * k}`;
            if (!seen.has(key)) {
              seen.add(key);
              out.push(`${g > 0 ? 'Black' : 'White'} meets a ${k}-tile step at column ${nx + 1}: too high to jump without a crate.`);
            }
          }
        }
      }
    }
    for (const D of 'ABCD') {
      const n = map.join('').split(D).length - 1;
      if (n && n < 3) out.push(`Door ${D} is only ${n} tile${n > 1 ? 's' : ''} tall; a player may jump over it.`);
    }
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const ch = map[y][x];
      if ((ch === 'K' || ch === 'W') && solid(x - 1, y) && solid(x + 1, y)) out.push(`The ${ch === 'K' ? 'black' : 'white'} crate at column ${x + 1}, row ${y + 1} is boxed in and can't be pushed.`);
      if (ch === '1' && !solid(x, y + 1)) out.push('Black starts in the air; it will fall at the start.');
      if (ch === '2' && !solid(x, y - 1)) out.push('White starts in the air; it will fall upward at the start.');
    }
    return out;
  }

  /* The canonical file text: one map row per line, so diffs read like the level. */
  function formatLevelJSON(def) {
    const head = { format: FORMAT, version: VERSION, id: def.id, name: def.name };
    if (def.author) head.author = def.author;
    if (def.notes) head.notes = def.notes;
    const lines = Object.entries(head).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
    const rows = def.map.map((r, i) => `    ${JSON.stringify(r)}${i < def.map.length - 1 ? ',' : ''}`);
    return `{\n${lines.join('\n')}\n  "map": [\n${rows.join('\n')}\n  ]\n}\n`;
  }

  return { FORMAT, VERSION, MIN_SIZE, MAX_SIZE, LEGEND, slugify, checkLevel, hints, formatLevelJSON };
});
