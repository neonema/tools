const sourceInput = document.getElementById("source-input");
const previewEl = document.getElementById("preview");
const statusEl = document.getElementById("status");
const copySvgBtn = document.getElementById("copy-svg-btn");
const clearBtn = document.getElementById("clear-btn");

const FENCE_RE = /(?:```|~~~)mermaid[^\n]*\n([\s\S]*?)(?:```|~~~)/gi;

let renderSeq = 0;
let debounceTimer = 0;
let lastSvg = "";

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  theme: "dark",
  fontFamily: "Outfit, system-ui, sans-serif",
  themeVariables: {
    darkMode: true,
    background: "#18211d",
    primaryColor: "#25322d",
    primaryTextColor: "#ffffff",
    primaryBorderColor: "#39d98a",
    lineColor: "#9da7a2",
    secondaryColor: "#111815",
    tertiaryColor: "#0b0f0d",
    mainBkg: "#25322d",
    nodeTextColor: "#ffffff",
    textColor: "#ffffff",
  },
});

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.dataset.state = isError ? "error" : "ok";
}

function extractDiagrams(markdown) {
  const text = markdown.trim();
  if (!text) return [];

  const blocks = [];
  FENCE_RE.lastIndex = 0;
  let match = FENCE_RE.exec(text);
  while (match) {
    const body = match[1].trim();
    if (body) blocks.push(body);
    match = FENCE_RE.exec(text);
  }

  if (blocks.length) return blocks;
  return [text];
}

function showEmpty() {
  lastSvg = "";
  previewEl.innerHTML = `<p class="preview-empty">Diagrams appear here after you paste source.</p>`;
}

async function renderPreview() {
  const seq = ++renderSeq;
  const diagrams = extractDiagrams(sourceInput.value);

  if (!diagrams.length) {
    showEmpty();
    setStatus("");
    return;
  }

  const fragment = document.createDocumentFragment();
  const errors = [];
  lastSvg = "";

  for (let i = 0; i < diagrams.length; i += 1) {
    const wrap = document.createElement("div");
    wrap.className = "preview-frame";
    if (diagrams.length > 1) {
      const caption = document.createElement("p");
      caption.className = "preview-caption";
      caption.textContent = `Diagram ${i + 1}`;
      wrap.appendChild(caption);
    }

    try {
      const { svg } = await mermaid.render(`mermaid-preview-${seq}-${i}`, diagrams[i]);
      if (seq !== renderSeq) return;
      wrap.insertAdjacentHTML("beforeend", svg);
      if (!lastSvg) lastSvg = svg;
    } catch (error) {
      if (seq !== renderSeq) return;
      wrap.classList.add("preview-frame-error");
      const err = document.createElement("pre");
      err.className = "preview-error";
      err.textContent = error?.message || String(error);
      wrap.appendChild(err);
      errors.push(i + 1);
    }

    fragment.appendChild(wrap);
  }

  if (seq !== renderSeq) return;
  previewEl.replaceChildren(fragment);

  if (errors.length && errors.length === diagrams.length) {
    setStatus(
      diagrams.length === 1
        ? "Could not parse this as Mermaid. Wrap diagrams in ```mermaid fences if this is a Markdown file."
        : "None of the Mermaid blocks could be parsed.",
      true,
    );
  } else if (errors.length) {
    setStatus(`Rendered with errors in diagram ${errors.join(", ")}.`, true);
  } else {
    setStatus(
      diagrams.length === 1
        ? "Rendered 1 diagram."
        : `Rendered ${diagrams.length} diagrams.`,
    );
  }
}

function scheduleRender() {
  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    renderPreview();
  }, 220);
}

sourceInput.addEventListener("input", scheduleRender);

clearBtn.addEventListener("click", () => {
  sourceInput.value = "";
  showEmpty();
  setStatus("");
  sourceInput.focus();
});

copySvgBtn.addEventListener("click", async () => {
  if (!lastSvg) {
    setStatus("Nothing to copy yet.", true);
    return;
  }
  try {
    await navigator.clipboard.writeText(lastSvg);
    setStatus("Copied SVG to clipboard.");
  } catch {
    setStatus("Copy failed — select the preview SVG and copy manually.", true);
  }
});
