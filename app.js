const STORAGE_KEY = "scrollbrella.prompts";
const MUSIC_KEY = "scrollbrella.music";

const DEFAULT_PROMPTS = [
  "Breathe in slowly. Breathe out slower.",
  "Nothing here is urgent.",
  "Look out a window for a moment.",
  "You don't need to catch up on anything.",
  "Unclench your jaw. Drop your shoulders.",
  "What do you actually want to do right now?",
  "Stand up and stretch.",
  "Drink a glass of water.",
  "It's okay to be bored.",
  "Notice three sounds around you.",
  "Rest is not wasted time.",
  "Put the phone down. It will still be here.",
];

// ---- Storage ----

function cleanList(lines) {
  return lines.map((s) => s.trim()).filter(Boolean);
}

function loadPrompts() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) {
      const list = cleanList(saved.filter((s) => typeof s === "string"));
      if (list.length) return list;
    }
  } catch {
    // Unreadable or unavailable storage: fall back to defaults.
  }
  return DEFAULT_PROMPTS.slice();
}

function savePrompts(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Storage blocked; prompts still apply for this session.
  }
  // Ask iOS/browsers not to evict our data under storage pressure.
  navigator.storage?.persist?.().catch(() => {});
}

// ---- Main screen ----

const stage = document.getElementById("stage");
const promptEl = document.getElementById("prompt");
let prompts = loadPrompts();
let current = -1;

function pickNext() {
  if (prompts.length === 1) return 0;
  let i;
  do {
    i = Math.floor(Math.random() * prompts.length);
  } while (i === current);
  return i;
}

function showNext() {
  current = pickNext();
  promptEl.classList.remove("shown");
  const fadeMs = promptEl.textContent ? 700 : 0;
  setTimeout(() => {
    promptEl.textContent = prompts[current];
    promptEl.classList.add("shown");
  }, fadeMs);
}

stage.addEventListener("click", showNext);

// ---- Editor ----

const editor = document.getElementById("editor");
const textArea = document.getElementById("prompts-text");
const copyBtn = document.getElementById("copy");

document.getElementById("edit-open").addEventListener("click", () => {
  textArea.value = prompts.join("\n");
  editor.hidden = false;
});

document.getElementById("cancel").addEventListener("click", () => {
  editor.hidden = true;
});

document.getElementById("done").addEventListener("click", () => {
  const list = cleanList(textArea.value.split("\n"));
  prompts = list.length ? list : DEFAULT_PROMPTS.slice();
  savePrompts(prompts);
  editor.hidden = true;
  current = -1;
  showNext();
});

document.getElementById("restore").addEventListener("click", () => {
  if (confirm("Replace the text with the default prompts? (Nothing is saved until you tap Done.)")) {
    textArea.value = DEFAULT_PROMPTS.join("\n");
  }
});

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(textArea.value);
  } catch {
    textArea.select();
    document.execCommand("copy");
  }
  copyBtn.textContent = "Copied";
  setTimeout(() => (copyBtn.textContent = "Copy all"), 1500);
});

// ---- Music ----
// iOS only allows audio to start from a tap, so music (on by default)
// begins with the first tap anywhere and the speaker button toggles it.

const music = document.getElementById("music");
const musicBtn = document.getElementById("music-toggle");

function readMusicPref() {
  try {
    return localStorage.getItem(MUSIC_KEY) !== "off";
  } catch {
    return true;
  }
}

let wantMusic = readMusicPref();

function renderMusicBtn() {
  musicBtn.setAttribute("aria-pressed", String(wantMusic));
  musicBtn.setAttribute("aria-label", wantMusic ? "Pause music" : "Play music");
}

function playIfWanted() {
  if (wantMusic && music.paused) music.play().catch(() => {});
}

function setWantMusic(on) {
  wantMusic = on;
  try {
    localStorage.setItem(MUSIC_KEY, on ? "on" : "off");
  } catch {}
  renderMusicBtn();
  if (on) playIfWanted();
  else music.pause();
}

musicBtn.addEventListener("click", () => setWantMusic(!wantMusic));
music.addEventListener("play", () => musicBtn.classList.remove("nudge"));

document.addEventListener("click", (e) => {
  if (e.target.closest("#music-toggle, #editor")) return;
  playIfWanted();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) music.pause();
  else playIfWanted();
});

renderMusicBtn();

// ---- Splash (once per launch) ----

const splash = document.getElementById("splash");
const splashMusic = document.getElementById("splash-music");
let splashDone = false;

// Offer music on the splash unless the user has turned it off.
splashMusic.hidden = !wantMusic;
splashMusic.addEventListener("click", () => setWantMusic(true));

function endSplash() {
  if (splashDone) return;
  splashDone = true;
  splash.classList.add("gone");
  setTimeout(() => splash.remove(), 700);
  showNext();
  setTimeout(() => {
    if (wantMusic && music.paused) musicBtn.classList.add("nudge");
  }, 1200);
}

splash.addEventListener("click", endSplash);
setTimeout(endSplash, splashMusic.hidden ? 4200 : 6500);
