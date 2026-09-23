# AGENTS.md

Guidance for people and coding agents working on Scrollbrella. (`CLAUDE.md` is a symlink to this file.)

## What this is

A calm, installable web app (iPhone home screen) to open instead of doom-scrolling: splash animation → music button → one feeling, one action, then "Put the phone down. It will still be here." and the screen dims. Plain static HTML/CSS/JS with **no build step and no dependencies**, hosted on GitHub Pages from `main` (root).

Live: https://fulaibaowang.github.io/scrollbrella/

## Files

| Path | Purpose |
|---|---|
| `index.html` | Markup: splash (inline SVG logo story), prompt stage, corner buttons, editor sheet |
| `style.css` | All styles; colour tokens on `:root`; splash keyframes |
| `app.js` | Sections: default sets & time windows → storage → main screen (visit flow) → editor → music → splash → offline |
| `sw.js` | Service worker: caches `ASSETS` at install, serves cache-first, slices byte ranges for audio |
| `manifest.webmanifest` | Name, standalone display, icons |
| `icons/icon-*-v2.png` | Home-screen icons (simple cream umbrella on red) |
| `audio/gymnopedie-1-v2.m4a` | Public-domain piano, 192 kbps AAC, peak-normalised |
| `docs/scrollbrella.gif` | README animation (rendered from the splash) |
| `concepts.html` | Early logo explorations (A/B/C); not part of the app or cache |

## Release rules (important)

- **Bump `VERSION` in `sw.js` on every change to a cached file.** Otherwise phones keep serving the old copy. Updates appear on the launch *after* the new worker installs.
- **New file used by the app → add it to `ASSETS` in `sw.js`.**
- **Changing an icon or the audio → use a new filename** (`-v3`, …) and update `index.html`, `manifest.webmanifest` and `sw.js`. iOS caches home-screen icons by URL; users must delete and re-add the app to see a new icon.
- Changing `DEFAULT_SETS` or `DEFAULT_WINDOWS` needs no migration: they're only stored once customised, so unchanged users follow new defaults.
- Pushing to `main` deploys. Check a build with
  `gh api repos/fulaibaowang/scrollbrella/pages/builds/latest --jq '.status + " " + .commit[0:7]'`.

## Data (all on-device, `localStorage`)

| Key | Contents |
|---|---|
| `scrollbrella.promptSets` | `{feel: [], act: []}`; only stored when it differs from `DEFAULT_SETS` |
| `scrollbrella.prompts` | Legacy flat list; migrated into sets (known actions → `act`) and removed on next save |
| `scrollbrella.timeWindows` | `[{start, end, prompts}]` hours 0–24, may cross midnight; only stored when customised |
| `scrollbrella.music` | `"on"` / `"off"` |

Every storage access is wrapped in `try/catch`; the app must work without storage. A visit is deliberately short (the opposite of a feed): a random feeling, a random action (actions + active time-window prompts), the closing line, then the screen dims. Each prompt auto-advances after `ADVANCE_MS` (10 s, no visible countdown); a tap skips ahead; paused while the editor is open. Returning after 60 s away, or saving in the editor, starts a fresh visit.

## iOS constraints to respect

- Audio can only start from a user tap; `audio.volume` is read-only (change loudness in the file itself).
- Safari fetches audio with `Range` requests: the service worker must answer with `206` slices (see `rangeResponse`).
- Inputs need `font-size: 16px` or iOS zooms on focus. Respect `env(safe-area-inset-*)`.
- The home-screen app and Safari have separate storage and separate service workers.

## Design decisions (keep unless the owner asks)

- One background: the dusk-blue → teal gradient. No background picker.
- Home-screen icon stays the simple umbrella on red.
- Splash story: finger scrolls a feed → umbrella pops open → finger crashes into it (burst + shake) → logo fades → a large breathing music circle waits for the tap.
- Calm, minimal UI: cream text (`--text`), serif prompts, soft outlined pill buttons, 700 ms fades. Respect `prefers-reduced-motion`.

## Testing locally

```sh
python3 -m http.server 8765   # then open http://localhost:8765/
```

- Headless Chrome screenshots work well (`--headless=new --screenshot --window-size=500,900`); its minimum window width is about 500px.
- To inspect an animation frame, freeze it: `document.getAnimations().forEach(a => { a.pause(); a.currentTime = T })`.
- Service-worker tests: use a persistent `--user-data-dir`, load once online, stop the server, load again. Wrap headless runs in a timeout, since they can hang while a worker is active.
- Finally, check on a real iPhone from the home-screen app (open, close fully, reopen to pick up a new version).
