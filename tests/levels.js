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
    run(900, () => [bp3(), I(toward(S.p2, 8.5))]); out['4 Special delivery'] = won();

    // 5 Stepping stones
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
    out['5 stones: Black waits at door'] = near(bot(S.p1), 11) && cx(S.p1) > 10 && !S.L.doors[0].open;
    run(400, () => [bp4(), wp4()]);
    out['5 stones: White on button, door open'] = S.L.doors[0].open;
    run(300, () => [I(toward(S.p1, 13.5)), I(toward(S.p2, 11.5))]);
    run(300, () => [I(toward(S.p1, 13.5)), I(toward(S.p2, 13.5))]);
    out['5 Stepping stones'] = won(); out['5 pops'] = pops();
    U.loadById('stepping-stones'); run(400, () => [bp4(), I()]); run(300, () => [I(toward(S.p1, 13.5)), I()]); out['5 solo Black reaches exit'] = S.p1.atExit;

    // 7 Round trip: two-way relay; White must carry the crate back to plate c
    U.loadById('round-trip'); S.events.length = 0;
    run(150, () => [I(toward(S.p1, 6.5)), I()]);                                   // Black on b: door B opens
    run(200, () => [I(toward(S.p1, 6.5)), I(toward(S.p2, 5.5))]);                  // White through B
    run(150, () => [I(toward(S.p1, 4.5)), I(toward(S.p2, 5.5))]);                  // Black on a: door A opens
    run(150, () => [I(toward(S.p1, 4.5)), I(toward(S.p2, 7.5))]);                  // White through A
    run(8, () => [I(toward(S.p1, 4.5)), I(0, true)]);                              // White jumps straight up first,
    run(120, () => [I(toward(S.p1, 4.5)), I(-1)]);                                 // then over the crate (not pushing it)
    run(200, () => [I(toward(S.p1, 4.5)), I(toward(S.p2, 3.31))]);                 // push the crate back through A
    run(150, () => [I(toward(S.p1, 6.5)), I(toward(S.p2, 3.31))]);                 // and through B, stopping on plate c
    out['7 Round trip: crate on plate c'] = S.L.plates.find(pl => pl.id === 'c').pressed;
    run(200, () => [I(toward(S.p1, 6.5)), I(toward(S.p2, 5.5))]);                  // White back through B
    run(150, () => [I(toward(S.p1, 4.5)), I(toward(S.p2, 5.5))]);                  // and through A
    run(250, () => [I(toward(S.p1, 4.5)), I(toward(S.p2, 9.5))]);                  // White holds plate d: door D opens
    run(300, () => [I(toward(S.p1, 10.5)), I(toward(S.p2, 9.5))]);                 // Black through D and C to X
    run(200, () => [I(toward(S.p1, 10.5)), I(toward(S.p2, 10.5))]);                // White to Y
    out['7 Round trip'] = won(); out['7 pops'] = pops();
    U.loadById('round-trip'); run(600, () => [I(toward(S.p1, 10.5)), I(toward(S.p2, 10.5))]);
    out['7 Round trip: no teamwork'] = won() || S.p1.atExit || S.p2.atExit;

    // 8 Swap places: jump past each other so Black is on top, lock feet to feet, walk to the stacked exits
    U.loadById('swap-places'); S.events.length = 0;
    run(120, () => [I(toward(S.p1, 2.9)), I(toward(S.p2, 1.9))]);              // Black mid-ledge, White a step left
    { let f = 0; run(90, () => { const o = [I(f < 12 ? 1 : 0, f === 0), I(-1, f === 0)]; f++; return o; }); }   // jump together
    out['8 Swap places: locked'] = S.p1.on === S.p2 && S.p2.on === S.p1;
    run(300, () => [I(1), I(-1)]);                                             // walk right together
    out['8 Swap places'] = won(); out['8 pops'] = pops();
    U.loadById('swap-places'); run(400, () => [I(1), I(-1)]);                 // just walking off the ledges separates them
    out['8 Swap places: no teamwork'] = won();

    // 9 Meet in the middle
    U.loadById('meet-in-the-middle'); { let ph = 0; run(1200, () => { const p1 = S.p1, p2 = S.p2, l = p1.on === p2 && p2.on === p1;
      if (ph === 0 && l) ph = 1; if (ph === 1 && cx(p1) > 11.8) { ph = 2; return [I(0, true), I()]; }
      if (ph === 2) return [I(toward(p1, 12.5)), I(toward(p2, 12.5))]; return [I(1), I(-1)]; }); }
    out['9 Meet in the middle'] = won();

    // 11 Your turn to climb (rotated level 3)
    U.loadById('your-turn-to-climb'); S.events.length = 0;
    run(150, () => [I(), I(toward(S.p2, 12.5))]);
    run(500, () => [I(toward(S.p1, 3.1)), I(toward(S.p2, 12.5))]);
    out['11 crate x'] = S.crates[0].x.toFixed(2);
    run(200, () => [I(toward(S.p1, 6.5)), I(toward(S.p2, 12.5))]);
    const wp6 = () => { const p = S.p2; let wm = -1, j = false;
      if (p.grounded && near(top(p), 1) && cx(p) > 11.2 && cx(p) < 11.9) j = true;
      if (p.grounded && p.blockedX) j = true;
      if (p.grounded && near(top(p), 8) && cx(p) < 5.7) j = true;
      if (cx(p) < 1.7) wm = 0; return I(loc(p, wm), j); };
    run(900, () => [I(toward(S.p1, 6.5)), wp6()]);
    out['11 Your turn to climb'] = won(); out['11 paints'] = S.events.filter(e => e === 'paint').length;
    U.loadById('your-turn-to-climb'); run(900, () => [I(toward(S.p1, 6.5)), wp6()]); out['11 solo White (no crate)'] = won();

    // 12 The ladder
    const blackSteps = [[12, 3.5, -1], [10, 2.55, 1], [8, 4.45, -1], [6, 2.55, 1], [4, 5.35, 0]];
    const whiteSteps = [[1, 3.5, -1], [3, 2.55, 1], [5, 4.45, -1], [7, 2.55, 1], [9, 5.35, 0]];
    U.loadById('the-ladder'); S.events.length = 0;
    { const cb = climber(S.p1, blackSteps), cw = climber(S.p2, whiteSteps); run(900, () => [cb(), cw()]); }
    out['12 crossed after climb'] = near(bot(S.p1), 4) && near(top(S.p2), 9);
    run(120, () => [I(toward(S.p1, 5.35)), I(toward(S.p2, 5.35))]);
    floatAcross(); out['12 The ladder'] = won(); out['12 pops'] = pops();
    U.loadById('the-ladder'); S.events.length = 0; { const cb = climber(S.p1, blackSteps); run(600, () => [cb(), I()]); }
    run(300, () => [I(1), I()]); out['12 solo Black pops'] = pops();

    // 13 Busy doors
    U.loadById('busy-doors');
    run(120, () => [I(toward(S.p1, 11.5)), I()]);
    run(500, () => [I(toward(S.p1, 11.5)), I(toward(S.p2, 10.5))]);
    out['13 W in socket'] = S.crates.find(c => c.owner === 2).y.toFixed(2);
    run(200, () => [I(toward(S.p1, 11.5)), I(toward(S.p2, 8.5))]);
    run(600, () => [I(toward(S.p1, 1.5)), I(toward(S.p2, 8.5))]);
    out['13 K in socket'] = S.crates.find(c => c.owner === 1).y.toFixed(2);
    run(300, () => [I(toward(S.p1, 1.5)), I(toward(S.p2, 12.5))]);
    out['13 Busy doors'] = won();
    U.loadById('busy-doors'); run(800, () => [I(toward(S.p1, 1.5)), I(toward(S.p2, 12.5))]); out['13 no teamwork'] = won();

    // 14 The gate
    U.loadById('the-gate'); S.events.length = 0;
    run(250, () => [I(toward(S.p1, 1.0)), I(toward(S.p2, 1.0))]);
    out['14 gate open'] = S.L.doors.every(d => d.open);
    run(150, () => [I(toward(S.p1, 3.5)), I(toward(S.p2, 3.5))]);
    { const cb = climber(S.p1, blackSteps), cw = climber(S.p2, whiteSteps); run(900, () => [cb(), cw()]); }
    run(120, () => [I(toward(S.p1, 5.35)), I(toward(S.p2, 5.35))]);
    floatAcross(); out['14 The gate'] = won(); out['14 pops'] = pops();
    // 14 without crates: pair must be stopped by the closed gate
    U.loadById('the-gate'); run(60, () => [I(), I()]);
    { const cb = climber(S.p1, blackSteps), cw = climber(S.p2, whiteSteps); run(900, () => [cb(), cw()]); }
    run(120, () => [I(toward(S.p1, 5.35)), I(toward(S.p2, 5.35))]);
    floatAcross(); out['14 gate closed blocks'] = !won() && cx(S.p1) < 9;

    // 15 The long way home: the white crate goes down onto the top block, Black pushes it left along the top,
    // White jumps onto it so it rises to the safe ceiling, then pushes it onto plate a
    { U.loadById('the-long-way-home'); S.events.length = 0;
      const idle = I(), W = () => S.crates[0];
      const route = (p, steps, n = 600) => { let dir = 0; run(n, () => {
        const sv = p.g > 0 ? bot(p) : top(p); let inp = I(loc(p, dir));
        if (p.grounded) for (const [v, x, d] of steps) if (near(sv, v)) {
          if (d === 0 || Math.abs(cx(p) - x) > 0.1) inp = I(toward(p, x)); else { dir = d; inp = I(loc(p, d), true); }
        }
        return p === S.p1 ? [inp, idle] : [idle, inp]; }); };
      const hop = (p, x, dir, n) => { let t = 0; return () => {
        if (t > 0) { t--; return I(loc(p, dir)); }
        if (Math.abs(cx(p) - x) > 0.1) return I(toward(p, x));
        t = n; return I(loc(p, dir), true); }; };
      // White: jump the thorns, hop over the crate, push it back to the very edge of the thorns
      { const h = hop(S.p2, 6.3, 1, 40); run(90, () => [idle, h()]); }
      run(60, () => [idle, I(toward(S.p2, 10.2))]);
      run(8, () => [idle, I(0, true)]); run(70, () => [idle, I(loc(S.p2, 1))]);
      run(200, () => [idle, W().x > 8.0 ? I(loc(S.p2, -1)) : I(0)]);
      // Black climbs to the top block and bumps the crate down onto it, steps to its right and pushes it left
      route(S.p1, [[13, 1.4, 1], [11, 3.4, 1], [10, 6.4, 1], [9, 10.3, 1], [7, 11.4, -1], [5, 8.0, 0]]);
      { let f = 0; run(60, () => [I(0, f++ === 0), idle]); }
      out['15 long way: crate dropped to Black'] = W().owner === 1;
      run(60, () => [I(toward(S.p1, 9.25)), idle]);
      run(200, () => [I(toward(S.p1, 5.91)), idle]);
      // White: running jump back over the thorns, jump down onto the crate (white again: it rises), push it onto plate a
      run(30, () => [idle, I(toward(S.p2, 9.6))]);
      { let t = -1; run(140, () => { const p = S.p2; if (t < 0 && cx(p) <= 9.5) t = 70; if (t === 70) { t--; return [idle, I(loc(p, -1), true)]; } if (t > 0) t--; return [idle, I(loc(p, -1))]; }); }
      run(80, () => [idle, I(toward(S.p2, W().x + 0.5))]);
      { let f = 0; run(60, () => [idle, I(0, f++ === 0)]); }
      run(60, () => [idle, I(toward(S.p2, W().x + 1.4))]);
      run(250, () => [idle, I(toward(S.p2, 3.31))]);
      out['15 long way: crate on plate a'] = S.L.plates.find(pl => pl.id === 'a').pressed;
      // Black down to plate c (door C opens); White over the thorns to Y; Black along the floor to X
      run(80, () => [I(toward(S.p1, 9.8)), idle]);
      run(400, () => [I(toward(S.p1, 1.4)), I(toward(S.p2, 3.31))]);
      run(120, () => [I(toward(S.p1, 2.5)), I(toward(S.p2, 3.31))]);
      { const h = hop(S.p2, 6.3, 1, 70); run(110, () => [I(toward(S.p1, 2.5)), h()]); }
      run(300, () => [I(toward(S.p1, 2.5)), I(toward(S.p2, 14.5))]);
      run(400, () => [I(toward(S.p1, 14.5)), I(toward(S.p2, 14.5))]);
      out['15 The long way home'] = won(); out['15 pops'] = pops();
      U.loadById('the-long-way-home'); run(600, () => [I(toward(S.p1, 14.5)), I(toward(S.p2, 14.5))]);
      out['15 long way: no teamwork'] = won();
      U.loadById('the-long-way-home'); run(600, () => [I(toward(S.p1, 14.5)), idle]);
      out['15 long way: Black alone reaches exit'] = S.p1.atExit;
    }
    // 16 The longer way home: same crate route as before, but Black's door is solid at floor level,
    // so Black finally climbs back to the long bar and leaves through the top of door A
    { U.loadById('the-longer-way-home'); S.events.length = 0;
      const idle = I(), W = () => S.crates[0];
      // on a surface (Black: feet y, White: head y), walk to x then jump in dir; dir 0 = stop there
      const route = (p, steps, n = 600) => { let dir = 0; run(n, () => {
        const sv = p.g > 0 ? bot(p) : top(p); let inp = I(loc(p, dir));
        if (p.grounded) for (const [v, x, d] of steps) if (near(sv, v)) {
          if (d === 0 || Math.abs(cx(p) - x) > 0.1) inp = I(toward(p, x)); else { dir = d; inp = I(loc(p, d), true); }
        }
        return p === S.p1 ? [inp, idle] : [idle, inp]; }); };
      const hop = (p, x, dir, n) => { let t = 0; return () => {
        if (t > 0) { t--; return I(loc(p, dir)); }
        if (Math.abs(cx(p) - x) > 0.1) return I(toward(p, x));
        t = n; return I(loc(p, dir), true); }; };
      // White: jump the thorns, hop over the crate, push it back to x~9
      { const h = hop(S.p2, 6.3, 1, 40); run(90, () => [idle, h()]); }
      run(60, () => [idle, I(toward(S.p2, 10.2))]);
      run(8, () => [idle, I(0, true)]); run(70, () => [idle, I(loc(S.p2, 1))]);
      run(120, () => [idle, I(toward(S.p2, 10.35))]);
      // Black climbs to the top block and bumps the crate: it turns black and drops onto bar r9
      route(S.p1, [[13, 1.4, 1], [11, 3.4, 1], [10, 6.4, 1], [9, 10.3, 1], [7, 11.4, -1], [5, 8.4, 0]]);
      { const h = hop(S.p1, 8.4, 1, 30); run(100, () => [h(), idle]); }
      out['16 longer way: crate dropped to Black'] = W().owner === 1;
      run(80, () => [I(toward(S.p1, 10.6)), idle]);
      run(200, () => [I(toward(S.p1, 8.31)), idle]);                               // push it left under block r5
      // White: running jump back over the thorns, then down: under r2, under r4, under r5
      run(60, () => [idle, I(toward(S.p2, 12.3))]);
      { let t = -1; run(140, () => { const p = S.p2;
          if (t < 0 && cx(p) <= 9.6) t = 70;
          if (t === 70) { t--; return [idle, I(loc(p, -1), true)]; }
          if (t > 0) t--;
          return [idle, I(loc(p, -1))]; }); }
      route(S.p2, [[1, 4.5, -1], [3, 3.5, 0]], 150);
      { let jumped = false; run(150, () => { const p = S.p2;                     // walk off r2, jump in the grace period
          if (!jumped && p.grounded && near(top(p), 3)) return [idle, I(loc(p, 1))];
          if (!jumped && !p.grounded) { jumped = true; return [idle, I(loc(p, -1), true)]; }
          if (jumped && p.grounded && near(top(p), 5)) return [idle, I(toward(p, 3.0))];
          return [idle, I(loc(p, -1))]; }); }
      route(S.p2, [[5, 3.6, 1], [6, 7.5, 0]], 200);
      { const h = hop(S.p2, 7.5, 0, 30); run(80, () => [idle, h()]); }            // White bumps it: white again
      run(120, () => [idle, I(toward(S.p2, 8.35))]);
      run(250, () => [idle, I(toward(S.p2, 5.0))]);                              // push it off r5; it catches on r4's corner
      run(150, () => [idle, I(toward(S.p2, 2.6))]);                              // go under r4
      run(150, () => [idle, I(toward(S.p2, 3.6))]);                              // nudge it free: it rises to the ceiling
      run(120, () => [idle, I(toward(S.p2, 4.3))]);
      run(80, () => [idle, I(toward(S.p2, 5.6))]);                               // up to the ceiling, right of the crate
      run(200, () => [idle, I(toward(S.p2, 3.31))]);                             // push it onto plate a: door A stays open
      out['16 longer way: crate on plate a'] = S.L.plates.find(pl => pl.id === 'a').pressed;
      run(400, () => [I(toward(S.p1, 1.4)), I(toward(S.p2, 3.31))]);             // Black back down to the floor
      run(120, () => [I(toward(S.p1, 2.5)), I(toward(S.p2, 3.31))]);             // Black holds plate c: door C opens
      { const h = hop(S.p2, 6.3, 1, 70); run(110, () => [I(toward(S.p1, 2.5)), h()]); }
      run(300, () => [I(toward(S.p1, 2.5)), I(toward(S.p2, 14.5))]);             // White to Y
      route(S.p1, [[13, 1.4, 1], [11, 3.4, 1], [10, 6.4, 1], [9, 12.3, 0]], 400); // Black climbs back to the long bar
      run(300, () => [I(toward(S.p1, 14.5)), I(toward(S.p2, 14.5))]);            // through the top of door A, drop to X
      out['16 The longer way home'] = won(); out['16 pops'] = pops();
      U.loadById('the-longer-way-home'); run(600, () => [I(toward(S.p1, 14.5)), I(toward(S.p2, 14.5))]);
      out['16 longer way: no teamwork'] = won();
    }

    // ---- coordination levels: each also measures its timing window (ms of slack between the two players) ----
    const locked = () => S.p1.on === S.p2 && S.p2.on === S.p1;
    const windowMs = (from, to, ok) => { let n = 0; for (let d = from; d <= to; d++) if (ok(d)) n++; return Math.round(n / 60 * 1000); };

    // 3 On three: both on their plates, then both step through together (d = frames White starts after Black)
    const onThree = d => {
      U.loadById('on-three'); S.events.length = 0;
      run(120, () => [I(toward(S.p1, 8.5)), I(toward(S.p2, 8.5))]);
      let f = 0;
      run(400, () => { const o = [f >= Math.max(0, -d) ? I(toward(S.p1, 10.5)) : I(toward(S.p1, 8.5)),
                                  f >= Math.max(0, d) ? I(toward(S.p2, 10.5)) : I(toward(S.p2, 8.5))]; f++; return o; });
      return won() && pops() === 0;
    };
    out['3 On three'] = onThree(0);
    out['3 On three: window ms'] = windowMs(-40, 40, onThree);
    out['3 On three: one at a time'] = onThree(60);

    // 6 Bonk the button: the passer pushes on the door, the partner bonks the ceiling button
    const bonk = whitePushes => {
      U.loadById('bonk-the-button'); S.events.length = 0;
      run(150, () => [I(toward(S.p1, 3.5)), whitePushes ? I(loc(S.p2, 1)) : I()]);
      let f = 0; run(40, () => [I(0, f++ === 0), whitePushes ? I(loc(S.p2, 1)) : I()]);
      run(120, () => [I(loc(S.p1, 1)), I(toward(S.p2, 8.5))]);
      f = 0; run(40, () => [I(loc(S.p1, 1)), I(0, f++ === 0)]);
      run(300, () => [I(toward(S.p1, 12.5)), I(toward(S.p2, 12.5))]);
      return won() && pops() === 0;
    };
    out['6 Bonk the button'] = bonk(true);
    out['6 Bonk: White not ready'] = bonk(false);
    U.loadById('bonk-the-button'); run(300, () => [I(toward(S.p1, 3.5)), I(loc(S.p2, 1))]);
    out['6 Bonk: standing under the button opens it'] = S.L.doors.find(x => x.id === 'a').open;

    // 10 Off-beat: White steps off d frames before Black, each stops right after the edge
    const stepOff = (p, edge, go) => go ? I(cx(p) < edge + 0.45 ? loc(p, 1) : 0) : I(0);
    const offBeat = d => {
      U.loadById('off-beat'); S.events.length = 0;
      run(120, () => [I(toward(S.p1, 3.6)), I(toward(S.p2, 3.6))]);
      let f = 0, ph = 0;
      run(150, () => { const o = [stepOff(S.p1, 4, f >= Math.max(0, d)), stepOff(S.p2, 4, f >= Math.max(0, -d))]; f++; return o; });
      if (locked()) run(900, () => { if (ph === 0 && cx(S.p1) > 13.4) { ph = 1; return [I(0, true), I()]; }
        if (ph === 1) return [I(toward(S.p1, 14.5)), I(toward(S.p2, 14.5))]; return [I(1), I(-1)]; });
      return won() && pops() === 0;
    };
    out['10 Off-beat'] = offBeat(15);
    out['10 Off-beat: window ms'] = windowMs(-10, 45, offBeat);
    out['10 Off-beat: both together'] = offBeat(0);

    // 17 All together now: On three, Off-beat, float, park over the safe patch, let go
    const finale = (dDoor, dDrop, park) => {
      U.loadById('all-together-now'); S.events.length = 0;
      run(120, () => [I(toward(S.p1, 4.5)), I(toward(S.p2, 4.5))]);
      let f = 0;
      run(150, () => { const o = [f >= Math.max(0, -dDoor) ? I(toward(S.p1, 6.6)) : I(toward(S.p1, 4.5)),
                                  f >= Math.max(0, dDoor) ? I(toward(S.p2, 6.6)) : I(toward(S.p2, 4.5))]; f++; return o; });
      f = 0; let ph = 0;
      run(150, () => { const o = [stepOff(S.p1, 7, f >= Math.max(0, dDrop)), stepOff(S.p2, 7, f >= Math.max(0, -dDrop))]; f++; return o; });
      if (locked()) run(900, () => {
        if (ph === 0 && cx(S.p1) >= park) { ph = 1; return [I(0), I(0)]; }        // both let go of the arrows
        if (ph >= 1 && ph < 8) { ph++; return [I(0), I(0)]; }
        if (ph === 8) { ph = 9; return [I(0, true), I(0)]; }                      // one presses jump: let go
        if (ph === 9) return (S.p1.grounded && S.p2.grounded) ? [I(toward(S.p1, 12.5)), I(toward(S.p2, 12.5))] : [I(0), I(0)];
        return [I(1), I(-1)]; });
      return won() && pops() === 0;
    };
    out['17 All together now'] = finale(0, 14, 12.6);
    out['17 finale: door window ms'] = windowMs(-20, 20, d => finale(d, 14, 12.6));
    out['17 finale: step-off window ms'] = windowMs(-5, 40, d => finale(0, d, 12.6));
    out['17 finale: park over thorns'] = finale(0, 14, 10.6);

    // ---- hard coordination levels (windows may be tighter: at least 150 ms) ----
    // 18 Double bonk: both jump into the partner's button at the same moment, twice (d = frames White jumps after Black)
    const doubleBonk = (d1, d2) => {
      U.loadById('double-bonk'); S.events.length = 0;
      const gate = d => { let f = 0; run(70, () => { const o = [I(loc(S.p1, 1), f === Math.max(0, -d)), I(loc(S.p2, 1), f === Math.max(0, d))]; f++; return o; }); };
      run(100, () => [I(toward(S.p1, 4.3)), I(toward(S.p2, 4.3))]); gate(d1);
      run(100, () => [I(toward(S.p1, 9.9)), I(toward(S.p2, 9.9))]); run(30, () => [I(loc(S.p1, 1)), I(loc(S.p2, 1))]); gate(d2);
      run(200, () => [I(toward(S.p1, 14.5)), I(toward(S.p2, 14.5))]);
      return won() && pops() === 0;
    };
    out['18 Double bonk'] = doubleBonk(0, 0);
    out['18 Double bonk: window ms'] = windowMs(-20, 20, d => doubleBonk(d, 0));
    out['18 Double bonk: one jumps alone'] = doubleBonk(60, 0);

    // 19 Encore / 19 Backbeat: double bonk, a long drop (who goes first matters), float, let go
    const bonkThenDrop = (id, dGate, firstSteps, dDrop) => {        // firstSteps: 'white' or 'black' steps off dDrop frames earlier
      U.loadById(id); S.events.length = 0;
      run(100, () => [I(toward(S.p1, 3.3)), I(toward(S.p2, 3.3))]);
      run(20, () => [I(loc(S.p1, 1)), I(loc(S.p2, 1))]);
      let f = 0; run(70, () => { const go = p => cx(p) > 4.9 ? toward(p, 5.6) : loc(p, 1); const o = [I(go(S.p1), f === Math.max(0, -dGate)), I(go(S.p2), f === Math.max(0, dGate))]; f++; return o; });
      run(40, () => [I(toward(S.p1, 5.6)), I(toward(S.p2, 5.6))]);
      const wFirst = firstSteps === 'white' ? dDrop : -dDrop;
      f = 0; run(150, () => { const o = [stepOff(S.p1, 6, f >= Math.max(0, wFirst)), stepOff(S.p2, 6, f >= Math.max(0, -wFirst))]; f++; return o; });
      return locked();
    };
    const encore = (dGate, dDrop, park) => {
      if (!bonkThenDrop('encore', dGate, 'white', dDrop)) return false;
      let ph = 0;
      run(900, () => {
        if (ph === 0 && cx(S.p1) >= park) { ph = 1; return [I(0), I(0)]; }
        if (ph >= 1 && ph < 8) { ph++; return [I(0), I(0)]; }
        if (ph === 8) { ph = 9; return [I(0, true), I(0)]; }
        if (ph === 9) return (S.p1.grounded && S.p2.grounded) ? [I(toward(S.p1, 11.5)), I(toward(S.p2, 11.5))] : [I(0), I(0)];
        return [I(1), I(-1)]; });
      return won() && pops() === 0;
    };
    out['19 Encore'] = encore(0, 22, 11.9);
    out['19 Encore: drop window ms'] = windowMs(-10, 60, d => encore(0, d, 11.9));
    out['19 Encore: door window ms'] = windowMs(-20, 20, d => encore(d, 22, 11.9));
    out['19 Encore: step off together'] = encore(0, 0, 11.9);
    const backbeat = (dGate, dDrop, dEnd) => {
      if (!bonkThenDrop('backbeat', dGate, 'black', dDrop)) return false;
      let ph = 0;
      run(600, () => {
        if (ph === 0 && cx(S.p1) > 12.4) ph = 1;                                      // pushed up against the far wall
        if (ph >= 1 && ph < 8) { ph++; return [I(0), I(0)]; }
        if (ph === 8) { ph = 9; return [I(0, true), I(0)]; }
        if (ph === 9) return (S.p1.grounded && S.p2.grounded) ? [I(toward(S.p1, 12.5)), I(toward(S.p2, 12.5))] : [I(0), I(0)];
        return [I(1), I(-1)]; });
      run(60, () => [I(toward(S.p1, 12.5)), I(toward(S.p2, 12.5))]);
      let f = 0;
      run(300, () => { const o = [f >= Math.max(0, -dEnd) ? I(toward(S.p1, 14.5)) : I(toward(S.p1, 12.5)),
                                  f >= Math.max(0, dEnd) ? I(toward(S.p2, 14.5)) : I(toward(S.p2, 12.5))]; f++; return o; });
      return won() && pops() === 0;
    };
    out['20 Backbeat'] = backbeat(0, 21, 0);
    out['20 Backbeat: drop window ms'] = windowMs(-10, 60, d => backbeat(0, d, 0));
    out['20 Backbeat: last doors window ms'] = windowMs(-20, 20, d => backbeat(0, 21, d));
    out['20 Backbeat: White steps off first'] = (() => { bonkThenDrop('backbeat', 0, 'white', 21); let r = false; run(300, () => [I(1), I(-1)]); return won(); })();

    // 21 Thread the needle: lock foot to foot (d = frames White steps off before Black), float to the narrow opening;
    // Black drops to its exit, White lands under the shelf, walks back off its left end and falls up behind it
    const needle = d => {
      U.loadById('thread-the-needle'); S.events.length = 0;
      run(120, () => [I(toward(S.p1, 3.6)), I(toward(S.p2, 3.6))]);
      let f = 0, ph = 0, st = 0;
      run(150, () => { const o = [stepOff(S.p1, 4, f >= Math.max(0, d)), stepOff(S.p2, 4, f >= Math.max(0, -d))]; f++; return o; });
      if (!locked()) return false;
      const whiteFinish = () => { const p = S.p2;
        if (st === 0) { if (p.grounded && top(p) > 5.5) st = 1; return I(0); }
        if (st === 1) { if (!p.grounded) { st = 2; return I(loc(p, 1)); } return I(toward(p, 8.4)); }
        if (st === 2) { if (p.grounded && top(p) < 1.5) st = 3; return I(loc(p, 1)); }
        return I(toward(p, 14.5)); };
      run(1500, () => {
        if (ph === 0 && (cx(S.p1) > 12.5 || (S.p1.blockedX && S.p2.blockedX))) { ph = 1; return [I(0, true), I(0)]; }
        if (ph === 1) return [I(toward(S.p1, 14.5)), whiteFinish()];
        return [I(1), I(-1)]; });
      return won() && pops() === 0;
    };
    out['21 Thread the needle'] = needle(1);
    out['21 Thread the needle: window ms'] = windowMs(-10, 45, needle);
    U.loadById('thread-the-needle'); S.events.length = 0;
    run(400, () => [I(toward(S.p1, 14.5)), I()]);
    out['21 Thread the needle: Black alone'] = S.p1.atExit || won();

    // ---- new tricks: 22 Pop home, 23 Hover button, 24 Stepping crates ----
    // 22 Pop home: Black can only get back to plate a by jumping into the thorns on purpose
    const popHome = withPop => {
      U.loadById('pop-home'); S.events.length = 0;
      run(150, () => [I(toward(S.p1, 4.6)), I()]);                                   // drop off the start shelf
      run(300, () => [S.crates[0].y < 11.5 ? I(toward(S.p1, 9.4)) : I(0), I()]);     // crate into the socket: door C opens
      run(250, () => [I(), I(toward(S.p2, 7.5))]);                                   // White through C, waits at door A
      if (withPop) run(220, () => [S.events.includes('pop1') ? I(toward(S.p1, 2.5)) : I(toward(S.p1, 11.5)), I(toward(S.p2, 7.5))]);
      else run(600, () => [I(toward(S.p1, 2.5), cx(S.p1) < 4.5), I(toward(S.p2, 7.5))]);
      const onA = S.L.plates.find(p => p.id === 'a').pressed;
      if (!withPop) return onA;
      run(250, () => [I(toward(S.p1, 2.5)), I(toward(S.p2, 13.5))]);                 // Black holds a; White onto plate d
      run(400, () => [(S.p1.grounded && cx(S.p1) > 10.2 && cx(S.p1) < 10.8) ? I(1, true) : I(toward(S.p1, 14.5)), I(toward(S.p2, 13.5))]);
      run(150, () => [I(toward(S.p1, 14.5)), I(toward(S.p2, 14.5))]);
      return won() && pops() === 1;
    };
    out['22 Pop home'] = popHome(true);
    out['22 Pop home: back to plate a without popping'] = popHome(false);

    // 23 Hover button: only the locked pair can press the floating plate (d = frames White steps off before Black)
    const hover = d => {
      U.loadById('hover-button'); S.events.length = 0;
      run(120, () => [I(toward(S.p1, 3.6)), I(toward(S.p2, 3.6))]);
      let f = 0, ph = 0;
      run(150, () => { const o = [stepOff(S.p1, 4, f >= Math.max(0, d)), stepOff(S.p2, 4, f >= Math.max(0, -d))]; f++; return o; });
      if (locked()) run(900, () => {
        if (ph === 0 && (cx(S.p1) > 12.9 || S.p1.blockedX)) { ph = 1; return [I(0, true), I(0)]; }
        if (ph === 1) {
          if (!(S.p1.grounded && S.p2.grounded)) return [I(0), I(0)];
          const onDoor = bot(S.p1) < 12, b = cx(S.p1);                              // landed on top of door C: hop down to its left
          return [I(onDoor && b > 12.4 ? toward(S.p1, 12.0) : toward(S.p1, 14.5), onDoor && b <= 12.4 && b > 12.0), I(toward(S.p2, 14.5))];
        }
        return [I(1), I(-1)]; });
      return won() && pops() === 0;
    };
    out['23 Hover button'] = hover(22);
    out['23 Hover button: window ms'] = windowMs(-10, 45, hover);
    out['23 Hover button: step off together'] = hover(0);
    const soloPress = who => {                                                       // one player alone, a running jump off its ledge
      U.loadById('hover-button'); S.events.length = 0; let pressed = false;
      const p = who === 1 ? S.p1 : S.p2;
      run(60, () => who === 1 ? [I(toward(S.p1, 2.0)), I()] : [I(), I(toward(S.p2, 2.0))]);
      let f = 0; run(120, () => { if (S.L.plates.find(x => x.id === 'a').pressed) pressed = true;
        const o = I(loc(p, 1), cx(p) > 3.55 && f++ === 0); return who === 1 ? [o, I()] : [I(), o]; });
      return pressed;
    };
    out['23 Hover: Black alone presses the button'] = soloPress(1);
    out['23 Hover: White alone presses the button'] = soloPress(2);

    // 24 Stepping crates: White places ceiling crates just past Black's last stone; Black bumps each one down
    const stepping = (dB, useSecond) => {
      U.loadById('stepping-crates'); S.events.length = 0;
      const idle = I(), K = S.crates.find(c => c.owner === 1);
      const [, Wb, Wc] = S.crates.filter(c => c.owner === 2).sort((a, b) => a.x - b.x);
      const hopTo = (p, x, frames = 70) => { let f = 0; run(frames, () => { const dd = x - cx(p); const m = Math.abs(dd) < 0.08 ? 0 : Math.sign(dd) * p.g; const o = I(m, f++ === 0); return p === S.p1 ? [o, idle] : [idle, o]; }); };
      const bumpStep = (st, c) => {
        const spot = (Math.max(c.x - 0.65, st.x) + (st.x + 0.9)) / 2 + 0.35;
        run(60, () => [I(toward(S.p1, spot)), idle]);
        { let f = 0; run(50, () => [I(0, f++ === 0), idle]); }
        run(50, () => [I(toward(S.p1, c.x - 0.45)), idle]);
        run(40, () => [I(0), idle]);
        run(60, () => [I(toward(S.p1, c.x + 0.5)), idle]);
      };
      run(200, () => [K.x < 6.0 ? I(1) : I(0), idle]);                               // Black's crate into the first thorn
      hopTo(S.p1, K.x + 0.45);                                                       // Black onto it
      hopTo(S.p2, 3.6);                                                              // White over the first ceiling crate
      run(250, () => [idle, Wb.x < K.x + dB ? I(loc(S.p2, 1)) : I(0)]);              // pushes the next one just past Black's stone
      run(40, () => [idle, I(0)]); run(40, () => [idle, I(toward(S.p2, Wb.x - 1.2))]);
      bumpStep(K, Wb);
      if (useSecond) {
        hopTo(S.p2, 7.4, 60); hopTo(S.p2, 10.8, 80);                                 // over to the right of the last crate
        run(250, () => [idle, Wc.x > Wb.x + 1.05 ? I(loc(S.p2, -1)) : I(0)]);        // pushes it back left, just past stone 1
        run(40, () => [idle, I(0)]); run(60, () => [idle, I(toward(S.p2, 10.8))]);
        bumpStep(Wb, Wc);
      }
      const last = useSecond ? Wc : Wb;
      run(30, () => [I(toward(S.p1, last.x + 0.6)), idle]);
      { let f = 0; run(80, () => [I(1, f++ === 0), idle]); }                         // leap to safe ground
      run(60, () => [I(toward(S.p1, 12.5)), idle]);                                  // Black on plate b: White's door opens
      run(300, () => [I(toward(S.p1, 12.5)), I(toward(S.p2, 14.5))]);
      run(200, () => [I(toward(S.p1, 14.5)), I(toward(S.p2, 14.5))]);
      return won() && pops() === 0;
    };
    out['24 Stepping crates'] = stepping(1.05, true);
    out['24 Stepping crates: one stone only'] = stepping(1.05, false);
    out['24 Stepping crates: first crate placed too far'] = stepping(1.9, true);
    // 25 Stack them up: White's exit hangs 4 tiles down, and only a tower of both crates is tall enough to jump from
    const stackUp = (mode, d = 0) => {
      U.loadById('stack-them-up'); S.events.length = 0;
      const idle = I(), [W1, W2] = S.crates.slice().sort((a, b) => a.x - b.x);
      const D = S.L.doors[0], under = () => top(S.p2) > 4.9 && cx(S.p2) > 10.4;
      const bump = (spot, back) => {
        run(120, () => [I(toward(S.p1, spot)), idle]);
        { let f = 0; run(50, () => [I(0, f++ === 0), idle]); }
        run(50, () => [I(toward(S.p1, back)), idle]); run(40, () => [I(0), idle]);
      };
      if (mode === 'one') {                                                          // Black parks one crate on plate d; White tries with the other
        bump(W2.x + 0.86, W2.x + 1.45);
        run(200, () => [W2.x > 5.05 ? I(-1) : I(0), idle]);
        run(300, () => [idle, I(loc(S.p2, 1))]);                                     // W1 slides all the way to the block
        run(40, () => [idle, I(toward(S.p2, 8.2))]);
        { let f = 0; run(60, () => [idle, I(f < 25 ? loc(S.p2, 1) : 0, f++ === 0)]); }   // White onto the single crate
        const ready = D.open && top(S.p2) > 1.9 && top(S.p2) < 2.0;
        let got = false, f = 0;
        run(90, () => { if (under()) got = true; return [idle, I(f >= d ? loc(S.p2, 1) : 0, f++ === 0)]; });
        return ready ? got || under() : 'setup failed';
      }
      bump(W2.x + 0.1, W2.x - 0.45);                                                 // Black bumps W2 down onto his walkway
      run(150, () => [I(1), idle]);                                                  // and pushes it onto the trapdoor, against the block
      run(40, () => [I(toward(S.p1, 7.0)), idle]);
      if (mode === 'early') run(80, () => [I(toward(S.p1, 5.5)), idle]);             // Black opens the trapdoor too soon: W2 drops through
      run(250, () => [idle, I(loc(S.p2, 1))]);                                       // White pushes W1 along the ceiling to the block
      run(40, () => [idle, I(toward(S.p2, 8.2))]);
      { let f = 0; run(50, () => [idle, I(f < 14 ? loc(S.p2, 1) : 0, f++ === 0)]); } // White jumps down onto W2: it rises under W1
      run(40, () => [idle, I(toward(S.p2, 8.2))]); run(40, () => [idle, I(0)]);
      run(80, () => [I(toward(S.p1, 5.5)), idle]);                                   // Black on plate d: the trapdoor opens
      { let f = 0; run(60, () => [I(toward(S.p1, 5.5)), I(f < 25 ? loc(S.p2, 1) : 0, f++ === 0)]); }   // White onto the tower
      { let f = 0; run(70, () => [I(toward(S.p1, 5.5)), I(loc(S.p2, 1), f++ === 0)]); }                // through the trapdoor, under the block
      run(80, () => [I(toward(S.p1, 5.5)), I(toward(S.p2, 12.5))]);                  // White holds the second plate d
      run(200, () => [I(toward(S.p1, 9.5)), I(toward(S.p2, 12.5))]);                 // Black drops through the trapdoor
      run(200, () => [I(toward(S.p1, 12.5)), I(toward(S.p2, 12.5))]);
      run(150, () => [I(toward(S.p1, 12.5)), I(toward(S.p2, 14.5))]);
      return won() && pops() === 0;
    };
    out['25 Stack them up'] = stackUp('full');
    out['25 Stack them up: trapdoor opened too early'] = stackUp('early');
    { const tries = [0, 4, 8, 12, 16, 20, 24].map(d => stackUp('one', d));
      out['25 Stack them up: one crate is enough'] = tries.includes('setup failed') ? 'setup failed' : tries.includes(true); }
    // 26 Flip the tower: both need the same two-crate tower, Black on the floor first, then White on the ceiling
    const flipTower = (mode, d = 0) => {
      U.loadById('flip-the-tower'); S.events.length = 0;
      const idle = I(), [K1, K2] = S.crates.slice().sort((a, b) => a.x - b.x);
      const plate = id => S.L.plates.find(p => p.id === id), door = id => S.L.doors.find(p => p.id === id);
      let bx = 11.5;                                                                 // where Black waits up top (his exit)
      const B = () => I(toward(S.p1, bx)), Wc = () => I(toward(S.p2, 3.5));
      run(150, () => [idle, I(toward(S.p2, K2.x + 0.1))]);                           // White bumps K2 up to the ceiling
      { let f = 0; run(50, () => [idle, I(0, f++ === 0)]); }
      run(50, () => [idle, I(toward(S.p2, K2.x - 0.45))]); run(40, () => [idle, I(0)]);
      if (mode === 'one-black') {                                                    // K2 stays on the ceiling; Black tries with K1 alone
        run(100, () => [idle, Wc()]);
        run(80, () => [I(toward(S.p1, K1.x - 0.5)), Wc()]);
        run(250, () => [I(1), Wc()]);
        run(40, () => [I(toward(S.p1, 8.0)), Wc()]);
        { let f = 0; run(50, () => [I(f < 20 ? 1 : 0, f++ === 0), Wc()]); }
        const ready = plate('c').pressed && near(bot(S.p1), 8.04);
        let got = false, f = 0;
        run(90, () => { if (bot(S.p1) <= 5.01 && cx(S.p1) > 10.4) got = true; return [I(f >= d ? 1 : 0, f++ === 0), Wc()]; });
        return ready ? got : 'setup failed';
      }
      run(200, () => [idle, I(loc(S.p2, 1))]);                                       // and slides it along the ceiling to the block
      run(80, () => [idle, I(toward(S.p2, 6.0))]);
      run(80, () => [I(toward(S.p1, K1.x - 0.5)), idle]);
      run(250, () => [I(1), idle]);                                                  // Black slides K1 under it
      run(40, () => [I(toward(S.p1, 8.0)), idle]);
      { let f = 0; run(50, () => [I(f < 20 ? 1 : 0, f++ === 0), idle]); }           // climbs onto K1
      { let f = 0; run(50, () => [I(0, f++ === 0), idle]); }                        // bumps K2: it turns black and drops onto his head
      run(60, () => [I(toward(S.p1, 7.5)), idle]); run(40, () => [I(0), idle]);     // steps off, and K2 lands on K1
      run(150, () => [idle, Wc()]);                                                  // White holds c: hatch C opens
      run(30, () => [I(toward(S.p1, 8.0)), Wc()]);
      { let f = 0; run(50, () => [I(f < 25 ? 1 : 0, f++ === 0), Wc()]); }           // Black climbs the tower
      { let f = 0; run(70, () => [I(cx(S.p1) < 10.9 ? 1 : 0, f++ === 0), Wc()]); }  // and jumps up through C onto the block
      if (mode === 'early-d') { bx = 14.5; run(140, () => [B(), Wc()]); bx = 11.5; } // on to plate d too soon: the tower drops through D
      run(80, () => [B(), Wc()]);
      run(120, () => [B(), I(toward(S.p2, 8.2))]);                                   // White lets go of c and flips the tower, top crate first
      for (let k = 0; k < (mode === 'one-white' ? 1 : 2); k++) {
        { let f = 0; run(50, () => [B(), I(f < 14 ? loc(S.p2, 1) : 0, f++ === 0)]); }
        run(40, () => [B(), I(toward(S.p2, 8.2))]); run(30, () => [B(), I(0)]);
      }
      if (mode === 'late-c') { run(150, () => [B(), Wc()]); run(120, () => [B(), I(toward(S.p2, 8.2))]); }   // back on c: the tower floats up through C
      bx = 14.5; run(80, () => [B(), I(0)]);                                         // Black holds d: trapdoor D opens
      { let f = 0; run(60, () => [B(), I(f < 25 ? loc(S.p2, 1) : 0, f++ === 0)]); } // White climbs the ceiling tower
      if (mode === 'one-white') {                                                    // (only one crate up there; the other fell through D)
        const ready = door('d').open && near(top(S.p2), 5.96);
        let got = false, f = 0;
        run(90, () => { if (top(S.p2) >= 8.99 && cx(S.p2) > 10.4) got = true; return [B(), I(f >= d ? loc(S.p2, 1) : 0, f++ === 0)]; });
        return ready ? got : 'setup failed';
      }
      { let f = 0; run(70, () => [B(), I(loc(S.p2, 1), f++ === 0)]); }              // and jumps down through D to the underside of the block
      bx = 11.5; run(200, () => [B(), I(toward(S.p2, 13.5))]);
      return won() && pops() === 0;
    };
    const flipSweep = mode => { const t = [0, 4, 8, 12, 16, 20, 24].map(d => flipTower(mode, d)); return t.includes('setup failed') ? 'setup failed' : t.includes(true); };
    out['26 Flip the tower'] = flipTower('full');
    out['26 Flip the tower: plate d before the flip'] = flipTower('early-d');
    out['26 Flip the tower: plate c after the flip'] = flipTower('late-c');
    out['26 Flip the tower: one crate gets Black up'] = flipSweep('one-black');
    out['26 Flip the tower: one crate gets White down'] = flipSweep('one-white');
    // 27 Half flip: Black's crate rides up the hatch ahead of him; White flips only the top crate, so the bottom one drops for him
    let halfDown = false;
    const halfFlip = mode => {
      U.loadById('half-flip'); S.events.length = 0;
      const idle = I(), [K2, K3, K6] = S.crates.filter(c => c.owner === 1).sort((a, b) => a.x - b.x);
      const Bw = () => I(toward(S.p1, 10.5)), Wc = () => I(toward(S.p2, 1.5));
      const lift = (x, back, B) => {                                                 // White jumps into a floor crate, then steps behind it
        run(100, () => [B(), I(toward(S.p2, x))]);
        { let f = 0; run(50, () => [B(), I(0, f++ === 0)]); }
        run(50, () => [B(), I(toward(S.p2, back))]); run(40, () => [B(), I(0)]);
        run(250, () => [B(), I(loc(S.p2, 1))]);                                      // and slides it along the ceiling to the hatch
      };
      run(200, () => [idle, I(loc(S.p2, 1))]); run(80, () => [idle, I(toward(S.p2, 5.5))]);   // tower: White's crate to the block,
      run(200, () => [I(1), idle]); run(40, () => [I(toward(S.p1, 8.0)), idle]);               // Black's crate under it,
      { let f = 0; run(50, () => [I(f < 20 ? 1 : 0, f++ === 0), idle]); }
      { let f = 0; run(50, () => [I(0, f++ === 0), idle]); }                                   // Black bumps the top one down
      run(60, () => [I(toward(S.p1, 7.5)), idle]); run(40, () => [I(0), idle]);
      lift(3.45, 2.4, () => idle);                                                   // K3 under the hatch
      run(200, () => [idle, Wc()]);                                                  // White on c: K3 rises through the hatch
      run(30, () => [I(toward(S.p1, 8.0)), Wc()]);
      { let f = 0; run(50, () => [I(f < 25 ? 1 : 0, f++ === 0), Wc()]); }           // Black climbs the tower
      { let f = 0; run(70, () => [I(cx(S.p1) < 10.5 ? 1 : 0, f++ === 0), Wc()]); }  // and follows it up
      run(40, () => [Bw(), Wc()]);
      if (mode === 'early-d') { run(80, () => [I(toward(S.p1, 12.5)), Wc()]); run(80, () => [Bw(), Wc()]); }   // plate d too soon: the tower drops
      if (mode === 'full-flip') {                                                    // White flips both crates, as in Flip the tower
        run(120, () => [Bw(), I(toward(S.p2, 8.2))]);
        for (let k = 0; k < 2; k++) {
          { let f = 0; run(50, () => [Bw(), I(f < 14 ? loc(S.p2, 1) : 0, f++ === 0)]); }
          run(40, () => [Bw(), I(toward(S.p2, 8.2))]); run(30, () => [Bw(), I(0)]);
        }
      } else {
        lift(2.45, 1.4, Bw);                                                         // K2 onto the ceiling above the tower
        run(40, () => [Bw(), I(toward(S.p2, 8.2))]);
        { let f = 0; run(50, () => [Bw(), I(f < 20 ? loc(S.p2, 1) : 0, f++ === 0)]); }   // White climbs onto K2
        { let f = 0; run(40, () => [Bw(), I(0, f++ === 0)]); }                            // and drops onto the top crate only
        run(60, () => [Bw(), I(toward(S.p2, 7.5))]); run(40, () => [Bw(), I(0)]);
      }
      if (mode === 'late-c') { run(250, () => [Bw(), Wc()]); run(150, () => [Bw(), I(toward(S.p2, 7.5))]); }   // back on c: the tower floats away
      run(80, () => [I(toward(S.p1, 12.5)), I(0)]);                                  // Black on d: the bottom crate drops through
      { let f = 0; run(60, () => [I(toward(S.p1, 12.5)), I(f < 25 ? loc(S.p2, 1) : 0, f++ === 0)]); }                  // White climbs the tower
      { let f = 0; run(70, () => [I(toward(S.p1, 12.5)), I(cx(S.p2) < 10.5 ? loc(S.p2, 1) : 0, f++ === 0)]); }         // and follows it down
      halfDown = top(S.p2) >= 9.99 && cx(S.p2) > 9.9;
      run(150, () => [I(toward(S.p1, 9.5), S.p1.grounded && S.p1.blockedX), I(0)]); // Black onto the hatch
      { let f = 0; run(50, () => [I(0, f++ === 0), idle]); }                        // bumps K3 down onto it
      run(50, () => [I(toward(S.p1, 10.6)), idle]); run(40, () => [I(0), idle]);
      { let f = 0; run(60, () => [I(cx(S.p1) > 9.5 ? -1 : 0, f++ === 0), idle]); } // climbs onto K3
      { let f = 0; run(70, () => [I(-1, f++ === 0), idle]); }                       // and jumps to his ledge
      run(150, () => [I(toward(S.p1, 5.5)), idle]);
      run(150, () => [I(toward(S.p1, 5.5)), I(toward(S.p2, 9.5), S.p2.grounded && S.p2.blockedX)]);   // White under the trapdoor
      { let f = 0; run(50, () => [I(toward(S.p1, 5.5)), I(0, f++ === 0)]); }                           // lifts his crate up to it
      run(50, () => [I(toward(S.p1, 5.5)), I(toward(S.p2, 10.6))]); run(40, () => [I(toward(S.p1, 5.5)), I(0)]);
      { let f = 0; run(60, () => [I(toward(S.p1, 5.5)), I(cx(S.p2) > 9.5 ? loc(S.p2, -1) : 0, f++ === 0)]); }   // climbs onto it
      { let f = 0; run(70, () => [I(toward(S.p1, 5.5)), I(loc(S.p2, -1), f++ === 0)]); }                         // and jumps to his ledge
      run(150, () => [I(toward(S.p1, 5.5)), I(toward(S.p2, 5.5))]);
      return won() && pops() === 0;
    };
    const ledgeReach = (who, d) => {                                                 // from the hatch (Black) or the trapdoor (White) with no crate
      U.loadById('half-flip'); S.events.length = 0;
      const p = who === 1 ? S.p1 : S.p2;
      p.x = 9.5 - p.w / 2; p.y = who === 1 ? 5 - p.h : 11; p.vx = p.vy = 0;
      run(20, () => [I(), I()]);
      const ready = p.grounded; let got = false, f = 0;
      run(120, () => { if (who === 1 ? bot(S.p1) <= 2.01 && cx(S.p1) < 9 : top(S.p2) >= 13.99 && cx(S.p2) < 9) got = true;
        const o = I(f >= d ? loc(p, -1) : 0, f++ === 0); return who === 1 ? [o, I()] : [I(), o]; });
      return ready ? got : 'setup failed';
    };
    const ledgeSweep = who => { const t = [0, 4, 8, 12, 16, 20, 24].map(d => ledgeReach(who, d)); return t.includes('setup failed') ? 'setup failed' : t.includes(true); };
    out['27 Half flip'] = halfFlip('full');
    out['27 Half flip: full flip'] = halfFlip('full-flip');
    out['27 Half flip: full flip still gets White down'] = halfDown;
    out['27 Half flip: plate d before the half flip'] = halfFlip('early-d');
    out['27 Half flip: plate c after the half flip'] = halfFlip('late-c');
    out['27 Half flip: Black reaches his ledge without a crate'] = ledgeSweep(1);
    out['27 Half flip: White reaches his ledge without a crate'] = ledgeSweep(2);
    return out;
  });
  console.log(JSON.stringify(result, null, 1));
  await page.evaluate(() => { const U = window.UPSIDE; U.manual = true; U.loadById('the-gate'); U.S.banner = 0; });
  await page.waitForTimeout(150);
  await page.screenshot({ path: require('path').join(__dirname, 'gate.png') });
  console.log('errors:', errors);
  const mustPass = ['1 Hello', '2 Relay', '3 On three', '6 Bonk the button', '10 Off-beat', '17 All together now', '18 Double bonk', '19 Encore', '20 Backbeat', '21 Thread the needle', '22 Pop home', '23 Hover button', '24 Stepping crates', '25 Stack them up', '26 Flip the tower', '27 Half flip', '27 Half flip: full flip still gets White down', '4 Special delivery', '5 Stepping stones', '7 Round trip', '7 Round trip: crate on plate c', '8 Swap places', '8 Swap places: locked', '9 Meet in the middle',
    '11 Your turn to climb', '12 The ladder', '13 Busy doors', '14 The gate', '15 The long way home', '15 long way: crate dropped to Black', '15 long way: crate on plate a', '16 The longer way home', '16 longer way: crate dropped to Black', '16 longer way: crate on plate a',
    '5 stones: Black waits at door', '5 stones: White on button, door open', '12 crossed after climb',
    '14 gate open', '14 gate closed blocks'];
  const mustFail = ['22 Pop home: back to plate a without popping', '23 Hover button: step off together', '23 Hover: Black alone presses the button', '23 Hover: White alone presses the button', '24 Stepping crates: one stone only', '24 Stepping crates: first crate placed too far', '25 Stack them up: trapdoor opened too early', '25 Stack them up: one crate is enough', '26 Flip the tower: plate d before the flip', '26 Flip the tower: plate c after the flip', '26 Flip the tower: one crate gets Black up', '26 Flip the tower: one crate gets White down', '27 Half flip: full flip', '27 Half flip: plate d before the half flip', '27 Half flip: plate c after the half flip', '27 Half flip: Black reaches his ledge without a crate', '27 Half flip: White reaches his ledge without a crate', '16 longer way: no teamwork', '21 Thread the needle: Black alone', '18 Double bonk: one jumps alone', '19 Encore: step off together', '20 Backbeat: White steps off first', '3 On three: one at a time', '6 Bonk: White not ready', '6 Bonk: standing under the button opens it', '10 Off-beat: both together', '17 finale: park over thorns', '5 solo Black reaches exit', '7 Round trip: no teamwork', '8 Swap places: no teamwork', '11 solo White (no crate)', '13 no teamwork', '15 long way: no teamwork', '15 long way: Black alone reaches exit'];
  const bad = [...mustPass.filter(k => result[k] !== true), ...mustFail.filter(k => result[k] !== false),
    ...(errors.length ? ['page errors'] : [])];
  for (const k of ['3 On three: window ms', '10 Off-beat: window ms', '17 finale: door window ms', '17 finale: step-off window ms'])
    if (!(result[k] >= 250)) bad.push(`${k} is ${result[k]}; coordination windows must be at least 250 ms`);
  for (const k of ['23 Hover button: window ms', '21 Thread the needle: window ms', '18 Double bonk: window ms', '19 Encore: drop window ms', '19 Encore: door window ms', '20 Backbeat: drop window ms', '20 Backbeat: last doors window ms'])
    if (!(result[k] >= 150)) bad.push(`${k} is ${result[k]}; hard coordination windows must be at least 150 ms`);
  if (result['16 pops'] !== 0) bad.push('16 scripted solution should not hit thorns');
  if (result['15 pops'] !== 0) bad.push('15 scripted solution should not hit thorns');
  if (result['12 solo Black pops'] < 1) bad.push('12 solo Black should hit thorns');
  if (bad.length) { console.error('FAILED:', bad); process.exitCode = 1; } else console.log('All level checks passed');
  await browser.close();
  server.close();
})();
