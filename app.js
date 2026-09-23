const LEGACY_PROMPTS_KEY = "scrollbrella.prompts"; // one flat list, before feelings/actions
const SETS_KEY = "scrollbrella.promptSets";
const WINDOWS_KEY = "scrollbrella.timeWindows";
const MUSIC_KEY = "scrollbrella.music";
const LISTS_KEY = "scrollbrella.lists";

// Each visit shows one feeling, then one small moment ("act"), then the
// closing line. Feelings come first: it's fine to do nothing at all.
const DEFAULT_SETS = {
  feel: [
    "Nothing here is urgent.",
    "You don't need to catch up on anything.",
    "It's okay to be bored.",
    "Rest is not wasted time.",
    "You don't have to replace this with anything.",
    "The urge will pass. Let it.",
  ],
  act: [
    "Breathe in slowly. Breathe out slower.",
    "Look at the sky for a moment.",
    "Stand up and stretch.",
    "Drink a glass of water.",
  ],
};

const CLOSING = "Put the phone down. It will still be here.";

// "Things I could do": pre-decided options, shown only if asked for after a
// visit, so there's never anything to search for.
const LIST_KINDS = [
  { key: "books", title: "My books", add: "+ Add a book" },
  { key: "shows", title: "My movies & series", add: "+ Add a movie or series" },
  { key: "dreams", title: "My dreams", add: "+ Add a dream" },
];

// Time-of-day windows on the phone's clock (hours 0-24; a window may cross
// midnight). Their prompts join the small moments while the window is active.
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

// Default flat lists from before feelings/actions. A saved copy of one of
// these was never customised, so it follows the current defaults.
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
  [
    "Breathe in slowly. Breathe out slower.",
    "Nothing here is urgent.",
    "Look at the sky for a moment.",
    "You don't need to catch up on anything.",
    "Stand up and stretch.",
    "Drink a glass of water.",
    "It's okay to be bored.",
    "Rest is not wasted time.",
    "Put the phone down. It will still be here.",
  ],
];

// Old default prompts that are actions, for sorting a customised flat list.
const KNOWN_ACTIONS = new Set([
  "Breathe in slowly. Breathe out slower.",
  "Look out a window for a moment.",
  "Look at the sky for a moment.",
  "Unclench your jaw. Drop your shoulders.",
  "Stand up and stretch.",
  "Drink a glass of water.",
  "Notice three sounds around you.",
  "Listen for the trees, the leaves, the wind.",
]);

function cloneSets(sets) {
  return { feel: sets.feel.slice(), act: sets.act.slice() };
}

function strings(list) {
  return Array.isArray(list) ? cleanList(list.filter((t) => typeof t === "string")) : [];
}

function loadSets() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETS_KEY));
    if (saved && typeof saved === "object") {
      const sets = { feel: strings(saved.feel), act: strings(saved.act) };
      if (sets.feel.length || sets.act.length) return sets;
    }
    // Migrate a customised flat list from before feelings/actions.
    const legacy = strings(JSON.parse(localStorage.getItem(LEGACY_PROMPTS_KEY)));
    if (legacy.length && !OLD_DEFAULTS.some((old) => sameList(old, legacy))) {
      return {
        feel: legacy.filter((t) => !KNOWN_ACTIONS.has(t)),
        act: legacy.filter((t) => KNOWN_ACTIONS.has(t)),
      };
    }
  } catch {
    // Unreadable or unavailable storage: fall back to defaults.
  }
  return cloneSets(DEFAULT_SETS);
}

// Only customised sets are stored, so unchanged defaults keep following
// new releases.
function saveSets(sets) {
  try {
    if (sameList(sets.feel, DEFAULT_SETS.feel) && sameList(sets.act, DEFAULT_SETS.act)) {
      localStorage.removeItem(SETS_KEY);
    } else {
      localStorage.setItem(SETS_KEY, JSON.stringify(sets));
    }
    localStorage.removeItem(LEGACY_PROMPTS_KEY);
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

function loadLists() {
  const lists = { books: [], shows: [], dreams: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(LISTS_KEY));
    for (const { key } of LIST_KINDS) lists[key] = strings(saved?.[key]);
  } catch {
    // Start empty.
  }
  return lists;
}

function saveLists(lists) {
  try {
    localStorage.setItem(LISTS_KEY, JSON.stringify(lists));
  } catch {
    // Storage blocked; lists still apply for this session.
  }
}

// ---- Main screen ----

const stage = document.getElementById("stage");
const promptEl = document.getElementById("prompt");
let prompts = loadSets();
let timeWindows = loadWindows();
let lists = loadLists();

// A visit is short on purpose, the opposite of a feed:
// feeling (0 s) -> small moment (15 s) -> closing line (30 s) -> dim (40 s).
// A tap skips ahead. Tapping after the visit shows a heart ("it's okay to do
// nothing") and a tiny link to the pre-decided lists; nothing else wakes up.
const ADVANCE_MS = 15 * 1000;
const DIM_AFTER_MS = 10 * 1000;
let step = 0;
let dimTimer = null;
let advanceTimer = null;

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function nextText() {
  while (step < 3) {
    step++;
    if (step === 1 && prompts.feel.length) return randomFrom(prompts.feel);
    if (step === 2) {
      const pool = [...prompts.act, ...timePrompts()];
      if (pool.length) return randomFrom(pool);
    }
    if (step === 3) return CLOSING;
  }
  return null; // finished: taps do nothing
}

function showText(text) {
  promptEl.classList.remove("shown");
  const fadeMs = promptEl.textContent ? 700 : 0;
  setTimeout(() => {
    promptEl.textContent = text;
    promptEl.classList.add("shown");
  }, fadeMs);
}

function scheduleAdvance() {
  clearTimeout(advanceTimer);
  if (step < 3) advanceTimer = setTimeout(showNext, ADVANCE_MS);
}

const rest = document.getElementById("rest");
const listsOpen = document.getElementById("lists-open");

function showRest() {
  clearTimeout(dimTimer);
  document.body.classList.add("dim");
  promptEl.classList.remove("shown");
  if (!rest.hidden) {
    // Already resting: the heart just beats once more.
    rest.classList.remove("beat");
    void rest.offsetWidth;
    rest.classList.add("beat");
    return;
  }
  setTimeout(() => {
    promptEl.hidden = true;
    rest.hidden = false;
    rest.classList.add("beat");
    listsOpen.hidden = false;
  }, 700);
}

function showNext() {
  if (step >= 3) return showRest();
  const text = nextText();
  if (text === null) return;
  showText(text);
  scheduleAdvance();
  if (step === 3) dimTimer = setTimeout(() => document.body.classList.add("dim"), DIM_AFTER_MS);
}

function restartVisit() {
  clearTimeout(dimTimer);
  clearTimeout(advanceTimer);
  rest.hidden = true;
  promptEl.hidden = false;
  listsOpen.hidden = true;
  document.body.classList.remove("dim");
  step = 0;
  showNext();
}

stage.addEventListener("click", showNext);

// ---- Things I could do (view) ----

const listsSheet = document.getElementById("lists");
const listsView = document.getElementById("lists-view");

function renderListsView() {
  listsView.replaceChildren();
  for (const { key, title } of LIST_KINDS) {
    const box = document.createElement("div");
    box.className = "set";
    const h = document.createElement("h3");
    h.textContent = title;
    box.append(h);
    if (!lists[key].length) {
      const empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "Nothing here yet. Add some with ✎ (bottom right).";
      box.append(empty);
    }
    for (const text of lists[key]) {
      const item = document.createElement("p");
      item.className = "list-card";
      item.textContent = text;
      box.append(item);
    }
    listsView.append(box);
  }
  const sit = document.createElement("p");
  sit.className = "hint tip";
  sit.textContent = "Or just sit a little longer. That's enough too.";
  listsView.append(sit);
}

listsOpen.addEventListener("click", () => {
  renderListsView();
  listsSheet.hidden = false;
  listsView.scrollTop = 0;
});

document.getElementById("lists-close").addEventListener("click", () => {
  listsSheet.hidden = true;
});

// ---- Editor ----
// One card per prompt. Edits stay in the cards until Done; Cancel discards.

const editor = document.getElementById("editor");
const feelList = document.getElementById("feel-list");
const actList = document.getElementById("act-list");
const countEl = document.getElementById("prompt-count");
const copyBtn = document.getElementById("copy");

function autoGrow(input) {
  input.style.height = "auto";
  input.style.height = `${input.scrollHeight}px`;
}

function listValues(ul) {
  return cleanList([...ul.querySelectorAll(".prompt-input")].map((el) => el.value));
}

function editorSets() {
  return { feel: listValues(feelList), act: listValues(actList) };
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function updateCount() {
  const { feel, act } = editorSets();
  countEl.textContent = `${plural(feel.length, "feeling")} · ${plural(act.length, "small moment")}`;
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

function addItem(text, after = null, focus = true, into = feelList) {
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

function fillEditor(sets) {
  feelList.replaceChildren();
  actList.replaceChildren();
  for (const text of sets.feel) addItem(text, null, false, feelList);
  for (const text of sets.act) addItem(text, null, false, actList);
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

// ---- "Things I could do" lists in the editor ----

const editLists = document.getElementById("edit-lists");

function fillEditLists(source) {
  editLists.replaceChildren();
  for (const { key, title, add } of LIST_KINDS) {
    const group = document.createElement("div");
    group.className = "window-group";
    const head = document.createElement("p");
    head.className = "window-head";
    head.textContent = title;
    const ul = document.createElement("ul");
    ul.className = "prompt-list";
    ul.dataset.list = key;
    const btn = document.createElement("button");
    btn.className = "add-prompt small";
    btn.textContent = add;
    btn.addEventListener("click", () => addItem("", null, true, ul));
    group.append(head, ul, btn);
    editLists.append(group);
    for (const text of source[key]) addItem(text, null, false, ul);
  }
}

function editorLists() {
  const out = {};
  for (const ul of editLists.querySelectorAll("ul[data-list]")) out[ul.dataset.list] = listValues(ul);
  return out;
}

document.getElementById("add-window").addEventListener("click", () => {
  const g = makeWindow({ start: 12, end: 13, prompts: [] });
  g.querySelector(".add-prompt").click();
});

document.getElementById("edit-open").addEventListener("click", () => {
  clearTimeout(advanceTimer); // hold the current prompt while editing
  editor.hidden = false; // visible first so cards can measure their height
  fillEditor(prompts);
  fillWindows(timeWindows);
  fillEditLists(lists);
  editor.querySelector(".editor-scroll").scrollTop = 0;
});

document.getElementById("add-feel").addEventListener("click", () => addItem("", null, true, feelList));
document.getElementById("add-act").addEventListener("click", () => addItem("", null, true, actList));

document.getElementById("cancel").addEventListener("click", () => {
  editor.hidden = true;
  if (splashDone && step < 3) scheduleAdvance();
});

document.getElementById("done").addEventListener("click", () => {
  const sets = editorSets();
  prompts = sets.feel.length || sets.act.length ? sets : cloneSets(DEFAULT_SETS);
  saveSets(prompts);
  timeWindows = editorWindows();
  saveWindows(timeWindows);
  lists = editorLists();
  saveLists(lists);
  editor.hidden = true;
  restartVisit();
});

document.getElementById("restore").addEventListener("click", () => {
  if (confirm("Replace your prompts and time windows with the defaults? Your lists stay as they are. (Nothing is saved until you tap Done.)")) {
    fillEditor(DEFAULT_SETS);
    fillWindows(DEFAULT_WINDOWS);
  }
});

copyBtn.addEventListener("click", async () => {
  const { feel, act } = editorSets();
  const text = `${feel.join("\n")}\n\n${act.join("\n")}`;
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
  if (e.target.closest("#music-toggle, #editor, #lists")) return;
  playIfWanted();
});

// iOS often keeps the app alive in the background; coming back after a
// while starts a fresh visit instead of the dimmed closing screen.
const AWAY_RESET_MS = 60 * 1000;
let hiddenAt = 0;

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    music.pause();
    return;
  }
  playIfWanted();
  if (splashDone && editor.hidden && listsSheet.hidden && Date.now() - hiddenAt > AWAY_RESET_MS) restartVisit();
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
