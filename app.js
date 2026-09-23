const STORAGE_KEY = "scrollbrella.prompts";
const MUSIC_KEY = "scrollbrella.music";

const DEFAULT_PROMPTS = [
  "Breathe in slowly. Breathe out slower.",
  "Nothing here is urgent.",
  "Look at the sky for a moment.",
  "You don't need to catch up on anything.",
  "Stand up and stretch.",
  "Drink a glass of water.",
  "It's okay to be bored.",
  "Listen for the trees, the leaves, the wind.",
  "Rest is not wasted time.",
  "Put the phone down. It will still be here.",
];

// Built-in prompts for the time of day on the phone's clock. The first
// prompt after opening comes from here; later ones mix into the pool.
const TIME_PROMPTS = {
  morning: [
    "Good morning. Close your eyes: what would make today a good day?",
    "What's one thing you'd love to do today?",
    "Before the day rushes in, take one slow breath.",
  ],
  afternoon: [
    "How is your day going so far?",
    "What's one thing left today that really matters?",
    "Halfway through the day. Take a slow breath.",
  ],
  evening: [
    "What did you do today? Name one good moment.",
    "The day is winding down. What are you glad you did?",
    "Evening now. Let the day slow down with you.",
  ],
  night: [
    "It's late. What's one thing you're grateful for today?",
    "The day is done. Let it go, and rest.",
    "Put the screen away. Tomorrow can wait.",
  ],
};

function timePrompts(now = new Date()) {
  const h = now.getHours();
  if (h >= 5 && h < 12) return TIME_PROMPTS.morning;
  if (h >= 12 && h < 18) return TIME_PROMPTS.afternoon;
  if (h >= 18 && h < 22) return TIME_PROMPTS.evening;
  return TIME_PROMPTS.night;
}

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
let current = null; // text currently shown; null before the first prompt

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function pickNext() {
  if (current === null) return randomFrom(timePrompts());
  const pool = [...prompts, ...timePrompts()].filter((t) => t !== current);
  return pool.length ? randomFrom(pool) : current;
}

function showNext() {
  current = pickNext();
  const text = current;
  promptEl.classList.remove("shown");
  const fadeMs = promptEl.textContent ? 700 : 0;
  setTimeout(() => {
    promptEl.textContent = text;
    promptEl.classList.add("shown");
  }, fadeMs);
}

stage.addEventListener("click", showNext);

// ---- Editor ----
// One card per prompt. Edits stay in the cards until Done; Cancel discards.

const editor = document.getElementById("editor");
const list = document.getElementById("prompt-list");
const countEl = document.getElementById("prompt-count");
const copyBtn = document.getElementById("copy");

function autoGrow(input) {
  input.style.height = "auto";
  input.style.height = `${input.scrollHeight}px`;
}

function editorValues() {
  return cleanList([...list.querySelectorAll(".prompt-input")].map((el) => el.value));
}

function updateCount() {
  const n = editorValues().length;
  countEl.textContent = n === 0 ? "No prompts yet, so the defaults will be used" : `${n} prompt${n === 1 ? "" : "s"}`;
}

function makeItem(text) {
  const li = document.createElement("li");
  li.className = "prompt-item";

  const input = document.createElement("textarea");
  input.className = "prompt-input";
  input.rows = 1;
  input.value = text;
  input.placeholder = "Write a prompt…";
  input.enterKeyHint = "next";
  input.setAttribute("autocapitalize", "sentences");
  input.setAttribute("aria-label", "Prompt");

  // Return starts a new prompt below instead of adding a line break.
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.isComposing) {
      e.preventDefault();
      addItem("", li);
    }
  });

  // Pasting a copied list splits it into one card per line.
  input.addEventListener("input", () => {
    if (input.value.includes("\n")) {
      const [first, ...rest] = input.value.split("\n");
      input.value = first;
      let after = li;
      for (const line of cleanList(rest)) after = addItem(line, after, false);
    }
    autoGrow(input);
    updateCount();
  });

  const remove = document.createElement("button");
  remove.className = "prompt-remove";
  remove.setAttribute("aria-label", "Delete prompt");
  remove.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  remove.addEventListener("click", () => {
    li.remove();
    updateCount();
  });

  li.append(input, remove);
  return li;
}

function addItem(text, after = null, focus = true) {
  const li = makeItem(text);
  if (after) after.after(li);
  else list.append(li);
  const input = li.querySelector(".prompt-input");
  autoGrow(input);
  if (focus) {
    input.focus();
    li.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  updateCount();
  return li;
}

function fillEditor(items) {
  list.replaceChildren();
  for (const text of items) addItem(text, null, false);
  updateCount();
}

document.getElementById("edit-open").addEventListener("click", () => {
  editor.hidden = false; // visible first so cards can measure their height
  fillEditor(prompts);
  list.scrollTop = 0;
});

document.getElementById("add-prompt").addEventListener("click", () => addItem(""));

document.getElementById("cancel").addEventListener("click", () => {
  editor.hidden = true;
});

document.getElementById("done").addEventListener("click", () => {
  const items = editorValues();
  prompts = items.length ? items : DEFAULT_PROMPTS.slice();
  savePrompts(prompts);
  editor.hidden = true;
  current = null;
  showNext();
});

document.getElementById("restore").addEventListener("click", () => {
  if (confirm("Replace your list with the default prompts? (Nothing is saved until you tap Done.)")) {
    fillEditor(DEFAULT_PROMPTS);
  }
});

copyBtn.addEventListener("click", async () => {
  const text = editorValues().join("\n");
  try {
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = "Copied";
  } catch {
    copyBtn.textContent = "Couldn't copy";
  }
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
const splashHint = document.getElementById("splash-music");
let splashDone = false;

// After the story the splash waits on a big music button. Tapping it turns
// music on (the tap is the gesture iOS needs); tapping anywhere else just
// continues, playing music only if it's already switched on.
splashHint.addEventListener("click", () => setWantMusic(true));

function endSplash() {
  if (splashDone) return;
  splashDone = true;
  splash.classList.add("gone");
  setTimeout(() => splash.remove(), 700);
  showNext();
}

splash.addEventListener("click", endSplash);

// ---- Offline ----

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
