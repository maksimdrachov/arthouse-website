const thirdEyeToggle = document.querySelector("[data-third-eye-toggle]");
const thirdEyeIcon = document.querySelector("[data-third-eye-icon]");

if (thirdEyeToggle) {
  thirdEyeToggle.addEventListener("click", () => {
    const isOpen = thirdEyeToggle.dataset.thirdEyeState === "open";
    const nextState = isOpen ? "closed" : "open";
    thirdEyeToggle.dataset.thirdEyeState = nextState;
    thirdEyeToggle.setAttribute(
      "aria-label",
      isOpen ? "open third eye" : "close third eye"
    );

    if (thirdEyeIcon) {
      thirdEyeIcon.src = isOpen
        ? "/assets/eye_closed.svg"
        : "/assets/eye_open.svg";
    }

    window.dispatchEvent(
      new CustomEvent("third-eye-change", {
        detail: { open: nextState === "open" }
      })
    );
  });
}
