// Drives the level editor like a user: opens a built-in level and checks the copied
// file is identical, paints a new level with the mouse, tests undo/redo, copies it,
// and play-tests it to a win in the real game.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const { startServer } = require('./server');
const F = require('../level-format.js');

(async () => {
  const server = await startServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: server.url.replace(/\/$/, '') });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  await page.goto(server.url + 'editor.html');
  await page.waitForFunction(() => window.EDITOR && document.querySelector('#startFrom option[value="the-gate"]'));
  const fails = [];
  const expect = (ok, msg) => { if (!ok) fails.push(msg); };

  // 1) round trip: a built-in level copies out byte-for-byte as its file
  await page.selectOption('#startFrom', 'the-gate');
  await page.click('#loadBtn');
  const gateOut = await page.inputValue('#out');
  expect(gateOut === fs.readFileSync(path.join(__dirname, '..', 'levels', 'the-gate.json'), 'utf8'), 'the-gate: copied file differs from levels/the-gate.json');

  // 2) new 12x10 level painted with the mouse
  await page.selectOption('#newW', '12');
  await page.selectOption('#newH', '10');
  await page.click('#newBtn');
  const click = async (tool, x, y) => {
    await page.click(`.tool[data-tool="${tool}"]`);
    const c = await page.evaluate(([x, y]) => window.EDITOR.cellCenter(x, y), [x, y]);
    await page.mouse.click(c.x, c.y);
  };
  await click('2', 1, 1); await click('Y', 10, 1);
  await click('1', 1, 8); await click('X', 10, 8);
  // drag a wall from column 4 to 9 on row 6
  await page.click('.tool[data-tool="#"]');
  const a = await page.evaluate(() => window.EDITOR.cellCenter(3, 5)), b = await page.evaluate(() => window.EDITOR.cellCenter(8, 5));
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 12 }); await page.mouse.up();
  // the outer wall is locked
  await click(' ', 0, 4);
  await page.fill('#name', 'Test walk');
  const expected = ['############', '#2        Y#', '#          #', '#          #', '#          #', '#  ######  #', '#          #', '#          #', '#1        X#', '############'];
  let def = JSON.parse(await page.inputValue('#out') || 'null');
  expect(def && def.id === 'test-walk', 'id should be filled in from the name');
  expect(def && JSON.stringify(def.map) === JSON.stringify(expected), 'painted map differs: ' + JSON.stringify(def && def.map));
  expect(def && F.checkLevel(def).ok, 'painted level should pass the shared check');

  // 3) undo removes the dragged wall, redo puts it back
  await page.evaluate(() => document.activeElement.blur());   // shortcuts are ignored while typing in a field
  await page.keyboard.press('Control+z');
  let rows = await page.evaluate(() => window.EDITOR.levelDef().map);
  expect(rows[5] === '#          #', 'undo should remove the dragged wall, got ' + rows[5]);
  await page.keyboard.press('Control+Shift+z');
  rows = await page.evaluate(() => window.EDITOR.levelDef().map);
  expect(rows[5] === '#  ######  #', 'redo should restore the wall, got ' + rows[5]);

  // 4) Copy level puts exactly the shown file on the clipboard
  await page.click('#copyBtn');
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  const shown = await page.inputValue('#out');
  expect(clip === shown && clip === F.formatLevelJSON(JSON.parse(shown)), 'clipboard should hold the level file');

  // 5) an invalid level can't be copied or play-tested
  await click(' ', 10, 8);                        // erase Black's exit
  expect(await page.isDisabled('#copyBtn') && await page.isDisabled('#playBtn'), 'copy/play-test should be disabled when the level has problems');
  expect((await page.textContent('#problems')).includes('Missing the Black exit'), 'problems should explain the missing exit');
  await page.keyboard.press('Control+z');

  // 6) play-test in the real game and win
  await page.click('#playBtn');
  const frame = page.frameLocator('#game');
  await page.waitForFunction(() => {
    const w = document.getElementById('game').contentWindow;
    return w && w.UPSIDE && w.UPSIDE.S.state === 'play' && w.UPSIDE.S.L && w.UPSIDE.S.L.name === 'Test walk';
  });
  const won = await page.evaluate(() => {
    const U = document.getElementById('game').contentWindow.UPSIDE, S = U.S;
    U.manual = true;
    const I = m => ({ move: m, jumpHeld: false, jumpPressed: false });
    for (let i = 0; i < 600 && S.state === 'play'; i++) U.step(I(1), I(-1));   // both walk screen-right
    return S.state === 'won';
  });
  expect(won, 'play-test: both players should reach their exits');
  await page.click('#backBtn');
  expect(!(await page.isVisible('#playtest')), 'back button should close the play-test');
  await page.screenshot({ path: path.join(__dirname, 'editor.png') });

  if (errors.length) fails.push('page errors: ' + errors.join('; '));
  if (fails.length) { console.error('FAILED editor checks:\n  ' + fails.join('\n  ')); process.exitCode = 1; }
  else console.log('Editor checks passed');
  await browser.close();
  server.close();
})();
