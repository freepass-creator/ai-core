export const DATA_STATES = Object.freeze(["loading", "empty", "error", "populated"]);

export function matchesQuery(value, query) {
  return value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}

export function setDataState(surface, state) {
  if (!DATA_STATES.includes(state)) throw new Error(`Unknown data state '${state}'.`);
  surface.dataset.state = state;
  surface.setAttribute("aria-busy", String(state === "loading"));
  for (const view of surface.querySelectorAll("[data-ui-state]")) {
    view.hidden = view.dataset.uiState !== state;
  }
}

export function initializeStarter(root = document) {
  const starter = root.querySelector("[data-ui-starter]");
  if (!starter) return null;

  const toggle = starter.querySelector("[data-search-toggle]");
  const region = starter.querySelector(".ui-search-region");
  const search = starter.querySelector(".ui-search");
  const surface = starter.querySelector("[data-data-surface]");
  const cards = [...starter.querySelectorAll("[data-search-text]")];
  const count = starter.querySelector("[data-result-count]");
  const retry = starter.querySelector("[data-retry]");
  let restorePosition = { x: 0, y: 0 };

  toggle?.addEventListener("click", () => {
    const opening = region.hidden;
    if (opening) {
      restorePosition = { x: window.scrollX, y: window.scrollY };
      region.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
      toggle.textContent = "검색 닫기";
      search.focus();
      return;
    }

    region.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = "검색 열기";
    toggle.focus({ preventScroll: true });
    window.scrollTo(restorePosition.x, restorePosition.y);
  });

  search?.addEventListener("input", () => {
    let visible = 0;
    for (const card of cards) {
      card.hidden = !matchesQuery(card.dataset.searchText ?? card.textContent ?? "", search.value);
      if (!card.hidden) visible += 1;
    }
    count.textContent = `${visible}개 항목`;
    setDataState(surface, visible === 0 ? "empty" : "populated");
  });

  retry?.addEventListener("click", () => {
    setDataState(surface, "loading");
    surface.dispatchEvent(new CustomEvent("ui-starter:retry", { bubbles: true }));
  });

  setDataState(surface, surface.dataset.state);
  return { starter, setDataState: (state) => setDataState(surface, state) };
}

if (typeof document !== "undefined") initializeStarter();
