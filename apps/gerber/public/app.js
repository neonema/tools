const fileInput = document.getElementById("gerber-file");
const fileDrop = document.getElementById("file-drop");
const fileLabel = document.getElementById("file-label");
const statusEl = document.getElementById("status");
const previewEl = document.getElementById("preview");
const downloadBtn = document.getElementById("download-btn");
const clearBtn = document.getElementById("clear-btn");
const shapeHint = document.getElementById("shape-hint");

const EMPTY_PREVIEW = '<p class="preview-empty">The layer appears here.</p>';
const SHAPE_HINTS = {
  outline: "LightBurn follows the line around each pad, including the corners.",
  fill: "Closed pads are solid. In LightBurn, set the layer to Fill or Offset Fill so it cuts the inside instead of the corners.",
};

let requestId = 0;
let svgText = "";
let downloadName = "gerber.svg";
let currentFile = null;

function shapeMode() {
  const selected = document.querySelector('input[name="shape"]:checked');
  return selected && selected.value === "fill" ? "fill" : "outline";
}

function updateShapeHint() {
  shapeHint.textContent = SHAPE_HINTS[shapeMode()];
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  if (isError) statusEl.dataset.state = "error";
  else delete statusEl.dataset.state;
}

function showEmptyPreview() {
  previewEl.innerHTML = EMPTY_PREVIEW;
}

function resetOutput() {
  currentFile = null;
  svgText = "";
  downloadName = "gerber.svg";
  downloadBtn.disabled = true;
  clearBtn.disabled = true;
  fileLabel.textContent = "Choose a Gerber file";
  showEmptyPreview();
}

function mountSvg(markup) {
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== "svg" || root.querySelector("parsererror")) {
    return false;
  }
  root.removeAttribute("width");
  root.removeAttribute("height");
  const box = (root.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
  if (box.length === 4 && box[2] > 0 && box[3] > 0) {
    root.style.aspectRatio = `${box[2]} / ${box[3]}`;
  }
  previewEl.replaceChildren(root);
  return true;
}

async function convertFile(file) {
  const id = ++requestId;
  currentFile = file;
  svgText = "";
  downloadBtn.disabled = true;
  clearBtn.disabled = false;
  fileLabel.textContent = file.name;
  setStatus("Converting…");

  if (Gerber.isJobFile(file.name)) {
    showEmptyPreview();
    setStatus(
      "This is a Gerber job file, not a layer. Choose the paste, copper, mask, silk, or outline file.",
      true,
    );
    return;
  }

  let text = "";
  try {
    text = await file.text();
  } catch {
    if (id !== requestId) return;
    showEmptyPreview();
    setStatus("The file could not be read.", true);
    return;
  }
  if (id !== requestId) return;

  if (!text.trim()) {
    showEmptyPreview();
    setStatus("This file is empty.", true);
    return;
  }

  if (Gerber.looksBinary(text)) {
    showEmptyPreview();
    setStatus("This file is not a text Gerber layer.", true);
    return;
  }

  let svg = "";
  try {
    svg = await Gerber.convertGerber(text, "layer", { fill: shapeMode() === "fill" });
  } catch {
    if (id !== requestId) return;
    showEmptyPreview();
    setStatus("This file could not be converted. Choose a Gerber layer.", true);
    return;
  }
  if (id !== requestId) return;

  if (Gerber.isEmptySvg(svg) || !mountSvg(svg)) {
    showEmptyPreview();
    setStatus(
      "No shapes were found. Choose a Gerber layer such as solder paste, copper, mask, silk, or outline.",
      true,
    );
    return;
  }

  svgText = svg;
  downloadName = Gerber.svgDownloadName(file.name);
  downloadBtn.disabled = false;
  setStatus(`${file.name} is ready.`);
}

function downloadSvg() {
  if (!svgText) return;
  const url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = downloadName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files && fileInput.files[0];
  if (file) convertFile(file);
});

document.querySelectorAll('input[name="shape"]').forEach((input) => {
  input.addEventListener("change", () => {
    updateShapeHint();
    if (currentFile) convertFile(currentFile);
  });
});

clearBtn.addEventListener("click", () => {
  requestId += 1;
  fileInput.value = "";
  resetOutput();
  setStatus("");
});

downloadBtn.addEventListener("click", downloadSvg);

fileDrop.addEventListener("dragover", (event) => {
  event.preventDefault();
  fileDrop.classList.add("is-dragover");
});

fileDrop.addEventListener("dragleave", () => {
  fileDrop.classList.remove("is-dragover");
});

fileDrop.addEventListener("drop", (event) => {
  event.preventDefault();
  fileDrop.classList.remove("is-dragover");
  const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
  if (file) convertFile(file);
});

updateShapeHint();
resetOutput();
