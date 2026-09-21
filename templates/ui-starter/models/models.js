const page = document.querySelector("[data-model]");
const main = document.querySelector('[data-region="main"]');
const stateBox = document.querySelector(".model-state");
if (page && main && stateBox && !document.querySelector(".model-state-switch")) {
  main.insertAdjacentHTML("beforeend", `<div class="model-state-switch" aria-label="화면 상태 미리보기">
    <button class="ui-button secondary" data-state-target="loading" data-state-label="불러오는 중입니다">로딩</button>
    <button class="ui-button secondary" data-state-target="empty" data-state-label="표시할 내용이 없습니다">빈 상태</button>
    <button class="ui-button secondary" data-state-target="error" data-state-label="내용을 불러오지 못했습니다">오류</button>
    <button class="ui-button secondary" data-state-target="populated" data-state-label="최신 내용을 표시하고 있습니다">데이터</button>
  </div>`);
}
document.querySelectorAll("[data-state-target]").forEach((button) => button.addEventListener("click", () => {
  const state = button.dataset.stateTarget;
  const target = document.querySelector(".model-state");
  page.dataset.previewState = state;
  main.setAttribute("aria-busy", String(state === "loading"));
  document.querySelectorAll("[data-state-target]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
  target.dataset.state = state;
  target.hidden = false;
  target.querySelector("strong").textContent = button.dataset.stateLabel;
}));
document.querySelectorAll("[data-choice]").forEach((button) => button.addEventListener("click", () => {
  if (button.dataset.multiple === "true") button.setAttribute("aria-pressed", String(button.getAttribute("aria-pressed") !== "true"));
  else {
    button.closest("[role=group]").querySelectorAll("[data-choice]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    if (button.closest("[data-auto-next]")) {
      const message = document.querySelector(".model-state strong");
      if (message) message.textContent = `${button.querySelector("b").textContent} 선택 · 다음 단계로 이동합니다`;
      document.querySelector("[data-step-next]")?.click();
    }
  }
}));
document.querySelector("[data-step-next]")?.addEventListener("click", () => {
  const title = document.querySelector("h1");
  if (title) title.textContent = "다음 조건 선택";
});
document.querySelectorAll("[data-busy]").forEach((button) => button.addEventListener("click", async () => {
  button.disabled = true; button.setAttribute("aria-busy", "true"); const label = button.textContent; button.textContent = "처리 중";
  await new Promise((resolve) => setTimeout(resolve, 500)); button.textContent = label; button.disabled = false; button.removeAttribute("aria-busy");
}));
