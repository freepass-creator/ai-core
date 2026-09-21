document.querySelectorAll("[data-state-target]").forEach((button) => button.addEventListener("click", () => {
  const target = document.querySelector(".model-state");
  target.dataset.state = button.dataset.stateTarget;
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
