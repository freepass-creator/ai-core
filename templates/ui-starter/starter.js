const storageKey = `ai-core-ui-starter:${document.body.dataset.profile}`;
const search = document.querySelector("#product-search");
const searchControls = document.querySelector("#search-controls");
const searchToggle = document.querySelector("[data-search-toggle]");
const note = document.querySelector("#work-note");
const selectionStatus = document.querySelector("[data-selection-status]");
const region = document.querySelector(".ui-work-region");
const cards = [...document.querySelectorAll(".ui-card-list__item")];
const stateNodes = [...document.querySelectorAll("[data-state]")];

function readState() {
  try {
    return JSON.parse(sessionStorage.getItem(storageKey)) ?? {};
  } catch {
    return {};
  }
}

let state = readState();

function persist() {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    /* Keep the current in-memory interaction usable when storage is unavailable. */
  }
}

function showState(name) {
  region.dataset.currentState = name;
  for (const node of stateNodes) node.hidden = node.dataset.state !== name;
}

function applySearch() {
  const query = search.value.trim().toLocaleLowerCase();
  let visible = 0;
  for (const card of cards) {
    card.hidden = !card.dataset.searchText.toLocaleLowerCase().includes(query);
    if (!card.hidden) visible += 1;
  }
  state.query = search.value;
  persist();
  showState(visible ? "populated" : "empty");
}

function applySearchExpanded(expanded, moveFocus = true) {
  searchControls.hidden = !expanded;
  searchToggle.setAttribute("aria-expanded", String(expanded));
  searchToggle.textContent = expanded ? "검색 접기" : "검색 열기";
  state.searchExpanded = expanded;
  persist();
  if (expanded && moveFocus) search.focus();
}

search.value = state.query ?? "";
note.value = state.note ?? "";
selectionStatus.textContent = state.selected ? `선택된 항목: ${state.selected}` : "선택된 항목 없음";
applySearch();
applySearchExpanded(state.searchExpanded !== false, false);

search.addEventListener("input", applySearch);
searchToggle.addEventListener("click", () => {
  applySearchExpanded(searchToggle.getAttribute("aria-expanded") !== "true");
});
note.addEventListener("input", () => {
  state.note = note.value;
  persist();
});

for (const link of document.querySelectorAll("[data-item-id]")) {
  link.addEventListener("click", () => {
    state.selected = link.dataset.itemId;
    selectionStatus.textContent = `선택된 항목: ${state.selected}`;
    persist();
  });
}

document.querySelector("[data-retry]").addEventListener("click", applySearch);

const requestedState = new URLSearchParams(location.search).get("state");
if (["loading", "empty", "error", "populated"].includes(requestedState)) showState(requestedState);
