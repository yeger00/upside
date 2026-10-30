// Checks every file in levels/ with the shared checker, and that levels/index.json
// lists each level file exactly once. No browser needed.
const fs = require('fs'), path = require('path');
const F = require('../level-format.js');

const dir = path.resolve(__dirname, '..', 'levels');
const problems = [];
let order = [];
try { order = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')); }
catch (e) { problems.push(`levels/index.json: ${e.message}`); }
if (!Array.isArray(order)) { problems.push('levels/index.json must be a list of ids'); order = []; }

const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json');
for (const f of files) {
  const id = f.replace(/\.json$/, '');
  const text = fs.readFileSync(path.join(dir, f), 'utf8');
  let def;
  try { def = JSON.parse(text); } catch (e) { problems.push(`${f}: not valid JSON (${e.message})`); continue; }
  const r = F.checkLevel(def, { fileId: id });
  for (const err of r.errors) problems.push(`${f}: ${err}`);
  if (r.ok && text !== F.formatLevelJSON(def)) problems.push(`${f}: not in the standard layout (one map row per line); reformat it with formatLevelJSON`);
  const n = order.filter(x => x === id).length;
  if (n !== 1) problems.push(`${f}: listed ${n} times in levels/index.json (must be exactly once)`);
}
for (const id of order) if (!files.includes(`${id}.json`)) problems.push(`levels/index.json lists "${id}" but levels/${id}.json doesn't exist`);

if (problems.length) { console.error('FAILED level file checks:\n  ' + problems.join('\n  ')); process.exitCode = 1; }
else console.log(`All ${files.length} level files passed`);
