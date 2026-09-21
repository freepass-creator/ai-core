const searchToggle = document.querySelector("#search-toggle");
const searchRegion = document.querySelector("#search-region");
const searchInput = document.querySelector("#product-search");
const rows = [...document.querySelectorAll("[data-item]")];
const state = document.querySelector(".ui-state");
const stateMessages = {
  populated: ["3건을 불러왔습니다.", "목록에서 항목을 선택해 작업을 이어가세요."],
  loading: ["불러오는 중입니다.", "현재 작업 내용은 그대로 유지됩니다."],
  empty: ["표시할 항목이 없습니다.", "검색 조건을 바꾸거나 새 작업을 시작하세요."],
  error: ["정보를 불러오지 못했습니다.", "잠시 후 다시 시도해 주세요."],
};
function setSearchOpen(open) {
  searchRegion.hidden = !open;
  searchToggle.setAttribute("aria-expanded", String(open));
  (open ? searchInput : searchToggle).focus();
}
function filterRows() {
  const query = searchInput.value.trim().toLocaleLowerCase("ko");
  let visible = 0;
  rows.forEach((row) => {
    const item = row.closest("li");
    item.hidden = !item.dataset.search.toLocaleLowerCase("ko").includes(query);
    if (!item.hidden) visible += 1;
  });
  document.querySelector("#result-count").textContent = `${visible}건`;
}
function selectRow(row) {
  rows.forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === row)));
  document.querySelector("#detail-title").textContent = row.dataset.item;
}
function showState(name) {
  const [heading, copy] = stateMessages[name];
  state.dataset.state = name;
  document.querySelector("#state-heading").textContent = heading;
  document.querySelector("#state-copy").textContent = copy;
}
searchToggle.addEventListener("click", () => setSearchOpen(searchRegion.hidden));
document.querySelector("#search-close").addEventListener("click", () => setSearchOpen(false));
searchInput.addEventListener("input", filterRows);
rows.forEach((row) => row.addEventListener("click", () => selectRow(row)));
document.querySelectorAll("[data-show-state]").forEach((button) => button.addEventListener("click", () => showState(button.dataset.showState)));
document.querySelector("#primary-action").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.textContent = "저장 중";
  await new Promise((resolve) => setTimeout(resolve, 500));
  button.textContent = "저장 완료";
  button.removeAttribute("aria-busy");
  button.disabled = false;
});
