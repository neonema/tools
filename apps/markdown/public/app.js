(function () {
  const input = document.getElementById("source-input");
  const preview = document.getElementById("preview");
  const status = document.getElementById("status");
  const clearBtn = document.getElementById("clear-btn");

  function showEmpty() {
    preview.replaceChildren();
    const note = document.createElement("p");
    note.className = "preview-empty";
    note.textContent = "The preview appears here.";
    preview.appendChild(note);
  }

  function update() {
    const result = MarkdownPreview.preview(input.value);
    if (result.error) {
      status.dataset.state = "error";
      status.textContent = result.error;
      showEmpty();
      return;
    }
    status.dataset.state = "";
    status.textContent = "";
    if (!result.html) {
      showEmpty();
      return;
    }
    preview.innerHTML = `<div class="md-body">${result.html}</div>`;
  }

  input.addEventListener("input", update);
  clearBtn.addEventListener("click", () => {
    input.value = "";
    update();
    input.focus();
  });

  update();
})();
