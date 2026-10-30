# Upside

A cooperative puzzle game for two players sharing **one phone**. The phone lies flat on a table between them, and each player sits at one short edge.

- **Black** plays from the bottom edge and falls toward the bottom.
- **White** plays from the top edge and falls toward the top.

Both share the same map, and neither can finish a level alone. It's made for kids and families. It's grayscale, has no timers or scores, and shows very little text.

It's plain HTML and JavaScript, with no build step and no dependencies. The game is `index.html`, the levels live in `levels/`, and `editor.html` is a level editor.

## Play

**Play online: https://yeger00.github.io/upside/**. Open it in Chrome on an Android phone. Tap ⋮ → *Add to Home screen* for the best fullscreen experience.

Every push to `main` runs the tests and, if they pass, redeploys the site (see `.github/workflows/pages.yml`).

To start, both players hold their own control band.

| Control | What it does |
|---|---|
| ◀ ▶ | Move, from your own point of view |
| Jump (arrow with a bar) | Jump away from your own edge |
| ⟲ next to the volume button | Restart the level. Both players must hold their own ⟲ for about one second. |
| 🔈 | Mute |

**Desktop testing with the keyboard:**

| Who | Keys |
|---|---|
| Black | `A` and `D` to move, `W` to jump |
| White | `←` and `→` to move, `↓` to jump |
| Both | `Space` = ready, `R` = restart, `M` = mute |

Add `#level-<id>` (for example `#level-the-gate`) or `#level5` to the URL to start at that level.

## Rules

- **Plates and doors:** standing on a plate, or leaving a crate on it, opens the door with the same symbol. A door never closes on someone standing in it.
- **Crates take the gravity of the last player who touched them.** Black-touched crates fall down and White-touched crates fall up. Head-bumping a crate counts as touching it.
- **Thorns** send only the character who touched them back to that character's start. The rest of the puzzle stays as it was.
- **Foot to foot:** when Black is above White and they land on each other, they lock together in mid-air. The pair moves when either player pushes a direction. Pressing jump lets go, and each player falls back home.
- **Win:** both players stand on their own exits at the same time.

## Levels

| # | Name | Idea |
|---|---|---|
| 1 | Hello, other side | Black holds a plate for White's door |
| 2 | Relay | Take turns holding plates |
| 3 | Special delivery | White passes a crate down; Black bumps it and it turns black |
| 4 | Stepping stones | Floating blocks over thorns; White's button opens Black's door |
| 5 | Round trip | A two-way relay: White carries the white crate back to hold Black's last door |
| 6 | Swap places | Jump past each other so Black lands on White's feet; teaches connecting |
| 7 | Meet in the middle | Foot-to-foot float across the thorns |
| 8 | Your turn to climb | Level 3 turned 180°, so White climbs and bumps |
| 9 | The ladder | Climb past each other to get crossed, then float |
| 10 | Busy doors | Four doors, two crates, two sockets; order matters |
| 11 | The gate | Ladder, plus two crates holding a two-part gate open |
| 12 | The long way home | The white crate travels down to Black, back up, and all the way to White's start |

## Level files

Each level is its own file, `levels/<id>.json`:

```json
{
  "format": "upside-level",
  "version": 1,
  "id": "stepping-stones",
  "name": "Stepping stones",
  "author": "yeger00",
  "map": [
    "###############",
    "#2 vvvvvvv a Y#",
    "..."
  ]
}
```

- **`id`** is lowercase words joined by hyphens. It never changes and matches the file name.
- **`author`** and **`notes`** are optional. Notes are for designers and never appear in the game.
- **`map`** is a text grid, one row per line, 10–16 tiles wide and high, with walls all around the edge.
- **`levels/index.json`** lists the level ids in play order. It's the only place that decides which levels are in the game.

Map legend:

```
#   wall                  1 / 2   Black / White start
X   Black exit            Y       White exit
a-d plate  ->  A-D door with the same letter (a door is one vertical run)
K   black crate           W       white crate
^   thorns on the floor   v       thorns on the ceiling
    (space) empty
```

A plate's side (floor or ceiling) is detected from the neighbouring walls. A one-tile hole in a floor or ceiling works as a **socket**: a crate that drops in stays there.

`level-format.js` holds the one checker that the game, the editor and the tests all use. A level must have exactly one of each start and exit, every plate must have a matching door (and every door a plate), and each door must be one straight vertical run.

**Design rules:**
- A jump climbs 2 tiles but not 3.
- Crates can't be pushed up a step.
- After a crate drops off an edge, it can't be pushed any further.
- Floating bars two rows apart work as a ladder for both players.

## Level editor

**Open it:** https://yeger00.github.io/upside/editor.html (or `/editor.html` on a local server).

1. **Start:** choose a size and press **Start new**, or pick a built-in level and press **Open copy**.
2. **Paint:** choose a tile on the left, then click or drag on the grid. Right-click erases. The outer wall is locked.
   - Shortcuts: `Q` wall, `E` eraser, `T`/`G` thorns, `B`/`N` starts, `X`/`Y` exits, `K`/`J` crates, `1`–`4` plates, `Shift+1`–`4` doors, `L` grid letters, `Ctrl+Z` / `Ctrl+Shift+Z` undo and redo.
3. **Fix what's listed under Problems.** Hints point out things that are allowed but are often mistakes, such as a 3-tile step or a door short enough to jump over.
4. **Play-test (`P`)** runs the level in the real game with the keyboard. Press `Esc` to go back to editing.
5. **Copy level** copies the finished level file. Paste it into a Claude session on this repo and ask it to add the level. Claude checks it, saves it to `levels/`, adds it to the level order, writes a test for it, and pushes. The live game then updates by itself.

The editor stores nothing. It warns you before you leave the page with changes you haven't copied.

## Run locally

The game loads its level files from the server, which browsers block for pages opened straight from disk. Serve the folder instead:

```bash
npx serve .
# then open http://localhost:3000/index.html or /editor.html
```

## Levels without a scripted solution

None yet.

## Tests

The tests drive the real game and editor in headless Chromium, over a small local server (`tests/server.js`). They check that:
- every file in `levels/` passes the shared checker, and that `levels/index.json` lists each one exactly once
- each level's scripted solution reaches the win without hitting any thorns
- solo or no-teamwork attempts fail
- restarting needs both players
- the editor round-trips a built-in level byte for byte, paints a new level, undoes and redoes, copies the level, and play-tests it to a win

```bash
npm install
npx playwright install chromium   # first time only
npm test
```

When you add a level, add a scripted solution for it to `tests/levels.js` (see `CLAUDE.md`).
