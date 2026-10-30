const { chromium } = require('playwright');
const { startServer } = require('./server');
(async () => {
  const server = await startServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(server.url + 'index.html');
  await page.waitForFunction(() => window.UPSIDE && window.UPSIDE.ready && window.UPSIDE.LEVELS.length > 0);
  await page.waitForTimeout(300);
  const result = await page.evaluate(() => {
    const U = window.UPSIDE; U.manual = true; const S = U.S;
    const I = (move = 0, press = false) => ({ move, jumpHeld: true, jumpPressed: press });
    const cx = p => p.x + p.w / 2, bot = p => p.y + p.h, top = p => p.y;
    const near = (a, b) => Math.abs(a - b) < 0.06;
    const loc = (p, d) => d * p.g;
    const toward = (p, tx) => { const d = tx - cx(p); return Math.abs(d) < 0.1 ? 0 : Math.sign(d) * p.g; };
    const run = (n, f) => { for (let i = 0; i < n && S.state === 'play'; i++) { const [a, b] = f(i); U.step(a, b); } };
    const won = () => S.state === 'won';
    const pops = () => S.events.filter(e => e.startsWith('pop')).length;
    const out = {};
    const climber = (p, steps) => { let dir = 0; return () => {
      const s = p.g > 0 ? bot(p) : top(p);
      if (p.grounded) for (const [v, tx, d] of steps) if (near(s, v)) {
        if (d === 0) return I(toward(p, tx));
        if (Math.abs(cx(p) - tx) > 0.12) return I(toward(p, tx));
        dir = d; return I(loc(p, d), true); }
      return I(loc(p, dir)); }; };
    const floatAcross = () => { let phase = 0; run(1500, () => {
      const p1 = S.p1, p2 = S.p2, locked = p1.on === p2 && p2.on === p1;
      if (phase === 0 && locked) phase = 1;
      if (phase === 1 && cx(p1) > 13.3) { phase = 2; return [I(0, true), I()]; }
      if (phase === 2) return [I(toward(p1, 14.5)), I(toward(p2, 14.5))];
      return [I(1), I(-1)];
    }); };

    // 1
    U.loadById('hello-other-side'); run(120, () => [I(toward(S.p1, 4.5)), I()]); run(300, () => [I(toward(S.p1, 4.5)), I(toward(S.p2, 10.5))]);
    run(300, () => [I(toward(S.p1, 10.5)), I(toward(S.p2, 10.5))]); out['1 Hello'] = won();
    // 2
    U.loadById('relay'); run(120, () => [I(toward(S.p1, 3.5)), I()]); run(300, () => [I(toward(S.p1, 3.5)), I(toward(S.p2, 9.5))]);
    run(300, () => [I(toward(S.p1, 10.5)), I(toward(S.p2, 9.5))]); run(200, () => [I(toward(S.p1, 10.5)), I(toward(S.p2, 10.5))]); out['2 Relay'] = won();
    // 3
    U.loadById('special-delivery'); run(120, () => [I(toward(S.p1, 2.5)), I()]); run(420, () => [I(toward(S.p1, 2.5)), I(toward(S.p2, 11.9))]);
    const bp3 = () => { const p = S.p1; let m = 1, j = false;
      if (p.grounded && near(bot(p), 11) && cx(p) > 3.1 && cx(p) < 3.8) j = true;
      if (p.grounded && p.blockedX) j = true;
      if (p.grounded && near(bot(p), 4) && cx(p) > 9.3) j = true;
      if (cx(p) > 13.3) m = 0; return I(m, j); };
    run(900, () => [bp3(), I(toward(S.p2, 8.5))]); out['3 Special delivery'] = won();

    // 4 Stepping stones
    U.loadById('stepping-stones'); S.events.length = 0;
    const bp4 = () => { const p = S.p1; let j = false, m = 1;
      if (p.grounded && near(bot(p), 11) && cx(p) < 3 && cx(p) > 1.8) j = true;
      if (p.grounded && near(bot(p), 9) && cx(p) > 4.45 && cx(p) < 5.2) j = true;
      if (p.grounded && near(bot(p), 9) && cx(p) > 8.45) j = true;
      if (near(bot(p), 11) && cx(p) > 9.9) m = toward(p, 10.8);
      return I(m, j); };
    const wp4 = () => { const p = S.p2; let j = false, m = loc(p, 1);
      if (p.grounded && near(top(p), 1) && cx(p) < 3 && cx(p) > 1.8) j = true;
      if (p.grounded && near(top(p), 3) && cx(p) > 5.45 && cx(p) < 6.2) j = true;
      if (near(top(p), 1) && cx(p) > 9.9) m = toward(p, 11.5);
      return I(m, j); };
    run(400, () => [bp4(), I()]);
    out['4 stones: Black waits at door'] = near(bot(S.p1), 11) && cx(S.p1) > 10 && !S.L.doors[0].open;
    run(400, () => [bp4(), wp4()]);
    out['4 stones: White on button, door open'] = S.L.doors[0].open;
    run(300, () => [I(toward(S.p1, 13.5)), I(toward(S.p2, 11.5))]);
    run(300, () => [I(toward(S.p1, 13.5)), I(toward(S.p2, 13.5))]);
    out['4 Stepping stones'] = won(); out['4 pops'] = pops();
    U.loadById('stepping-stones'); run(400, () => [bp4(), I()]); run(300, () => [I(toward(S.p1, 13.5)), I()]); out['4 solo Black reaches exit'] = S.p1.atExit;

    // 5 a: two-way relay; White must carry the crate back to plate c
    U.loadById('a'); S.events.length = 0;
    run(150, () => [I(toward(S.p1, 6.5)), I()]);                                   // Black on b: door B opens
    run(200, () => [I(toward(S.p1, 6.5)), I(toward(S.p2, 5.5))]);                  // White through B
    run(150, () => [I(toward(S.p1, 4.5)), I(toward(S.p2, 5.5))]);                  // Black on a: door A opens
    run(150, () => [I(toward(S.p1, 4.5)), I(toward(S.p2, 7.5))]);                  // White through A
    run(8, () => [I(toward(S.p1, 4.5)), I(0, true)]);                              // White jumps straight up first,
    run(120, () => [I(toward(S.p1, 4.5)), I(-1)]);                                 // then over the crate (not pushing it)
    run(200, () => [I(toward(S.p1, 4.5)), I(toward(S.p2, 3.31))]);                 // push the crate back through A
    run(150, () => [I(toward(S.p1, 6.5)), I(toward(S.p2, 3.31))]);                 // and through B, stopping on plate c
    out['5 a: crate on plate c'] = S.L.plates.find(pl => pl.id === 'c').pressed;
    run(200, () => [I(toward(S.p1, 6.5)), I(toward(S.p2, 5.5))]);                  // White back through B
    run(150, () => [I(toward(S.p1, 4.5)), I(toward(S.p2, 5.5))]);                  // and through A
    run(250, () => [I(toward(S.p1, 4.5)), I(toward(S.p2, 9.5))]);                  // White holds plate d: door D opens
    run(300, () => [I(toward(S.p1, 10.5)), I(toward(S.p2, 9.5))]);                 // Black through D and C to X
    run(200, () => [I(toward(S.p1, 10.5)), I(toward(S.p2, 10.5))]);                // White to Y
    out['5 a'] = won(); out['5 pops'] = pops();
    U.loadById('a'); run(600, () => [I(toward(S.p1, 10.5)), I(toward(S.p2, 10.5))]);
    out['5 a: no teamwork'] = won() || S.p1.atExit || S.p2.atExit;

    // 6 Meet in the middle
    U.loadById('meet-in-the-middle'); { let ph = 0; run(1200, () => { const p1 = S.p1, p2 = S.p2, l = p1.on === p2 && p2.on === p1;
      if (ph === 0 && l) ph = 1; if (ph === 1 && cx(p1) > 11.8) { ph = 2; return [I(0, true), I()]; }
      if (ph === 2) return [I(toward(p1, 12.5)), I(toward(p2, 12.5))]; return [I(1), I(-1)]; }); }
    out['6 Meet in the middle'] = won();

    // 7 Your turn to climb (rotated level 3)
    U.loadById('your-turn-to-climb'); S.events.length = 0;
    run(150, () => [I(), I(toward(S.p2, 12.5))]);
    run(500, () => [I(toward(S.p1, 3.1)), I(toward(S.p2, 12.5))]);
    out['7 crate x'] = S.crates[0].x.toFixed(2);
    run(200, () => [I(toward(S.p1, 6.5)), I(toward(S.p2, 12.5))]);
    const wp6 = () => { const p = S.p2; let wm = -1, j = false;
      if (p.grounded && near(top(p), 1) && cx(p) > 11.2 && cx(p) < 11.9) j = true;
      if (p.grounded && p.blockedX) j = true;
      if (p.grounded && near(top(p), 8) && cx(p) < 5.7) j = true;
      if (cx(p) < 1.7) wm = 0; return I(loc(p, wm), j); };
    run(900, () => [I(toward(S.p1, 6.5)), wp6()]);
    out['7 Your turn to climb'] = won(); out['7 paints'] = S.events.filter(e => e === 'paint').length;
    U.loadById('your-turn-to-climb'); run(900, () => [I(toward(S.p1, 6.5)), wp6()]); out['7 solo White (no crate)'] = won();

    // 8 The ladder
    const blackSteps = [[12, 3.5, -1], [10, 2.55, 1], [8, 4.45, -1], [6, 2.55, 1], [4, 5.35, 0]];
    const whiteSteps = [[1, 3.5, -1], [3, 2.55, 1], [5, 4.45, -1], [7, 2.55, 1], [9, 5.35, 0]];
    U.loadById('the-ladder'); S.events.length = 0;
    { const cb = climber(S.p1, blackSteps), cw = climber(S.p2, whiteSteps); run(900, () => [cb(), cw()]); }
    out['8 crossed after climb'] = near(bot(S.p1), 4) && near(top(S.p2), 9);
    run(120, () => [I(toward(S.p1, 5.35)), I(toward(S.p2, 5.35))]);
    floatAcross(); out['8 The ladder'] = won(); out['8 pops'] = pops();
    U.loadById('the-ladder'); S.events.length = 0; { const cb = climber(S.p1, blackSteps); run(600, () => [cb(), I()]); }
    run(300, () => [I(1), I()]); out['8 solo Black pops'] = pops();

    // 9 Busy doors
    U.loadById('busy-doors');
    run(120, () => [I(toward(S.p1, 11.5)), I()]);
    run(500, () => [I(toward(S.p1, 11.5)), I(toward(S.p2, 10.5))]);
    out['9 W in socket'] = S.crates.find(c => c.owner === 2).y.toFixed(2);
    run(200, () => [I(toward(S.p1, 11.5)), I(toward(S.p2, 8.5))]);
    run(600, () => [I(toward(S.p1, 1.5)), I(toward(S.p2, 8.5))]);
    out['9 K in socket'] = S.crates.find(c => c.owner === 1).y.toFixed(2);
    run(300, () => [I(toward(S.p1, 1.5)), I(toward(S.p2, 12.5))]);
    out['9 Busy doors'] = won();
    U.loadById('busy-doors'); run(800, () => [I(toward(S.p1, 1.5)), I(toward(S.p2, 12.5))]); out['9 no teamwork'] = won();

    // 10 The gate
    U.loadById('the-gate'); S.events.length = 0;
    run(250, () => [I(toward(S.p1, 1.0)), I(toward(S.p2, 1.0))]);
    out['10 gate open'] = S.L.doors.every(d => d.open);
    run(150, () => [I(toward(S.p1, 3.5)), I(toward(S.p2, 3.5))]);
    { const cb = climber(S.p1, blackSteps), cw = climber(S.p2, whiteSteps); run(900, () => [cb(), cw()]); }
    run(120, () => [I(toward(S.p1, 5.35)), I(toward(S.p2, 5.35))]);
    floatAcross(); out['10 The gate'] = won(); out['10 pops'] = pops();
    // 10 without crates: pair must be stopped by the closed gate
    U.loadById('the-gate'); run(60, () => [I(), I()]);
    { const cb = climber(S.p1, blackSteps), cw = climber(S.p2, whiteSteps); run(900, () => [cb(), cw()]); }
    run(120, () => [I(toward(S.p1, 5.35)), I(toward(S.p2, 5.35))]);
    floatAcross(); out['10 gate closed blocks'] = !won() && cx(S.p1) < 9;
    return out;
  });
  console.log(JSON.stringify(result, null, 1));
  await page.evaluate(() => { const U = window.UPSIDE; U.manual = true; U.loadById('the-gate'); U.S.banner = 0; });
  await page.waitForTimeout(150);
  await page.screenshot({ path: require('path').join(__dirname, 'gate.png') });
  console.log('errors:', errors);
  const mustPass = ['1 Hello', '2 Relay', '3 Special delivery', '4 Stepping stones', '5 a', '5 a: crate on plate c', '6 Meet in the middle',
    '7 Your turn to climb', '8 The ladder', '9 Busy doors', '10 The gate',
    '4 stones: Black waits at door', '4 stones: White on button, door open', '8 crossed after climb',
    '10 gate open', '10 gate closed blocks'];
  const mustFail = ['4 solo Black reaches exit', '5 a: no teamwork', '7 solo White (no crate)', '9 no teamwork'];
  const bad = [...mustPass.filter(k => result[k] !== true), ...mustFail.filter(k => result[k] !== false),
    ...(errors.length ? ['page errors'] : [])];
  if (result['8 solo Black pops'] < 1) bad.push('8 solo Black should hit thorns');
  if (bad.length) { console.error('FAILED:', bad); process.exitCode = 1; } else console.log('All level checks passed');
  await browser.close();
  server.close();
})();
