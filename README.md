# Upside

A cooperative puzzle game for two players sharing **one phone**. The phone lies flat on a table between them, and each player sits at one short edge.

- **Black** plays from the bottom edge and falls toward the bottom.
- **White** plays from the top edge and falls toward the top.

Both share the same map, and neither can finish a level alone. It's made for kids and families. It's grayscale, has no timers or scores, and shows very little text.

The whole game is one self-contained file, `index.html`, with no build step and no dependencies.

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

Add `#level5` (or any level number) to the URL to start at that level.

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
| 5 | Meet in the middle | Foot-to-foot float across the thorns |
| 6 | Your turn to climb | Level 3 turned 180°, so White climbs and bumps |
| 7 | The ladder | Climb past each other to get crossed, then float |
| 8 | Busy doors | Four doors, two crates, two sockets; order matters |
| 9 | The gate | Ladder, plus two crates holding a two-part gate open |

### Level format

Levels are ASCII grids in the `LEVELS` array near the top of the script in `index.html`.

```
#   wall                  1 / 2   Black / White start
X   Black exit            Y       White exit
a-d plate  ->  A-D door with the same letter
K   black crate           W       white crate
^   thorns on the floor   v       thorns on the ceiling
```

A plate's side (floor or ceiling) is detected from the neighbouring walls. A one-tile hole in a floor or ceiling works as a **socket**: a crate that drops in stays there.

**Design rules:**
- Crates can't be pushed up a step.
- After a crate drops off an edge it can't be pushed any further, so each drop must land exactly where it's needed.
- Floating bars two rows apart work as a ladder for both players.

## Tests

The tests drive the real game in headless Chromium. For each level they:
- play a scripted solution that must reach the win, without hitting any thorns
- try solo or no-teamwork runs that must fail
- check that restarting needs both players

```bash
npm install
npx playwright install chromium   # first time only
npm test
```

Add a scripted solution to `tests/levels.js` whenever you add a level.
