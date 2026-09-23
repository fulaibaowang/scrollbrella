const STORAGE_KEY = "scrollbrella.prompts";
const WINDOWS_KEY = "scrollbrella.timeWindows";
const MUSIC_KEY = "scrollbrella.music";

const DEFAULT_PROMPTS = [
  "Breathe in slowly. Breathe out slower.",
  "Nothing here is urgent.",
  "Look at the sky for a moment.",
  "You don't need to catch up on anything.",
  "Stand up and stretch.",
  "Drink a glass of water.",
  "It's okay to be bored.",
  "Rest is not wasted time.",
  "Put the phone down. It will still be here.",
];

// Time-of-day windows on the phone's clock (hours 0-24; a window may cross
// midnight). Within a window the first prompt after opening comes from it,
// and later ones mix into the pool.
const DEFAULT_WINDOWS = [
  {
    start: 5,
    end: 15,
    prompts: ["What's one thing you'd love to do today?", "Close your eyes: what would make today a good day?"],
  },
  {
    start: 19,
    end: 24,
    prompts: ["What's one thing you're grateful for today?", "Winding down. How was your day?"],
  },
];

function inWindow(w, h) {
  return w.start < w.end ? h >= w.start && h < w.end : h >= w.start || h < w.end;
}

function timePrompts(now = new Date()) {
  const h = now.getHours();
  return timeWindows.filter((w) => inWindow(w, h)).flatMap((w) => w.prompts);
}

// ---- Storage ----

function cleanList(lines) {
  return lines.map((s) => s.trim()).filter(Boolean);
}

function sameList(a, b) {
  return a.length === b.length && a.every((t, i) => t === b[i]);
}

// Earlier releases' default lists. A saved copy of one of these was never
// customised, so it follows the current defaults instead.
const OLD_DEFAULTS = [
  [
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
  ],
  [
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
  ],
];

function loadPrompts() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) {
      const list = cleanList(saved.filter((s) => typeof s === "string"));
      if (list.length && !OLD_DEFAULTS.some((old) => sameList(old, list))) return list;
    }
  } catch {
    // Unreadable or unavailable storage: fall back to defaults.
  }
  return DEFAULT_PROMPTS.slice();
}

// Only a customised list is stored, so unchanged defaults keep following
// new releases.
function savePrompts(list) {
  try {
    if (sameList(list, DEFAULT_PROMPTS)) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Storage blocked; prompts still apply for this session.
  }
  // Ask iOS/browsers not to evict our data under storage pressure.
  navigator.storage?.persist?.().catch(() => {});
}

function sameWindows(a, b) {
  return (
    a.length === b.length &&
    a.every((w, i) => w.start === b[i].start && w.end === b[i].end && sameList(w.prompts, b[i].prompts))
  );
}

function loadWindows() {
  try {
    const saved = JSON.parse(localStorage.getItem(WINDOWS_KEY));
    if (Array.isArray(saved)) {
      return saved
        .filter((w) => Number.isInteger(w?.start) && Number.isInteger(w?.end) && Array.isArray(w.prompts))
        .map((w) => ({ start: w.start, end: w.end, prompts: cleanList(w.prompts.filter((t) => typeof t === "string")) }));
    }
  } catch {
    // Fall back to defaults.
  }
  return structuredClone(DEFAULT_WINDOWS);
}

function saveWindows(windows) {
  try {
    if (sameWindows(windows, DEFAULT_WINDOWS)) localStorage.removeItem(WINDOWS_KEY);
    else localStorage.setItem(WINDOWS_KEY, JSON.stringify(windows));
  } catch {
    // Storage blocked; windows still apply for this session.
  }
}

// ---- Main screen ----

const stage = document.getElementById("stage");
const promptEl = document.getElementById("prompt");
let prompts = loadPrompts();
let timeWindows = loadWindows();
let current = null; // text currently shown; null before the first prompt

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function pickNext() {
  if (current === null && timePrompts().length) return randomFrom(timePrompts());
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

function addItem(text, after = null, focus = true, into = list) {
  const li = makeItem(text);
  if (after) after.after(li);
  else into.append(li);
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

// ---- Time windows in the editor ----

const windowsBox = document.getElementById("window-list");

function hourSelect(value, label) {
  const sel = document.createElement("select");
  sel.className = "hour-select";
  sel.setAttribute("aria-label", label);
  for (let h = 0; h <= 24; h++) {
    const opt = document.createElement("option");
    opt.value = h;
    opt.textContent = `${String(h).padStart(2, "0")}:00`;
    sel.append(opt);
  }
  sel.value = value;
  return sel;
}

function makeWindow(w) {
  const group = document.createElement("div");
  group.className = "window-group";

  const head = document.createElement("div");
  head.className = "window-head";
  const from = hourSelect(w.start, "From");
  const to = hourSelect(w.end, "To");
  const now = document.createElement("span");
  now.className = "window-now";
  const refreshNow = () => {
    now.textContent = inWindow({ start: +from.value, end: +to.value }, new Date().getHours()) ? "now" : "";
  };
  from.addEventListener("change", refreshNow);
  to.addEventListener("change", refreshNow);
  refreshNow();

  const remove = document.createElement("button");
  remove.className = "prompt-remove";
  remove.setAttribute("aria-label", "Delete time window");
  remove.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  remove.addEventListener("click", () => group.remove());

  const fromLabel = document.createElement("span");
  fromLabel.textContent = "From";
  const toLabel = document.createElement("span");
  toLabel.textContent = "to";
  head.append(fromLabel, from, toLabel, to, now, remove);

  const ul = document.createElement("ul");
  ul.className = "prompt-list";
  const add = document.createElement("button");
  add.className = "add-prompt small";
  add.textContent = "+ Add a prompt";
  add.addEventListener("click", () => addItem("", null, true, ul));

  group.append(head, ul, add);
  windowsBox.append(group);
  for (const text of w.prompts) addItem(text, null, false, ul);
  return group;
}

function fillWindows(windows) {
  windowsBox.replaceChildren();
  for (const w of windows) makeWindow(w);
}

function editorWindows() {
  return [...windowsBox.querySelectorAll(".window-group")]
    .map((g) => {
      const [from, to] = g.querySelectorAll(".hour-select");
      return {
        start: Number(from.value),
        end: Number(to.value),
        prompts: cleanList([...g.querySelectorAll(".prompt-input")].map((el) => el.value)),
      };
    })
    .filter((w) => w.prompts.length && w.start % 24 !== w.end % 24);
}

document.getElementById("add-window").addEventListener("click", () => {
  const g = makeWindow({ start: 12, end: 13, prompts: [] });
  g.querySelector(".add-prompt").click();
});

document.getElementById("edit-open").addEventListener("click", () => {
  editor.hidden = false; // visible first so cards can measure their height
  fillEditor(prompts);
  fillWindows(timeWindows);
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
  timeWindows = editorWindows();
  saveWindows(timeWindows);
  editor.hidden = true;
  current = null;
  showNext();
});

document.getElementById("restore").addEventListener("click", () => {
  if (confirm("Replace your prompts and time windows with the defaults? (Nothing is saved until you tap Done.)")) {
    fillEditor(DEFAULT_PROMPTS);
    fillWindows(DEFAULT_WINDOWS);
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
