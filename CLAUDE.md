# Upside: notes for Claude

A two-player co-op puzzle game for one Android phone, written in plain HTML and JavaScript with no build step and no frameworks. Black plays from the bottom edge and falls down; White plays from the top edge and falls up. It's grayscale, for kids and families.

## Files

| Path | What it is |
|---|---|
| `index.html` | The whole game engine. It loads its levels from `levels/` at startup. |
| `level-format.js` | The shared level checker, `checkLevel()`, plus `hints()` and `formatLevelJSON()` (the standard file layout). Used by the game, the editor and the tests. |
| `levels/<id>.json` | One file per level (format `upside-level`, version 1). |
| `levels/index.json` | An ordered list of level ids. It alone decides which levels are in the game and in what order. |
| `editor.html` | The level editor. Its only output is "Copy level". |
| `tests/` | Playwright tests: `level-files.js`, `levels.js` (a scripted solution plus solo checks per level), `restart.js`, `editor.js`. `server.js` is the static server the tests use. |
| `.github/workflows/pages.yml` | On every push to `main`, runs `npm test`, then deploys to GitHub Pages. |

- **Run the tests:** `npm install`, `npx playwright install chromium`, then `npm test`.
- **Run locally:** `npx serve .`, then open `/index.html` or `/editor.html`. Pages opened straight from disk (`file://`) can't load the level files.
- **Live game:** https://yeger00.github.io/upside/ (editor: `/editor.html`).

## Adding a level that the user pasted

The user designs a level in the editor, presses **Copy level**, and pastes the JSON here. Follow these steps every time:

1. **Check it.** Run `checkLevel()` from `level-format.js` on the pasted JSON (for example with `node -e`). If it fails, explain the problems in plain words and stop.
2. **Check the id.** If `levels/<id>.json` already exists, ask whether to replace that level or use a new id. The editor keeps the original id when the user started from a copy of a built-in level.
3. **Save it** as `levels/<id>.json`, exactly as pasted, normalising only the layout with `formatLevelJSON()`. `tests/level-files.js` fails on any other layout.
4. **Add the id to `levels/index.json`,** at the end unless the user says where. When replacing a level, keep its position.
5. **Write a scripted solution** in `tests/levels.js`, plus a solo or no-teamwork check that must fail:
   - Use the helpers there: `I(move, press)`, `toward(p, x)`, `run(frames, fn)`, `climber(p, steps)`, `floatAcross()`.
   - Load the level with `U.loadById('<id>')`.
   - Add the result keys to `mustPass` and `mustFail`.
   - Black's local move is the world direction; White's is the opposite (`loc(p, dir)`).

   If you can't find a solution, say so, add the level anyway, and list it under **Levels without a scripted solution** in `README.md`.
6. **Test, commit and push.** Run `npm test`. Then commit with the message `Add level: <name>` (or `Update level: <name>`) and push to `main`. The Pages workflow republishes the game.
7. **Reply** with the level's position (for example "level 10 of 10") and a direct link: `https://yeger00.github.io/upside/#level-<id>`.

## Rules

- Don't add new game object types without asking. The map legend is the one in `level-format.js`.
- Keep the game and the editor dependency-free, with no build step. The only Node code is the tests.
- Every commit must leave `npm test` passing.
- Level-design facts that solutions depend on:
  - a jump climbs 2 tiles but not 3
  - a running jump crosses about 3 tiles
  - crates take the gravity of the last player who touched them, and can't be pushed up a step
  - a one-tile hole in a floor or ceiling is a socket that keeps a crate
