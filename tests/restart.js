const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', 'index.html'));
  const out = await page.evaluate(async () => {
    const U = window.UPSIDE, S = U.S, c = document.getElementById('c');
    const W = innerWidth, H = innerHeight, gw = Math.min(W, Math.round(H * 0.62)), gx = (W - gw) / 2;
    const bandH = Math.round(Math.max(78, Math.min(170, H * 0.17))), mapH = H - 2 * bandH;
    const x = gx + gw - 24, y = bandH + mapH / 2;
    const ev = (type, id, cx, cy) => c.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: cx, clientY: cy, bubbles: true, cancelable: true }));
    const wait = ms => new Promise(r => setTimeout(r, ms));
    U.load(1); U.manual = false;
    // move Black off spawn
    ev('pointerdown', 5, gx + gw * 0.45, H - bandH / 2); await wait(600); ev('pointerup', 5, 0, 0);
    const moved = S.p1.x.toFixed(2);
    // only Black holds restart -> nothing happens
    ev('pointerdown', 1, x, y + 46); await wait(1400);
    const afterOne = S.p1.x.toFixed(2);
    // White joins -> restart
    ev('pointerdown', 2, x, y - 46); await wait(1400);
    ev('pointerup', 1, 0, 0); ev('pointerup', 2, 0, 0);
    const afterBoth = S.p1.x.toFixed(2);
    // tapping volume toggles mute, does not restart
    return { spawnX: (S.L.spawns[1].x + 0.15).toFixed(2), moved, afterOne, afterBoth };
  });
  console.log(JSON.stringify(out), 'errors:', errors);
  const ok = out.afterOne !== out.spawnX && out.afterBoth === out.spawnX && !errors.length;
  if (!ok) { console.error('FAILED: restart must need both players'); process.exitCode = 1; } else console.log('Restart check passed');
  await page.evaluate(() => { const U = window.UPSIDE; U.manual = true; U.load(3); U.S.banner = 0; });
  await page.waitForTimeout(150);
  await page.screenshot({ path: require('path').join(__dirname, 'restart.png') });
  await browser.close();
})();
