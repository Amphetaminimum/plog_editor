export function createTextDialog({ backdrop, titleEl, messageEl, inputEl, cancelBtn, confirmBtn }) {
  return function openTextDialog({ title, message = "", initialValue = "", confirmLabel = "OK" }) {
    return new Promise((resolve) => {
      titleEl.textContent = title;
      messageEl.textContent = message;
      inputEl.value = initialValue;
      confirmBtn.textContent = confirmLabel;
      backdrop.classList.remove("hidden");

      let done = false;
      const close = (value) => {
        if (done) return;
        done = true;
        backdrop.classList.add("hidden");
        cancelBtn.removeEventListener("click", onCancel);
        confirmBtn.removeEventListener("click", onConfirm);
        backdrop.removeEventListener("mousedown", onBackdrop);
        inputEl.removeEventListener("keydown", onKeydown);
        resolve(value);
      };

      const onCancel = () => close(null);
      const onConfirm = () => close(inputEl.value);
      const onBackdrop = (ev) => {
        if (ev.target === backdrop) close(null);
      };
      const onKeydown = (ev) => {
        if (ev.key === "Escape") close(null);
        if (ev.key === "Enter") {
          ev.preventDefault();
          close(inputEl.value);
        }
      };

      cancelBtn.addEventListener("click", onCancel);
      confirmBtn.addEventListener("click", onConfirm);
      backdrop.addEventListener("mousedown", onBackdrop);
      inputEl.addEventListener("keydown", onKeydown);

      requestAnimationFrame(() => {
        inputEl.focus();
        inputEl.select();
      });
    });
  };
}
