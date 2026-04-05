export function createTextDialog({ backdrop, titleEl, messageEl, inputEl, fieldsEl, cancelBtn, confirmBtn }) {
  function clearFields() {
    fieldsEl.innerHTML = "";
    fieldsEl.classList.add("hidden");
  }

  function renderFields(fields) {
    clearFields();
    const inputs = [];
    if (!fields?.length) return inputs;

    fieldsEl.classList.remove("hidden");

    fields.forEach((field) => {
      const wrapper = document.createElement("div");
      wrapper.className = "dialog-field";

      const label = document.createElement("label");
      label.textContent = field.label;

      const input = document.createElement("input");
      input.type = field.type || "text";
      input.value = field.initialValue ?? "";
      if (field.placeholder) input.placeholder = field.placeholder;

      wrapper.append(label, input);

      if (field.hint) {
        const hint = document.createElement("p");
        hint.className = "dialog-field-hint";
        hint.textContent = field.hint;
        wrapper.appendChild(hint);
      }

      fieldsEl.appendChild(wrapper);
      inputs.push({ id: field.id, input });
    });

    return inputs;
  }

  function openDialog({
    title,
    message = "",
    initialValue = "",
    confirmLabel = "OK",
    fields = null,
    mapResult = null,
  }) {
    return new Promise((resolve) => {
      titleEl.textContent = title;
      messageEl.textContent = message;
      confirmBtn.textContent = confirmLabel;

      const fieldInputs = renderFields(fields);
      const useFields = fieldInputs.length > 0;
      inputEl.value = initialValue;
      inputEl.classList.toggle("hidden", useFields);
      backdrop.classList.remove("hidden");

      let done = false;
      const activeInputs = useFields ? fieldInputs.map((entry) => entry.input) : [inputEl];

      const collectValue = () => {
        if (!useFields) return inputEl.value;
        const value = {};
        fieldInputs.forEach(({ id, input }) => {
          value[id] = input.value;
        });
        return mapResult ? mapResult(value) : value;
      };

      const close = (value) => {
        if (done) return;
        done = true;
        backdrop.classList.add("hidden");
        clearFields();
        inputEl.classList.remove("hidden");
        cancelBtn.removeEventListener("click", onCancel);
        confirmBtn.removeEventListener("click", onConfirm);
        backdrop.removeEventListener("mousedown", onBackdrop);
        activeInputs.forEach((entry) => entry.removeEventListener("keydown", onKeydown));
        resolve(value);
      };

      const onCancel = () => close(null);
      const onConfirm = () => close(collectValue());
      const onBackdrop = (ev) => {
        if (ev.target === backdrop) close(null);
      };
      const onKeydown = (ev) => {
        if (ev.key === "Escape") close(null);
        if (ev.key === "Enter") {
          ev.preventDefault();
          close(collectValue());
        }
      };

      cancelBtn.addEventListener("click", onCancel);
      confirmBtn.addEventListener("click", onConfirm);
      backdrop.addEventListener("mousedown", onBackdrop);
      activeInputs.forEach((entry) => entry.addEventListener("keydown", onKeydown));

      requestAnimationFrame(() => {
        const firstInput = useFields ? fieldInputs[0]?.input : inputEl;
        firstInput?.focus();
        firstInput?.select?.();
      });
    });
  }

  function openTextDialog({ title, message = "", initialValue = "", confirmLabel = "OK" }) {
    return openDialog({ title, message, initialValue, confirmLabel });
  }

  function openFormDialog({ title, message = "", fields = [], confirmLabel = "OK", mapResult = null }) {
    return openDialog({ title, message, fields, confirmLabel, mapResult });
  }

  return {
    openFormDialog,
    openTextDialog,
  };
}
