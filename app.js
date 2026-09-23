const LEGACY_PROMPTS_KEY = "scrollbrella.prompts"; // one flat list, before feelings/actions
const SETS_KEY = "scrollbrella.promptSets";
const WINDOWS_KEY = "scrollbrella.timeWindows";
const LISTS_KEY = "scrollbrella.lists";
const UPDATED_KEY = "scrollbrella.updatedAt"; // when settings last changed on this device
const SYNC_KEY = "scrollbrella.sync"; // {token, gistId, lastSync}

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

// "Things I could do": pre-decided lists (books, series, ...), shown only if
// asked for after a visit, so there's never anything to search for.
const DEFAULT_LISTS = [
  { title: "My books", items: [] },
  { title: "My movies & series", items: [] },
  { title: "My dreams", items: [] },
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

function parseSets(saved) {
  if (!saved || typeof saved !== "object") return null;
  const sets = { feel: strings(saved.feel), act: strings(saved.act) };
  return sets.feel.length || sets.act.length ? sets : null;
}

function loadSets() {
  try {
    const sets = parseSets(JSON.parse(localStorage.getItem(SETS_KEY)));
    if (sets) return sets;
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

function parseWindows(saved) {
  if (!Array.isArray(saved)) return null;
  return saved
    .filter((w) => Number.isInteger(w?.start) && Number.isInteger(w?.end) && Array.isArray(w.prompts))
    .map((w) => ({ start: w.start, end: w.end, prompts: strings(w.prompts) }));
}

function loadWindows() {
  try {
    const windows = parseWindows(JSON.parse(localStorage.getItem(WINDOWS_KEY)));
    if (windows) return windows;
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

function parseLists(saved) {
  if (Array.isArray(saved)) {
    return saved
      .filter((l) => typeof l?.title === "string")
      .map((l) => ({ title: l.title.trim() || "Untitled", items: strings(l.items) }));
  }
  if (saved && typeof saved === "object") {
    // First version stored three fixed lists by key.
    return [
      { title: "My books", items: strings(saved.books) },
      { title: "My movies & series", items: strings(saved.shows) },
      { title: "My dreams", items: strings(saved.dreams) },
    ];
  }
  return null;
}

function loadLists() {
  try {
    const lists = parseLists(JSON.parse(localStorage.getItem(LISTS_KEY)));
    if (lists) return lists;
  } catch {
    // Start from the defaults.
  }
  return structuredClone(DEFAULT_LISTS);
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

// ---- Things I could do ----
// A sheet that shows the pre-decided lists; ✎ Edit edits them in place,
// including adding, renaming and deleting whole lists.

const listsSheet = document.getElementById("lists");
const listsView = document.getElementById("lists-view");
const listsViewButtons = document.getElementById("lists-view-buttons");
const listsEditButtons = document.getElementById("lists-edit-buttons");

function renderListsView() {
  listsView.replaceChildren();
  for (const { title, items } of lists) {
    const box = document.createElement("div");
    box.className = "set";
    const h = document.createElement("h3");
    h.textContent = title;
    box.append(h);
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "Nothing here yet. Tap ✎ Edit to add some.";
      box.append(empty);
    }
    for (const text of items) {
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

function makeListEditor(list) {
  const group = document.createElement("div");
  group.className = "window-group";

  const head = document.createElement("div");
  head.className = "window-head";
  const title = document.createElement("input");
  title.className = "list-title";
  title.value = list.title;
  title.placeholder = "List name";
  title.setAttribute("aria-label", "List name");
  const remove = document.createElement("button");
  remove.className = "prompt-remove";
  remove.setAttribute("aria-label", "Delete list");
  remove.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  remove.addEventListener("click", () => group.remove());
  head.append(title, remove);

  const ul = document.createElement("ul");
  ul.className = "prompt-list";
  const add = document.createElement("button");
  add.className = "add-prompt small";
  add.textContent = "+ Add an item";
  add.addEventListener("click", () => addItem("", null, true, ul));

  group.append(head, ul, add);
  return { group, ul };
}

// Builds the list editors (used by the sheet and by the main editor).
function fillListEditors(container, source) {
  container.replaceChildren();
  const box = document.createElement("div");
  box.className = "lists-edit-box";
  container.append(box);
  for (const list of source) {
    const { group, ul } = makeListEditor(list);
    box.append(group);
    for (const text of list.items) addItem(text, null, false, ul);
  }
  const addList = document.createElement("button");
  addList.className = "add-prompt";
  addList.textContent = "+ Add a list";
  addList.addEventListener("click", () => {
    const { group } = makeListEditor({ title: "", items: [] });
    box.append(group);
    group.querySelector(".list-title").focus();
  });
  container.append(addList);
}

function editedLists(container) {
  return [...container.querySelectorAll(".lists-edit-box > .window-group")]
    .map((g) => ({
      title: g.querySelector(".list-title").value.trim(),
      items: listValues(g.querySelector("ul")),
    }))
    .filter((l) => l.title || l.items.length)
    .map((l) => ({ title: l.title || "Untitled", items: l.items }));
}

function setListsMode(editing) {
  listsViewButtons.hidden = editing;
  listsEditButtons.hidden = !editing;
  if (editing) fillListEditors(listsView, lists);
  else renderListsView();
  listsView.scrollTop = 0;
}

listsOpen.addEventListener("click", () => {
  setListsMode(false);
  listsSheet.hidden = false;
});

document.getElementById("lists-close").addEventListener("click", () => {
  listsSheet.hidden = true;
});

document.getElementById("lists-edit").addEventListener("click", () => setListsMode(true));
document.getElementById("lists-cancel").addEventListener("click", () => setListsMode(false));
document.getElementById("lists-done").addEventListener("click", () => {
  lists = editedLists(listsView);
  saveLists(lists);
  markChanged();
  setListsMode(false);
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
const editLists = document.getElementById("edit-lists");

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
  clearTimeout(advanceTimer); // hold the current prompt while editing
  editor.hidden = false; // visible first so cards can measure their height
  fillEditor(prompts);
  fillWindows(timeWindows);
  fillListEditors(editLists, lists);
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
  lists = editedLists(editLists);
  saveLists(lists);
  markChanged();
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

// ---- Sync across devices (GitHub Gist) ----
// Optional and just for fun: settings are mirrored to a secret Gist using a
// personal access token (Gists: read & write only) pasted on each device.
// Whichever side changed most recently wins.

const GIST_FILE = "scrollbrella-settings.json";
const syncOff = document.getElementById("sync-off");
const syncOn = document.getElementById("sync-on");
const syncStatus = document.getElementById("sync-status");
const syncToken = document.getElementById("sync-token");
let sync = null;
let syncing = false;
let syncTimer = null;

try {
  sync = JSON.parse(localStorage.getItem(SYNC_KEY));
} catch {}

function saveSync() {
  try {
    if (sync) localStorage.setItem(SYNC_KEY, JSON.stringify(sync));
    else localStorage.removeItem(SYNC_KEY);
  } catch {}
}

function localUpdatedAt() {
  try {
    return Number(localStorage.getItem(UPDATED_KEY)) || 0;
  } catch {
    return 0;
  }
}

function markChanged() {
  try {
    localStorage.setItem(UPDATED_KEY, String(Date.now()));
  } catch {}
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncNow, 800);
}

function snapshot() {
  return { app: "scrollbrella", version: 1, updatedAt: localUpdatedAt(), promptSets: prompts, timeWindows, lists };
}

async function gh(path, options = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${sync.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!res.ok) throw Object.assign(new Error(`GitHub ${res.status}`), { status: res.status });
  return res.json();
}

async function findGist() {
  for (let page = 1; page <= 5; page++) {
    const gists = await gh(`/gists?per_page=100&page=${page}`);
    const match = gists.find((g) => g.files?.[GIST_FILE]);
    if (match) return match.id;
    if (gists.length < 100) break;
  }
  return null;
}

async function readGist(id) {
  const gist = await gh(`/gists/${id}`);
  return JSON.parse(gist.files[GIST_FILE].content);
}

async function writeGist(id, data) {
  const files = { [GIST_FILE]: { content: JSON.stringify(data, null, 2) } };
  if (id) return gh(`/gists/${id}`, { method: "PATCH", body: JSON.stringify({ files }) });
  return gh("/gists", {
    method: "POST",
    body: JSON.stringify({ description: "Scrollbrella settings (synced by the app)", public: false, files }),
  });
}

// Replace local settings with the Gist's copy.
function applyRemote(remote) {
  prompts = parseSets(remote.promptSets) || cloneSets(DEFAULT_SETS);
  timeWindows = parseWindows(remote.timeWindows) || structuredClone(DEFAULT_WINDOWS);
  lists = parseLists(remote.lists) || structuredClone(DEFAULT_LISTS);
  saveSets(prompts);
  saveWindows(timeWindows);
  saveLists(lists);
  try {
    localStorage.setItem(UPDATED_KEY, String(remote.updatedAt));
  } catch {}
}

function renderSync(message) {
  const connected = Boolean(sync?.token);
  syncOff.hidden = connected;
  syncOn.hidden = !connected;
  if (!connected) return;
  syncStatus.replaceChildren();
  const when = sync.lastSync
    ? new Date(sync.lastSync).toLocaleString([], { dateStyle: "short", timeStyle: "short" })
    : "not yet";
  syncStatus.append(message || `Synced ${when}`);
  if (sync.gistId) {
    const link = document.createElement("a");
    link.href = `https://gist.github.com/${sync.gistId}`;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "view Gist";
    syncStatus.append(" · ", link);
  }
}

// Returns true when the Gist's settings replaced the local ones.
async function syncNow() {
  if (!sync?.token || syncing || !navigator.onLine) return false;
  syncing = true;
  let applied = false;
  renderSync("Syncing…");
  try {
    if (!sync.gistId) sync.gistId = await findGist();
    if (!sync.gistId) {
      sync.gistId = (await writeGist(null, snapshot())).id;
    } else {
      let remote;
      try {
        remote = await readGist(sync.gistId);
      } catch (err) {
        if (err.status !== 404) throw err;
        sync.gistId = (await writeGist(null, snapshot())).id; // Gist was deleted: start a new one
      }
      if (remote) {
        const theirs = Number(remote.updatedAt) || 0;
        const ours = localUpdatedAt();
        if (theirs > ours) {
          applyRemote(remote);
          applied = true;
        } else if (ours > theirs) {
          await writeGist(sync.gistId, snapshot());
        }
      }
    }
    sync.lastSync = Date.now();
    saveSync();
    renderSync();
  } catch (err) {
    renderSync(err.status === 401 || err.status === 403 ? "GitHub rejected the token" : "Couldn't reach GitHub");
  } finally {
    syncing = false;
  }
  return applied;
}

// Sync quietly in the background, but never under the user's fingers.
async function backgroundSync() {
  if (!editor.hidden || !listsSheet.hidden) return;
  if ((await syncNow()) && splashDone && step < 3) restartVisit();
}

document.getElementById("sync-connect").addEventListener("click", async () => {
  const token = syncToken.value.trim();
  if (!token) return syncToken.focus();
  sync = { token, gistId: null, lastSync: 0 };
  saveSync();
  syncToken.value = "";
  if (await syncNow()) {
    fillEditor(prompts);
    fillWindows(timeWindows);
    fillListEditors(editLists, lists);
  }
});

document.getElementById("sync-now").addEventListener("click", async () => {
  if (await syncNow()) {
    fillEditor(prompts);
    fillWindows(timeWindows);
    fillListEditors(editLists, lists);
  }
});

document.getElementById("sync-disconnect").addEventListener("click", () => {
  if (!confirm("Stop syncing on this device? Your settings and the Gist stay as they are.")) return;
  sync = null;
  saveSync();
  renderSync();
});

renderSync();

// ---- Music ----
// Music only starts from an explicit choice: the big circle on the splash or
// the note button (iOS also requires a tap). Tapping elsewhere never starts it.

const music = document.getElementById("music");
const musicBtn = document.getElementById("music-toggle");
let resumeOnReturn = false;

function renderMusicBtn() {
  const playing = !music.paused;
  musicBtn.setAttribute("aria-pressed", String(playing));
  musicBtn.setAttribute("aria-label", playing ? "Pause music" : "Play music");
}

function playMusic() {
  music.play().catch(() => {});
}

music.addEventListener("play", renderMusicBtn);
music.addEventListener("pause", renderMusicBtn);

musicBtn.addEventListener("click", () => {
  if (music.paused) playMusic();
  else music.pause();
});

// iOS often keeps the app alive in the background; coming back after a
// while starts a fresh visit instead of the dimmed closing screen.
const AWAY_RESET_MS = 60 * 1000;
let hiddenAt = 0;

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    resumeOnReturn = !music.paused;
    music.pause();
    return;
  }
  if (resumeOnReturn) playMusic();
  backgroundSync();
  if (splashDone && editor.hidden && listsSheet.hidden && Date.now() - hiddenAt > AWAY_RESET_MS) restartVisit();
});

renderMusicBtn();

// ---- Splash (once per launch) ----

const splash = document.getElementById("splash");
const splashHint = document.getElementById("splash-music");
let splashDone = false;

// After the story the splash waits on a big music button. Tapping it starts
// the music and continues; tapping anywhere else continues in silence.
splashHint.addEventListener("click", playMusic);

function endSplash() {
  if (splashDone) return;
  splashDone = true;
  splash.classList.add("gone");
  setTimeout(() => splash.remove(), 700);
  showNext();
}

splash.addEventListener("click", endSplash);

// ---- Startup sync ----

backgroundSync();

// ---- Offline ----

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
