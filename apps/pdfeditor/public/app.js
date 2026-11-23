// PDF.js is the legacy build: it adds the newest JavaScript built-ins when a browser lacks
// them, so pages still draw in browsers that are a release or two behind. The folder is
// named for the version, so a cached viewer is never paired with a newer worker.
const PDFJS_DIR = new URL("./vendor/pdfjs-6.5.438/", import.meta.url);
const VIEWER_UNAVAILABLE = "This browser can't run the PDF viewer. Update the browser, then reload this page.";

let pdfjs = null;
const pdfjsReady = import(new URL("pdf.min.js", PDFJS_DIR).href).then(
  (module) => {
    module.GlobalWorkerOptions.workerSrc = new URL("pdf.worker.min.js", PDFJS_DIR).href;
    pdfjs = module;
    return module;
  },
  (error) => {
    console.error("The PDF viewer did not load.", error);
    return null;
  },
);

const fileInput = document.getElementById("pdf-file");
const fileDrop = document.getElementById("file-drop");
const fileLabel = document.getElementById("file-label");
const statusEl = document.getElementById("status");
const viewer = document.getElementById("viewer");
const prevBtn = document.getElementById("prev-page");
const nextBtn = document.getElementById("next-page");
const pageLabel = document.getElementById("page-label");
const imageInput = document.getElementById("image-file");
const stageScroll = document.getElementById("stage-scroll");
const canvas = document.getElementById("page-canvas");
const overlays = document.getElementById("overlays");
const editHint = document.getElementById("edit-hint");
const downloadBtn = document.getElementById("download-btn");
const clearBtn = document.getElementById("clear-btn");

let requestId = 0;
let sourceBytes = null;
let sourceName = "document.pdf";
let snapshot = [];
let boxes = [];
let pageSizes = [];
let pageCount = 0;
let pageIndex = 0;
let pdfjsDoc = null;
let loadingTask = null;
let renderToken = 0;
let renderQueue = Promise.resolve();
let currentViewport = null;
let renderedPage = -1;
let renderedScale = 0;
let renderedWidth = 0;
// Page text that can be clicked and changed: runs per page index, and edits by run key.
let textRuns = new Map();
let textEdits = new Map();
// Pictures placed on pages, in PDF user space, with their prepared PNG.
let images = [];
let imageCounter = 0;
const measureContext = document.createElement("canvas").getContext("2d");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  if (isError) statusEl.dataset.state = "error";
  else delete statusEl.dataset.state;
}

function cloneBoxes(list) {
  return list.map((box) => ({ ...box }));
}

function resetView() {
  sourceBytes = null;
  sourceName = "document.pdf";
  snapshot = [];
  boxes = [];
  textRuns = new Map();
  textEdits = new Map();
  forgetImages();
  resetFind();
  resetHistory();
  pageSizes = [];
  pageCount = 0;
  pageIndex = 0;
  currentViewport = null;
  renderedPage = -1;
  renderedScale = 0;
  renderedWidth = 0;
  viewer.hidden = true;
  overlays.replaceChildren();
  downloadBtn.disabled = true;
  clearBtn.disabled = true;
  fileLabel.textContent = "Choose a PDF";
  pageLabel.textContent = "";
  editHint.textContent = "";
}

// The loading task owns the document and its worker. Destroying it stops the worker, so
// opening another PDF does not leave the previous one running.
async function closeDocument() {
  renderToken += 1;
  const task = loadingTask;
  loadingTask = null;
  pdfjsDoc = null;
  if (!task) return;
  try {
    await task.destroy();
  } catch {
    /* Ignore a task that is already destroyed. */
  }
}

function pdfRectToCss(rect, viewport) {
  const [x1, y1] = viewport.convertToViewportPoint(rect.x, rect.y);
  const [x2, y2] = viewport.convertToViewportPoint(rect.x + rect.width, rect.y + rect.height);
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

function cssBoxToPdf(css, viewport) {
  const [x1, y1] = viewport.convertToPdfPoint(css.left, css.top);
  const [x2, y2] = viewport.convertToPdfPoint(css.left + css.width, css.top + css.height);
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.max(8, Math.abs(x2 - x1)),
    height: Math.max(8, Math.abs(y2 - y1)),
  };
}

function clampCss(css, viewport) {
  const width = Math.min(Math.max(16, css.width), viewport.width);
  const height = Math.min(Math.max(12, css.height), viewport.height);
  return {
    left: Math.min(Math.max(0, css.left), Math.max(0, viewport.width - width)),
    top: Math.min(Math.max(0, css.top), Math.max(0, viewport.height - height)),
    width,
    height,
  };
}

function place(element, css) {
  element.style.left = `${css.left}px`;
  element.style.top = `${css.top}px`;
  element.style.width = `${css.width}px`;
  element.style.height = `${css.height}px`;
}

function updatePageChrome() {
  pageLabel.textContent = pageCount ? `Page ${pageIndex + 1} of ${pageCount}` : "";
  prevBtn.disabled = pageIndex <= 0;
  nextBtn.disabled = pageIndex >= pageCount - 1;
  editHint.textContent = pageCount
    ? "Edit this PDF."
    : "";
}

function cssColor(rgb) {
  return `rgb(${rgb.map((value) => Math.round(value * 255)).join(", ")})`;
}

// The PDF's own embedded font, as PDF.js loaded it, comes first, so typing shows the real
// letters. The face is already bold or italic, so no weight or slant is added on top of it.
// Letters the font doesn't have fall back to the closest standard family, as they will on save.
function cssFont(run, sizePx) {
  const family =
    run.family === "serif"
      ? '"Times New Roman", Times, serif'
      : run.family === "mono"
        ? '"Courier New", Courier, monospace'
        : "Helvetica, Arial, sans-serif";
  if (run.fontFace) return `400 ${sizePx}px "${run.fontFace}", ${family}`;
  return `${run.italic ? "italic " : ""}${run.bold ? "700 " : "400 "}${sizePx}px ${family}`;
}

const SAVE_NOTES = {
  borrowed: "This PDF's font for this text doesn't include every letter you typed. Those letters come from the same typeface elsewhere in the file, matched to this weight and width.",
  mixed: "Some letters you typed aren't in this PDF's fonts. Only those letters use a similar standard font; the rest keep the original font.",
  removed: "Some of these letters aren't in this PDF's font, so this change uses a similar standard font.",
  missing: "This text can't be removed from the file, so it can't be changed here. Revert it to download.",
  unsupported: "Some of these characters aren't in this PDF's font or in any standard PDF font, so this change can't be saved. Remove them to download.",
};

// Reads the background and text colour of a run from the drawn page, so the edit covers the
// original with the same background and draws the new text in the same colour.
function sampleRunColors(rect, viewport) {
  const fallback = { background: [1, 1, 1], color: [0, 0, 0] };
  try {
    const css = pdfRectToCss(rect, viewport);
    const k = canvas.width / (canvas.clientWidth || canvas.width);
    const x = Math.max(0, Math.floor(css.left * k));
    const y = Math.max(0, Math.floor(css.top * k));
    const w = Math.min(canvas.width - x, Math.ceil(css.width * k));
    const h = Math.min(canvas.height - y, Math.ceil(css.height * k));
    if (w < 2 || h < 2) return fallback;
    const data = canvas.getContext("2d").getImageData(x, y, w, h).data;
    const at = (px, py) => {
      const i = (py * w + px) * 4;
      return [data[i], data[i + 1], data[i + 2]];
    };
    const edge = [];
    for (let px = 0; px < w; px += 1) edge.push(at(px, 0), at(px, h - 1));
    for (let py = 0; py < h; py += 1) edge.push(at(0, py), at(w - 1, py));
    const median = (channel) => edge.map((rgb) => rgb[channel]).sort((a, b) => a - b)[edge.length >> 1];
    const bg = [median(0), median(1), median(2)];
    let best = null;
    let bestDistance = 0;
    for (let py = 0; py < h; py += 1) {
      for (let px = 0; px < w; px += 1) {
        const rgb = at(px, py);
        const distance = Math.abs(rgb[0] - bg[0]) + Math.abs(rgb[1] - bg[1]) + Math.abs(rgb[2] - bg[2]);
        if (distance > bestDistance) {
          bestDistance = distance;
          best = rgb;
        }
      }
    }
    return {
      background: bg.map((value) => value / 255),
      color: best && bestDistance > 60 ? best.map((value) => value / 255) : [0, 0, 0],
    };
  } catch {
    return fallback;
  }
}

async function loadTextRuns(page, index) {
  if ((page.rotate || 0) % 360 !== 0) return [];
  try {
    const content = await page.getTextContent();
    const runs = [];
    content.items.forEach((item, itemIndex) => {
      let fontName = "";
      let fontFace = "";
      try {
        const font = page.commonObjs.get(item.fontName);
        fontName = [font && font.name, font && font.bold ? "bold" : "", font && font.italic ? "italic" : ""].join(" ");
        if (font && font.loadedName && !font.missingFile && document.fonts.check(`12px "${font.loadedName}"`)) {
          fontFace = font.loadedName;
        }
      } catch {
        /* Font details are only a hint for bold and italic. */
      }
      const run = PdfEdit.textRunFromItem(item, content.styles[item.fontName], fontName);
      if (run) runs.push({ ...run, fontFace, fontName: item.fontName, key: `${index}:${itemIndex}`, pageIndex: index });
    });
    return runs;
  } catch (error) {
    console.error(`Text on page ${index + 1} couldn't be read.`, error);
    return [];
  }
}

function startTextEdit(run, viewport) {
  remember(`text:${run.key}`);
  const edit = { ...run, original: run.text, ...sampleRunColors(run.rect, viewport), sampled: true };
  textEdits.set(run.key, edit);
  drawOverlays(viewport);
  const input = overlays.querySelector(`[data-key="${CSS.escape(run.key)}"] .text-edit-input`);
  if (input) {
    input.focus();
    input.select();
  }
}

function buildTextEdit(edit, viewport) {
  // An edit made by Replace on a page that wasn't on screen gets its colours once it is.
  if (!edit.sampled && edit.pageIndex === pageIndex) Object.assign(edit, sampleRunColors(edit.rect, viewport), { sampled: true });
  const css = pdfRectToCss(edit.rect, viewport);
  const sizePx = edit.fontSize * viewport.scale;
  const wrap = document.createElement("div");
  wrap.className = "text-edit";
  wrap.dataset.key = edit.key;
  place(wrap, css);

  const bar = document.createElement("div");
  bar.className = "pdf-box-bar";
  const revert = document.createElement("button");
  revert.type = "button";
  revert.textContent = "Revert";
  revert.setAttribute("aria-label", "Put back the original text");
  revert.addEventListener("click", () => {
    remember();
    textEdits.delete(edit.key);
    drawOverlays(currentViewport);
  });
  bar.append(revert);

  const input = document.createElement("input");
  input.type = "text";
  input.className = "text-edit-input";
  input.value = edit.text;
  input.setAttribute("aria-label", `Page text: ${edit.original}`);
  const font = cssFont(edit, sizePx);
  input.style.font = font;
  input.style.lineHeight = `${css.height}px`;
  input.style.color = cssColor(edit.color);
  wrap.style.background = cssColor(edit.background);
  input.style.paddingLeft = `${viewport.scale}px`;
  // Put the typed text on the original baseline, which sits one font size below the top of
  // the covered area. An input centres its line, so shift it by the difference.
  measureContext.font = font;
  const metrics = measureContext.measureText("Hg");
  const ascent = metrics.fontBoundingBoxAscent || sizePx * 0.8;
  const descent = metrics.fontBoundingBoxDescent || sizePx * 0.2;
  const baselineNow = (css.height - ascent - descent) / 2 + ascent;
  input.style.transform = `translateY(${sizePx - baselineNow}px)`;


  const note = document.createElement("p");
  note.className = "text-edit-note";
  note.setAttribute("aria-live", "polite");
  const showNote = () => {
    note.textContent = SAVE_NOTES[edit.saveMode] || "";
    note.hidden = !note.textContent;
    wrap.dataset.save = edit.saveMode || "replaced";
  };
  let checkTimer = 0;
  const checkSave = () => {
    clearTimeout(checkTimer);
    checkTimer = setTimeout(async () => {
      if (!sourceBytes) return;
      const asked = edit.text;
      const mode = await PdfEdit.previewTextEdit(sourceBytes, { ...edit, text: asked });
      if (edit.text !== asked) return;
      edit.saveMode = edit.text === edit.original ? "replaced" : mode;
      showNote();
    }, 250);
  };

  const fit = () => {
    measureContext.font = font;
    const needed = measureContext.measureText(input.value).width + 2 * viewport.scale + 4;
    wrap.style.width = `${Math.max(css.width, Math.min(needed, viewport.width - css.left))}px`;
  };
  input.addEventListener("input", () => {
    remember(`text:${edit.key}`);
    edit.text = input.value;
    fit();
    checkSave();
    schedulePreview();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") input.blur();
  });
  fit();
  showNote();
  if (!edit.saveMode && edit.text !== edit.original) checkSave();
  wrap.toggleAttribute("data-live", isLive(edit));
  wrap.append(bar, input, note);
  return wrap;
}

function buildTextHit(run, viewport) {
  const hit = document.createElement("button");
  hit.type = "button";
  hit.className = "text-hit";
  hit.dataset.key = run.key;
  hit.setAttribute("aria-label", `Edit text: ${run.text}`);
  place(hit, pdfRectToCss(run.rect, viewport));
  hit.addEventListener("click", () => startTextEdit(run, viewport));
  return hit;
}

function drawOverlays(viewport) {
  overlays.replaceChildren();
  if (!viewport) return;
  overlays.style.left = `${canvas.offsetLeft}px`;
  overlays.style.top = `${canvas.offsetTop}px`;
  overlays.style.width = `${canvas.clientWidth}px`;
  overlays.style.height = `${canvas.clientHeight}px`;

  const currentByKey = new Map(boxes.map((box) => [box.key, box]));
  for (const original of snapshot) {
    if (original.pageIndex !== pageIndex) continue;
    const current = currentByKey.get(original.key);
    if (current && !PdfEdit.rectsDiffer(original, current)) continue;
    const mask = document.createElement("div");
    mask.className = "pdf-mask";
    place(mask, pdfRectToCss(original, viewport));
    overlays.appendChild(mask);
  }

  for (const run of textRuns.get(pageIndex) || []) {
    const edit = textEdits.get(run.key);
    overlays.appendChild(edit ? buildTextEdit(edit, viewport) : buildTextHit(run, viewport));
  }

  for (const box of boxes) {
    if (box.pageIndex !== pageIndex) continue;
    overlays.appendChild(buildBox(box, viewport));
  }

  for (const image of images) {
    if (image.pageIndex !== pageIndex) continue;
    overlays.appendChild(buildImage(image, viewport));
  }
  drawFindHighlights(viewport);
  updatePageChrome();
  schedulePreview();
}

function buildBox(box, viewport) {
  const css = pdfRectToCss(box, viewport);
  const wrap = document.createElement("div");
  wrap.className = "pdf-box";
  wrap.dataset.key = box.key;
  place(wrap, css);

  const bar = document.createElement("div");
  bar.className = "pdf-box-bar";

  const move = document.createElement("button");
  move.type = "button";
  move.className = "pdf-box-move";
  move.textContent = "Move";
  move.setAttribute("aria-label", "Move text box. Arrow keys nudge it.");

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "pdf-box-remove";
  remove.textContent = "Remove";
  remove.setAttribute("aria-label", "Remove text box");

  const field = document.createElement(box.multiline ? "textarea" : "input");
  field.className = "pdf-box-input";
  if (!box.multiline) field.type = "text";
  field.value = box.text || "";
  if (box.maxLength) field.maxLength = box.maxLength;
  field.setAttribute("aria-label", `Text box ${box.name}`);
  field.style.fontSize = `${cssFontSize(box, css, viewport)}px`;

  const resize = document.createElement("button");
  resize.type = "button";
  resize.className = "pdf-box-resize";
  resize.setAttribute("aria-label", "Resize text box");

  bar.append(move, remove);
  wrap.append(bar, field, resize);
  bindMove(move, wrap, box, viewport);
  bindResize(resize, wrap, field, box, viewport);
  bindRemove(remove, box);
  field.addEventListener("input", () => {
    remember(`box:${box.key}`);
    box.text = field.value;
    if (!box.added) {
      for (const other of boxes) {
        if (!other.added && other.name === box.name && other !== box) other.text = field.value;
      }
    }
  });
  return wrap;
}

function cssFontSize(box, css, viewport) {
  if (box.fontSize) return Math.max(8, box.fontSize * (viewport.scale || 1));
  return Math.max(11, Math.min(28, css.height * 0.62));
}

function bindMove(handle, wrap, box, viewport) {
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = pdfRectToCss(box, viewport);
    function onMove(moveEvent) {
      place(
        wrap,
        clampCss(
          {
            left: origin.left + (moveEvent.clientX - startX),
            top: origin.top + (moveEvent.clientY - startY),
            width: origin.width,
            height: origin.height,
          },
          viewport,
        ),
      );
    }
    function onUp(upEvent) {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      const dx = upEvent.clientX - startX;
      const dy = upEvent.clientY - startY;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
        place(wrap, origin);
        return;
      }
      remember();
      Object.assign(
        box,
        cssBoxToPdf(
          clampCss(
            { left: origin.left + dx, top: origin.top + dy, width: origin.width, height: origin.height },
            viewport,
          ),
          viewport,
        ),
      );
      drawOverlays(viewport);
    }
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  });

  handle.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 10 : 1;
    let dx = 0;
    let dy = 0;
    if (event.key === "ArrowLeft") dx = -step;
    else if (event.key === "ArrowRight") dx = step;
    else if (event.key === "ArrowUp") dy = -step;
    else if (event.key === "ArrowDown") dy = step;
    else return;
    event.preventDefault();
    remember(`move:${box.key}`);
    const origin = pdfRectToCss(box, viewport);
    Object.assign(
      box,
      cssBoxToPdf(clampCss({ left: origin.left + dx, top: origin.top + dy, width: origin.width, height: origin.height }, viewport), viewport),
    );
    drawOverlays(viewport);
    const again = overlays.querySelector(`[data-key="${CSS.escape(box.key)}"] .pdf-box-move`);
    if (again) again.focus();
  });
}

function bindResize(handle, wrap, field, box, viewport) {
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = pdfRectToCss(box, viewport);
    function onMove(moveEvent) {
      place(
        wrap,
        clampCss(
          {
            left: origin.left,
            top: origin.top,
            width: origin.width + (moveEvent.clientX - startX),
            height: origin.height + (moveEvent.clientY - startY),
          },
          viewport,
        ),
      );
    }
    function onUp(upEvent) {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      const dw = upEvent.clientX - startX;
      const dh = upEvent.clientY - startY;
      if (Math.abs(dw) < 1 && Math.abs(dh) < 1) {
        place(wrap, origin);
        return;
      }
      remember();
      Object.assign(
        box,
        cssBoxToPdf(
          clampCss({ left: origin.left, top: origin.top, width: origin.width + dw, height: origin.height + dh }, viewport),
          viewport,
        ),
      );
      if (box.added) box.multiline = box.height >= 36;
      drawOverlays(viewport);
    }
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  });
  field.addEventListener("pointerdown", (event) => event.stopPropagation());
}

function bindRemove(button, box) {
  button.addEventListener("click", () => {
    remember();
    if (box.added) {
      boxes = boxes.filter((item) => item.key !== box.key);
    } else {
      const copies = boxes.filter((item) => !item.added && item.name === box.name).length;
      boxes = boxes.filter((item) => item.added || item.name !== box.name);
      if (copies > 1) {
        setStatus("That text box is used in more than one place, so each copy was removed.");
      }
    }
    drawOverlays(currentViewport);
  });
}

// ---- Undo and redo --------------------------------------------------------------------------
// Each change saves the state before it: page-text edits, text boxes, and placed images. A burst
// of typing or arrow-key nudges on one thing is one step, so undo doesn't go letter by letter.

const MAX_HISTORY = 200;
const GROUP_WINDOW_MS = 1500;
let undoStack = [];
let redoStack = [];
let lastGroup = "";
let lastGroupTime = 0;

function captureState() {
  return {
    textEdits: new Map([...textEdits].map(([key, edit]) => [key, { ...edit }])),
    boxes: cloneBoxes(boxes),
    images: images.map((image) => ({ ...image })),
  };
}

function restoreState(state) {
  textEdits = new Map([...state.textEdits].map(([key, edit]) => [key, { ...edit }]));
  boxes = cloneBoxes(state.boxes);
  images = state.images.map((image) => ({ ...image }));
}

// Call before changing anything. Changes with the same group within a moment share one step.
function remember(group = "") {
  const now = Date.now();
  if (group && group === lastGroup && now - lastGroupTime < GROUP_WINDOW_MS) {
    lastGroupTime = now;
    return;
  }
  lastGroup = group;
  lastGroupTime = now;
  undoStack.push(captureState());
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = [];
  updateUndoButton();
}

// Undo and redo live in the shortcut guide; they look dimmed when there is nothing to do.
function updateUndoButton() {
  for (const [name, stack] of [["undo", undoStack], ["redo", redoStack]]) {
    const button = document.querySelector(`[data-shortcut="${name}"]`);
    if (button) button.setAttribute("aria-disabled", String(!stack.length));
  }
}

function stepHistory(from, to, label) {
  if (!from.length) return;
  to.push(captureState());
  restoreState(from.pop());
  lastGroup = "";
  if (document.activeElement && overlays.contains(document.activeElement)) document.activeElement.blur();
  drawOverlays(currentViewport);
  updateUndoButton();
  setStatus(label);
  if (!findBar.hidden && findInput.value) runSearch(true);
}

const undo = () => stepHistory(undoStack, redoStack, "Undone.");
const redo = () => stepHistory(redoStack, undoStack, "Redone.");

function resetHistory() {
  undoStack = [];
  redoStack = [];
  lastGroup = "";
  updateUndoButton();
}

// ---- Find and replace -----------------------------------------------------------------------
// The page is drawn on a canvas, so the browser's own find can't see its words. This searches
// the PDF's text on every page. A replacement is written into each match's own text run, in that
// run's font, size, and colour, so the same name set in two styles keeps both styles. A match
// that can't keep its look is left alone unless the user asks for a similar font.

const findBar = document.getElementById("find-bar");
const findInput = document.getElementById("find-input");
const replaceInput = document.getElementById("replace-input");
const findCase = document.getElementById("find-case");
const findWord = document.getElementById("find-word");
const findCount = document.getElementById("find-count");
const findNote = document.getElementById("find-note");
const replaceAnyway = document.getElementById("replace-anyway");

let findResults = [];
let findActive = -1;
let findLoading = null;
let findTimer = 0;
let pendingFallback = [];

const textOf = (run) => {
  const edit = textEdits.get(run.key);
  return edit ? edit.text : run.text;
};

function setFindNote(message, fallback = []) {
  findNote.textContent = message;
  pendingFallback = fallback;
  replaceAnyway.hidden = !fallback.length;
}

// Text for every page, read once per file. Each page's drawing instructions are read too, so
// fonts are known (for bold, italic, and the live preview) on pages that haven't been shown.
async function loadAllTextRuns() {
  if (findLoading) return findLoading;
  const doc = pdfjsDoc;
  findLoading = (async () => {
    for (let index = 0; index < pageCount; index += 1) {
      if (textRuns.has(index)) continue;
      if (pageCount > 20) findCount.textContent = `Reading page ${index + 1} of ${pageCount}…`;
      const page = await doc.getPage(index + 1);
      try {
        await page.getOperatorList();
      } catch {
        /* Fonts are only a hint here; the text is still searchable. */
      }
      if (doc !== pdfjsDoc) return;
      if (!textRuns.has(index)) textRuns.set(index, await loadTextRuns(page, index));
    }
  })();
  try {
    await findLoading;
  } finally {
    findLoading = null;
  }
}

function fieldMatches(query, options) {
  const out = [];
  const seen = new Set();
  for (const box of boxes) {
    if (seen.has(box.name) || !box.text) continue;
    seen.add(box.name);
    const index = PdfFind.buildIndex([{ ...box, baseline: box.y, fontSize: 12, key: box.key }], () => box.text);
    for (const match of PdfFind.findMatches(index, query, options)) out.push({ kind: "field", pageIndex: box.pageIndex, box, match });
  }
  return out;
}

async function runSearch(keepPosition) {
  const query = findInput.value;
  const options = { matchCase: findCase.checked, wholeWord: findWord.checked };
  if (!query || !pdfjsDoc) {
    findResults = [];
    findActive = -1;
    findCount.textContent = "";
    drawOverlays(currentViewport);
    return;
  }
  await loadAllTextRuns();
  if (query !== findInput.value) return;
  const results = [];
  for (let index = 0; index < pageCount; index += 1) {
    const pageText = PdfFind.buildIndex(textRuns.get(index) || [], textOf);
    for (const match of PdfFind.findMatches(pageText, query, options)) results.push({ kind: "text", pageIndex: index, match });
  }
  results.push(...fieldMatches(query, options));
  results.sort((a, b) => a.pageIndex - b.pageIndex);
  const previous = findResults[findActive];
  findResults = results;
  if (!results.length) findActive = -1;
  else if (keepPosition && previous) {
    const next = results.findIndex(
      (r) => r.pageIndex > previous.pageIndex || (r.pageIndex === previous.pageIndex && r.match.start >= previous.match.start),
    );
    findActive = next === -1 ? 0 : next;
  } else {
    const onPage = results.findIndex((r) => r.pageIndex >= pageIndex);
    findActive = onPage === -1 ? 0 : onPage;
  }
  updateFindCount();
  await showActiveMatch();
}

function updateFindCount() {
  if (!findInput.value) findCount.textContent = "";
  else if (!findResults.length) findCount.textContent = "No matches";
  else findCount.textContent = `${findActive + 1} of ${findResults.length}`;
}

async function showActiveMatch() {
  const result = findResults[findActive];
  if (result && result.pageIndex !== pageIndex) {
    pageIndex = result.pageIndex;
    renderedPage = -1;
    await renderPage();
  } else {
    drawOverlays(currentViewport);
  }
  const active = overlays.querySelector(".find-hit.is-active");
  if (active) active.scrollIntoView({ block: "center", behavior: "smooth" });
}

function stepMatch(direction) {
  if (!findResults.length) return;
  findActive = (findActive + direction + findResults.length) % findResults.length;
  setFindNote("");
  updateFindCount();
  showActiveMatch();
}

// Where part of a run sits, measured in the run's font and scaled to the run's real width.
function segmentRect(run, start, end) {
  const text = textOf(run);
  measureContext.font = cssFont(run, 100);
  const scale = run.width / (measureContext.measureText(run.text).width || 1);
  const from = measureContext.measureText(text.slice(0, start)).width * scale;
  const to = measureContext.measureText(text.slice(0, end)).width * scale;
  return { x: run.x + from, y: run.rect.y, width: Math.max(2, to - from), height: run.rect.height };
}

function drawFindHighlights(viewport) {
  if (findBar.hidden || !viewport) return;
  findResults.forEach((result, number) => {
    if (result.pageIndex !== pageIndex) return;
    const rects =
      result.kind === "field"
        ? [result.box]
        : result.match.segments.map((segment) => segmentRect(segment.run, segment.start, segment.end));
    for (const rect of rects) {
      const hit = document.createElement("div");
      hit.className = `find-hit${number === findActive ? " is-active" : ""}${result.match.mixedFormat ? " is-mixed" : ""}`;
      place(hit, pdfRectToCss(rect, viewport));
      overlays.appendChild(hit);
    }
  });
}

function editFor(run, text) {
  const existing = textEdits.get(run.key);
  const base = existing || { ...run, original: run.text, background: [1, 1, 1], color: [0, 0, 0], sampled: false };
  return { ...base, text };
}

function commitEdits(edits, modes) {
  for (const edit of edits) {
    edit.saveMode = modes ? modes.get(edit) : undefined;
    if ((edit.text || "") === (edit.original || "")) textEdits.delete(edit.key);
    else textEdits.set(edit.key, edit);
  }
}

function replaceInField(result, replacement) {
  const { box, match } = result;
  const text = box.text.slice(0, match.segments[0].start) + replacement + box.text.slice(match.segments[0].end);
  for (const other of boxes) if (other.name === box.name && !other.added) other.text = text;
}

// Candidate edits for a set of matches, applied right to left within each page so earlier
// offsets stay valid. Matches touching a run in skipRuns are left out.
function plannedEdits(results, replacement, skipRuns) {
  const pending = new Map();
  const used = [];
  const pendingText = (run) => (pending.has(run.key) ? pending.get(run.key).text : textOf(run));
  const ordered = [...results].sort((a, b) => a.pageIndex - b.pageIndex || b.match.start - a.match.start);
  for (const result of ordered) {
    if (result.match.segments.some((segment) => skipRuns.has(segment.run.key))) continue;
    for (const { run, text } of PdfFind.replacementTexts(result.match, replacement, pendingText)) {
      pending.set(run.key, editFor(run, text));
    }
    used.push(result);
  }
  return { edits: [...pending.values()], used };
}

async function replaceMatches(results, replacement, allowSimilarFont) {
  remember();
  const fields = results.filter((r) => r.kind === "field");
  const textResults = results.filter((r) => r.kind === "text" && !r.match.mixedFormat);
  const mixed = results.filter((r) => r.kind === "text" && r.match.mixedFormat).length;
  // Each candidate is checked with the save engine. Matches that would lose their look are
  // dropped and the rest checked again, since one run can hold more than one match.
  const skip = new Set();
  const blocked = new Set();
  let plan = plannedEdits(textResults, replacement, skip);
  let modes = new Map();
  for (let pass = 0; pass < 4; pass += 1) {
    modes = plan.edits.length ? await PdfEdit.previewTextEdits(sourceBytes, plan.edits) : new Map();
    let changed = false;
    for (const edit of plan.edits) {
      const mode = modes.get(edit);
      const acceptable = mode === "replaced" || mode === "borrowed" || (allowSimilarFont && (mode === "removed" || mode === "mixed"));
      if (!acceptable && !skip.has(edit.key)) {
        skip.add(edit.key);
        if (mode === "unsupported" || mode === "missing") blocked.add(edit.key);
        changed = true;
      }
    }
    if (!changed) break;
    plan = plannedEdits(textResults, replacement, skip);
  }
  commitEdits(plan.edits, modes);
  for (const field of fields) replaceInField(field, replacement);
  const left = textResults.filter((r) => !plan.used.includes(r));
  const unsupported = left.filter((r) => r.match.segments.some((s) => blocked.has(s.run.key)));
  const needFont = left.filter((r) => !unsupported.includes(r));
  return { replaced: plan.used.length + fields.length, mixed, needFont, unsupported: unsupported.length };
}

const plural = (count, one, many) => (count === 1 ? one : many.replace("#", count));

function describeReplace(outcome) {
  const parts = [];
  if (outcome.replaced) {
    parts.push(`Replaced ${plural(outcome.replaced, "1 match", "# matches")}, each in its original formatting.`);
  }
  if (outcome.mixed) {
    parts.push(`${plural(outcome.mixed, "1 match mixes", "# matches mix")} two text styles, so ${plural(outcome.mixed, "it was", "they were")} left unchanged.`);
  }
  if (outcome.needFont.length) {
    const n = outcome.needFont.length;
    parts.push(
      `${plural(n, "1 match was", "# matches were")} left unchanged: this PDF's font doesn't have every letter of the new text there, so ${plural(n, "it", "they")} couldn't keep the same look.`,
    );
  }
  if (outcome.unsupported) {
    parts.push(`${plural(outcome.unsupported, "1 match", "# matches")} can't be changed here (characters no PDF font here can draw, or text that can't be removed from the file), so ${plural(outcome.unsupported, "it was", "they were")} left unchanged.`);
  }
  return parts.join(" ") || "Nothing was replaced.";
}

async function replaceCurrent() {
  const result = findResults[findActive];
  if (!result || !sourceBytes) return;
  if (result.kind === "text" && result.match.mixedFormat) {
    setFindNote("This match mixes two text styles, so it isn't replaced: the new text couldn't keep both.");
    return;
  }
  const outcome = await replaceMatches([result], replaceInput.value, false);
  setFindNote(describeReplace(outcome), outcome.needFont);
  await runSearch(true);
}

async function replaceAll() {
  if (!findResults.length || !sourceBytes) return;
  const outcome = await replaceMatches(findResults, replaceInput.value, false);
  setFindNote(describeReplace(outcome), outcome.needFont);
  await runSearch(false);
}

async function replaceWithSimilarFont() {
  const results = pendingFallback;
  if (!results.length) return;
  const outcome = await replaceMatches(results, replaceInput.value, true);
  setFindNote(
    `Replaced ${plural(outcome.replaced, "1 match", "# matches")} in the closest standard font, with the original size and colour.${outcome.unsupported ? ` ${plural(outcome.unsupported, "1 still needs", "# still need")} characters no PDF font here can draw.` : ""}`,
  );
  await runSearch(false);
}

function openFind() {
  if (!pdfjsDoc || viewer.hidden) return;
  findBar.hidden = false;
  findInput.focus();
  findInput.select();
  if (findInput.value) runSearch(true);
}

function resetFind() {
  findBar.hidden = true;
  findResults = [];
  findActive = -1;
  findLoading = null;
  findCount.textContent = "";
  setFindNote("");
}

function closeFind() {
  findBar.hidden = true;
  findResults = [];
  findActive = -1;
  setFindNote("");
  drawOverlays(currentViewport);
}

// ---- Images (for example a signature) -------------------------------------------------------

const MAX_IMAGE_SIDE = 1600;

// Draws the picture, and when asked makes its plain background transparent: the background
// colour is read from the picture's edges, pixels close to it become clear with a soft edge, and
// the background's tint is taken out of edge pixels so ink doesn't get a pale halo.
function renderImagePng(image) {
  const { source } = image;
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const work = document.createElement("canvas");
  work.width = width;
  work.height = height;
  const context = work.getContext("2d", { willReadFrequently: true });
  context.drawImage(source, 0, 0, width, height);
  if (image.removeBackground) {
    const pixels = context.getImageData(0, 0, width, height);
    const data = pixels.data;
    const edge = [];
    const take = (x, y) => {
      const i = (y * width + x) * 4;
      if (data[i + 3] > 200) edge.push([data[i], data[i + 1], data[i + 2]]);
    };
    for (let x = 0; x < width; x += 1) take(x, 0), take(x, height - 1);
    for (let y = 0; y < height; y += 1) take(0, y), take(width - 1, y);
    const median = (c) => (edge.length ? edge.map((p) => p[c]).sort((a, b) => a - b)[edge.length >> 1] : 255);
    const bg = [median(0), median(1), median(2)];
    const low = 28;
    const high = 90;
    for (let i = 0; i < data.length; i += 4) {
      const distance = Math.max(Math.abs(data[i] - bg[0]), Math.abs(data[i + 1] - bg[1]), Math.abs(data[i + 2] - bg[2]));
      const alpha = distance <= low ? 0 : distance >= high ? 1 : (distance - low) / (high - low);
      if (alpha > 0 && alpha < 1) {
        for (let c = 0; c < 3; c += 1) {
          data[i + c] = Math.max(0, Math.min(255, Math.round((data[i + c] - bg[c] * (1 - alpha)) / alpha)));
        }
      }
      data[i + 3] = Math.round(data[i + 3] * alpha);
    }
    context.putImageData(pixels, 0, 0);
  }
  return new Promise((resolve, reject) => {
    work.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error("The image couldn't be prepared."));
        return;
      }
      resolve({ png: new Uint8Array(await blob.arrayBuffer()), url: URL.createObjectURL(blob) });
    }, "image/png");
  });
}

function hasTransparency(source) {
  const probe = document.createElement("canvas");
  const scale = Math.min(1, 256 / Math.max(source.width, source.height));
  probe.width = Math.max(1, Math.round(source.width * scale));
  probe.height = Math.max(1, Math.round(source.height * scale));
  const context = probe.getContext("2d", { willReadFrequently: true });
  context.drawImage(source, 0, 0, probe.width, probe.height);
  const data = context.getImageData(0, 0, probe.width, probe.height).data;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return true;
  return false;
}

const imageUrls = new Set();

async function refreshImage(image) {
  const rendered = await renderImagePng(image);
  imageUrls.add(rendered.url);
  image.png = rendered.png;
  image.url = rendered.url;
}

function forgetImages() {
  for (const url of imageUrls) URL.revokeObjectURL(url);
  imageUrls.clear();
  images = [];
}

async function addImage(file) {
  if (!file || !pageSizes[pageIndex] || !currentViewport) return;
  if (file.size > PdfEdit.MAX_PDF_BYTES) {
    setStatus("Images have to be 20 MB or smaller.", true);
    return;
  }
  let source;
  try {
    source = await createImageBitmap(file);
  } catch {
    setStatus("That image couldn't be opened. Choose a PNG, JPEG, or WebP file.", true);
    return;
  }
  const page = pageSizes[pageIndex];
  // Placed in the middle of the page at up to a third of its width, at the picture's proportions.
  const width = Math.min(page.width / 3, source.width * 0.75);
  const height = (width * source.height) / source.width;
  const image = {
    key: `image:${(imageCounter += 1)}`,
    pageIndex,
    x: (page.width - width) / 2,
    y: (page.height - height) / 2,
    width,
    height,
    source,
    removeBackground: !hasTransparency(source),
    png: null,
    url: null,
  };
  try {
    await refreshImage(image);
  } catch {
    setStatus("That image couldn't be prepared.", true);
    return;
  }
  remember();
  images.push(image);
  drawOverlays(currentViewport);
  setStatus(
    image.removeBackground
      ? "Image added with its background removed. Drag it into place and resize it from the corner."
      : "Image added. Drag it into place and resize it from the corner.",
  );
  const move = overlays.querySelector(`[data-key="${CSS.escape(image.key)}"] .pdf-box-move`);
  if (move) move.focus();
}

function buildImage(image, viewport) {
  const css = pdfRectToCss(image, viewport);
  const wrap = document.createElement("div");
  wrap.className = "pdf-box pdf-image";
  wrap.dataset.key = image.key;
  wrap.tabIndex = -1; // a tap or click on the picture shows its controls
  place(wrap, css);

  const picture = document.createElement("img");
  picture.src = image.url;
  picture.alt = "";
  picture.draggable = false;

  const bar = document.createElement("div");
  bar.className = "pdf-box-bar";
  const move = document.createElement("button");
  move.type = "button";
  move.className = "pdf-box-move";
  move.textContent = "Move";
  move.setAttribute("aria-label", "Move image. Arrow keys nudge it.");
  const background = document.createElement("button");
  background.type = "button";
  background.className = "pdf-box-remove";
  background.textContent = image.removeBackground ? "Keep background" : "Remove background";
  background.addEventListener("click", async () => {
    remember();
    image.removeBackground = !image.removeBackground;
    try {
      await refreshImage(image);
    } catch {
      setStatus("That image couldn't be prepared.", true);
    }
    drawOverlays(currentViewport);
  });
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "pdf-box-remove";
  remove.textContent = "Remove";
  remove.setAttribute("aria-label", "Remove image");
  remove.addEventListener("click", () => {
    remember();
    images = images.filter((item) => item !== image);
    drawOverlays(currentViewport);
  });
  bar.append(move, background, remove);

  const resize = document.createElement("button");
  resize.type = "button";
  resize.className = "pdf-box-resize";
  resize.setAttribute("aria-label", "Resize image. Arrow keys make it larger or smaller.");

  wrap.append(picture, bar, resize);
  bindMove(move, wrap, image, viewport);
  bindImageResize(resize, wrap, image, viewport);
  return wrap;
}

// Resizing keeps the picture's proportions, so a signature is never stretched.
function bindImageResize(handle, wrap, image, viewport) {
  const ratio = image.height / image.width;
  const sized = (origin, width) => {
    const maxWidth = Math.min(viewport.width - origin.left, (viewport.height - origin.top) / ratio);
    const w = Math.max(16, Math.min(width, maxWidth));
    return { left: origin.left, top: origin.top, width: w, height: w * ratio };
  };
  const commit = (css, group) => {
    remember(group);
    const [x1, y1] = viewport.convertToPdfPoint(css.left, css.top);
    const [x2, y2] = viewport.convertToPdfPoint(css.left + css.width, css.top + css.height);
    Object.assign(image, { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) });
    drawOverlays(viewport);
  };
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = pdfRectToCss(image, viewport);
    const widthFor = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = (moveEvent.clientY - startY) / ratio;
      return origin.width + (Math.abs(dx) >= Math.abs(dy) ? dx : dy);
    };
    const onMove = (moveEvent) => place(wrap, sized(origin, widthFor(moveEvent)));
    const onUp = (upEvent) => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      commit(sized(origin, widthFor(upEvent)));
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  });
  handle.addEventListener("keydown", (event) => {
    const grow = event.key === "ArrowRight" || event.key === "ArrowUp";
    const shrink = event.key === "ArrowLeft" || event.key === "ArrowDown";
    if (!grow && !shrink) return;
    event.preventDefault();
    const origin = pdfRectToCss(image, viewport);
    const step = (event.shiftKey ? 0.15 : 0.05) * origin.width;
    commit(sized(origin, origin.width + (grow ? step : -step)), `resize:${image.key}`);
    const again = overlays.querySelector(`[data-key="${CSS.escape(image.key)}"] .pdf-box-resize`);
    if (again) again.focus();
  });
}

// The console keeps the real error for debugging; the page shows a short message and keeps
// the page counter and buttons accurate, so another page can still be opened.
function showRenderError(error) {
  console.error(`PDF page ${pageIndex + 1} couldn't be drawn.`, error);
  renderedPage = -1;
  overlays.replaceChildren();
  updatePageChrome();
  setStatus("This page couldn't be shown.", true);
}

// ---- The page as it will be saved ---------------------------------------------------------
// While page text is changed, the canvas shows the page with the edits written by the same
// code that saves them, so what is on screen is the file that will download: its own fonts,
// letters borrowed or turned, a standard font where one is needed, and the saved spacing. The
// edit's input then only shows the caret and selection. canvasShows records which text the
// canvas holds for each edit key; a key it doesn't hold shows the original.
let canvasShows = { pageIndex: -1, texts: new Map() };
let paintedSignature = "";
let renderedOutputScale = 1;
let previewSeq = 0;
let previewRunning = false;
let previewAgain = false;
let previewWorker = null;
// Rows of canvas pixels, [top, bottom), that currently differ from the original page.
let paintedRows = null;

// The rows holding the edited lines, in canvas pixels. Only these are drawn again: a longer
// text only grows sideways, and the rows span the whole page width.
function rowsOf(edits, viewport) {
  let rows = null;
  for (const edit of edits) {
    const css = pdfRectToCss(edit.rect, viewport);
    const top = Math.max(0, Math.floor((css.top - 4) * renderedOutputScale));
    const bottom = Math.min(canvas.height, Math.ceil((css.top + css.height + 4) * renderedOutputScale));
    rows = rows ? [Math.min(rows[0], top), Math.max(rows[1], bottom)] : [top, bottom];
  }
  return rows;
}

function isLive(edit) {
  if (canvasShows.pageIndex !== edit.pageIndex) return false;
  const shown = canvasShows.texts.has(edit.key) ? canvasShows.texts.get(edit.key) : edit.original;
  return shown === edit.text;
}

function updateLiveFlags() {
  for (const wrap of overlays.querySelectorAll(".text-edit")) {
    const edit = textEdits.get(wrap.dataset.key);
    if (edit) wrap.toggleAttribute("data-live", isLive(edit));
  }
}

function changedEditsOn(index) {
  return [...textEdits.values()].filter((edit) => edit.pageIndex === index && (edit.text || "") !== (edit.original || ""));
}

function previewSignature(index, edits) {
  return JSON.stringify([index, canvas.width, edits.map((edit) => [edit.key, edit.text])]);
}

// Drawn straight away on every change, with no waiting for a pause in typing. While one drawing
// runs, later changes only ask for one more, which then draws the latest text.
function schedulePreview() {
  if (previewRunning) {
    previewAgain = true;
    return;
  }
  previewRunning = true;
  renderQueue = renderQueue
    .then(paintPreview, paintPreview)
    .catch(() => {})
    .then(() => {
      previewRunning = false;
      if (previewAgain) {
        previewAgain = false;
        schedulePreview();
      }
    });
}

async function paintPreview() {
  const seq = ++previewSeq;
  const index = pageIndex;
  const viewport = currentViewport;
  const doc = pdfjsDoc;
  const bytes = sourceBytes;
  if (!viewport || !doc || !bytes || !pdfjs || renderedPage !== index) return;
  // Started early, so the first change doesn't wait for the worker to load.
  if (!previewWorker) previewWorker = new pdfjs.PDFWorker();
  const edits = changedEditsOn(index);
  const signature = previewSignature(index, edits);
  if (signature === paintedSignature) {
    updateLiveFlags();
    return;
  }
  const stale = () => seq !== previewSeq || index !== pageIndex || viewport !== currentViewport || doc !== pdfjsDoc;
  let task = null;
  try {
    let page;
    let applied = new Set();
    if (edits.length) {
      const preview = await PdfEdit.previewPage(bytes, index, edits);
      if (stale()) return;
      applied = preview.applied;
      task = pdfjs.getDocument({
        data: preview.bytes,
        worker: previewWorker,
        cMapUrl: new URL("cmaps/", PDFJS_DIR).href,
        cMapPacked: true,
        standardFontDataUrl: new URL("standard_fonts/", PDFJS_DIR).href,
        wasmUrl: new URL("wasm/", PDFJS_DIR).href,
        iccUrl: new URL("iccs/", PDFJS_DIR).href,
        enableScripting: false,
      });
      page = await (await task.promise).getPage(1);
    } else {
      page = await doc.getPage(index + 1);
    }
    if (stale()) return;
    // Only the rows that change are drawn, off screen first so they never show half drawn: the
    // edited lines now, and any that were edited before and may be back to the original.
    const now = rowsOf(edits, viewport);
    const rows = now && paintedRows ? [Math.min(now[0], paintedRows[0]), Math.max(now[1], paintedRows[1])] : now || paintedRows;
    if (rows && rows[1] > rows[0]) {
      const target = document.createElement("canvas");
      target.width = canvas.width;
      target.height = rows[1] - rows[0];
      const params = {
        canvas: target,
        viewport: page.getViewport({ scale: viewport.scale }),
        annotationMode: pdfjs.AnnotationMode.ENABLE,
        transform: [renderedOutputScale, 0, 0, renderedOutputScale, 0, -rows[0]],
      };
      await page.render(params).promise;
      if (stale()) return;
      const context = canvas.getContext("2d");
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.drawImage(target, 0, rows[0]);
      context.restore();
    }
    paintedRows = now;
    canvasShows = { pageIndex: index, texts: new Map([...applied].map((edit) => [edit.key, edit.text])) };
    paintedSignature = signature;
    updateLiveFlags();
  } catch (error) {
    // The edits stay visible in their inputs, drawn by the browser over the original.
    if (!stale()) console.error("The edited page couldn't be drawn.", error);
  } finally {
    if (task) task.destroy().catch(() => {});
  }
}

function renderPage() {
  const run = renderQueue.then(() => renderPageNow());
  renderQueue = run.then(
    () => {},
    () => {},
  );
  return run;
}

// The page is fitted to the width of the viewer box, which has no scrollbar of its own. The
// width is read from the border box, which a scrollbar never changes; if it did, a page that
// only just overflows would flip between two sizes and re-render forever.
const STAGE_PADDING_X = 24;

function stageWidth() {
  // Border box less the borders. Unlike clientWidth, it does not change when a scrollbar appears.
  return stageScroll.offsetWidth - stageScroll.clientLeft * 2;
}

async function renderPageNow(attempt = 0) {
  if (!pdfjsDoc || !stageScroll.offsetWidth) return;
  const token = renderToken;
  const index = pageIndex;
  let page;
  try {
    page = await pdfjsDoc.getPage(index + 1);
  } catch (error) {
    if (token !== renderToken || !pdfjsDoc) return;
    showRenderError(error);
    return;
  }
  if (token !== renderToken || !pdfjsDoc || index !== pageIndex) return;

  const unscaled = page.getViewport({ scale: 1 });
  const widthNow = stageWidth();
  const available = Math.max(120, widthNow - STAGE_PADDING_X);
  const scale = Math.min(2, available / unscaled.width);
  if (renderedPage === index && Math.abs(scale - renderedScale) < 0.01 && renderedWidth === widthNow) {
    return;
  }

  const viewport = page.getViewport({ scale });
  const outputScale = Math.min(window.devicePixelRatio || 1, 2);
  // PDF.js takes its own 2D context from this canvas, so none is taken here. Renders
  // are queued, so the canvas is never used by two renders at once. ENABLE draws form
  // fields on the canvas; the editable boxes are laid over them.
  canvasShows = { pageIndex: -1, texts: new Map() };
  paintedSignature = "";
  paintedRows = null;
  renderedOutputScale = outputScale;
  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  const params = { canvas, viewport, annotationMode: pdfjs.AnnotationMode.ENABLE };
  if (outputScale !== 1) params.transform = [outputScale, 0, 0, outputScale, 0, 0];

  try {
    await page.render(params).promise;
  } catch (error) {
    if (token !== renderToken || !pdfjsDoc) return;
    if (error && (error.name === "RenderingCancelledException" || /cancel/i.test(error.message || ""))) return;
    showRenderError(error);
    return;
  }
  if (token !== renderToken || index !== pageIndex || !pdfjsDoc) return;
  if (!textRuns.has(index)) {
    const runs = await loadTextRuns(page, index);
    if (token !== renderToken || index !== pageIndex || !pdfjsDoc) return;
    textRuns.set(index, runs);
  }

  currentViewport = viewport;
  renderedPage = index;
  renderedScale = scale;
  renderedWidth = widthNow;
  // The original page is on the canvas; edits on it are drawn in by paintPreview.
  canvasShows = { pageIndex: index, texts: new Map() };
  paintedSignature = previewSignature(index, []);
  drawOverlays(viewport);

  if (attempt < 2 && stageScroll.offsetWidth && stageWidth() !== widthNow) {
    return renderPageNow(attempt + 1);
  }
}

async function openFile(file) {
  const id = ++requestId;
  const sizeCheck = PdfEdit.checkFileSize(file.size);
  clearBtn.disabled = false;
  fileLabel.textContent = file.name;
  viewer.hidden = true;
  downloadBtn.disabled = true;
  if (!sizeCheck.ok) {
    setStatus(sizeCheck.error, true);
    return;
  }

  setStatus("Reading the PDF…");
  await closeDocument();
  if (id !== requestId) return;
  const viewerLib = await pdfjsReady;
  if (id !== requestId) return;
  if (!viewerLib) {
    setStatus(VIEWER_UNAVAILABLE, true);
    return;
  }

  let bytes;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    if (id !== requestId) return;
    setStatus("The file could not be read.", true);
    return;
  }
  if (id !== requestId) return;
  if (!PdfEdit.hasPdfHeader(bytes)) {
    setStatus("Choose a PDF file.", true);
    return;
  }

  let info;
  try {
    info = await PdfEdit.readPdf(bytes.slice(0));
  } catch (error) {
    if (id !== requestId) return;
    setStatus(error.message || "This file couldn't be read as a PDF.", true);
    return;
  }
  if (id !== requestId) return;

  sourceBytes = bytes;
  sourceName = PdfEdit.downloadName(file.name);
  snapshot = cloneBoxes(info.boxes);
  boxes = cloneBoxes(info.boxes);
  textRuns = new Map();
  textEdits = new Map();
  forgetImages();
  resetFind();
  resetHistory();
  pageSizes = info.pageSizes;
  pageCount = info.pageCount;
  pageIndex = 0;
  renderedPage = -1;

  let doc;
  try {
    // The bytes are copied because PDF.js hands its copy to the worker.
    const task = pdfjs.getDocument({
      data: bytes.slice(0),
      cMapUrl: new URL("cmaps/", PDFJS_DIR).href,
      cMapPacked: true,
      standardFontDataUrl: new URL("standard_fonts/", PDFJS_DIR).href,
      wasmUrl: new URL("wasm/", PDFJS_DIR).href,
      iccUrl: new URL("iccs/", PDFJS_DIR).href,
      enableScripting: false,
    });
    loadingTask = task;
    task.onPassword = () => {
      task.destroy();
    };
    doc = await task.promise;
  } catch (error) {
    if (id !== requestId) return;
    console.error("The PDF couldn't be opened for viewing.", error);
    sourceBytes = null;
    setStatus("This PDF couldn't be shown.", true);
    await closeDocument();
    return;
  }
  // A newer file was chosen while this one loaded; its closeDocument() already destroyed this task.
  if (id !== requestId) return;
  pdfjsDoc = doc;

  viewer.hidden = false;
  downloadBtn.disabled = false;
  updatePageChrome();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  if (id !== requestId) return;
  setStatus(
    PdfEdit.loadSummary({
      fileName: file.name,
      pageCount: info.pageCount,
      boxCount: info.boxes.length,
      hasSignature: info.hasSignature,
      skipped: info.skipped,
    }),
  );
  try {
    await renderPage();
  } catch (error) {
    if (id !== requestId) return;
    showRenderError(error);
  }
}

function triggerDownload(bytes, filename) {
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function downloadPdf() {
  if (!sourceBytes) return;
  downloadBtn.disabled = true;
  const edits = [...textEdits.values()];
  const placed = images.map(({ pageIndex: page, x, y, width, height, png }) => ({ pageIndex: page, x, y, width, height, png }));
  const changed = PdfEdit.hasChanges(snapshot, boxes, edits, placed);
  try {
    const report = {};
    const bytes = await PdfEdit.applyEdits(sourceBytes, snapshot, boxes, edits, report, placed);
    triggerDownload(bytes, sourceName);
    let message = changed ? "Downloaded. The PDF has no watermark." : "Downloaded the original file. Nothing was changed.";
    if (report.borrowed) {
      message += ` ${report.borrowed === 1 ? "One text change uses" : `${report.borrowed} text changes use`} letters taken from the same typeface elsewhere in the PDF, matched to the original weight.`;
    }
    if (report.standardLetters) {
      message += ` ${report.standardLetters === 1 ? "One text change has" : `${report.standardLetters} text changes have`} a few letters in a similar standard font because no font in the PDF has them.`;
    }
    if (report.standardFont) {
      message += ` ${report.standardFont === 1 ? "One text change uses" : `${report.standardFont} text changes use`} a similar standard font because the PDF's font doesn't have all of those letters.`;
    }
    setStatus(message);
  } catch (error) {
    setStatus(error.message || "The PDF could not be saved.", true);
  } finally {
    downloadBtn.disabled = !sourceBytes;
  }
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files && fileInput.files[0];
  if (file) openFile(file);
});

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
  if (file) openFile(file);
});

prevBtn.addEventListener("click", () => {
  if (pageIndex <= 0) return;
  pageIndex -= 1;
  renderedPage = -1;
  renderPage();
});

nextBtn.addEventListener("click", () => {
  if (pageIndex >= pageCount - 1) return;
  pageIndex += 1;
  renderedPage = -1;
  renderPage();
});

// The guide shows ⌘ on Apple devices and Ctrl elsewhere.
const isApple = /Mac|iPhone|iPad|iPod/i.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "");
for (const key of document.querySelectorAll(".shortcut-guide kbd")) key.textContent = isApple ? key.dataset.mac : key.dataset.other;
const chooseImage = () => {
  if (sourceBytes && currentViewport) imageInput.click();
};
for (const button of document.querySelectorAll("[data-shortcut]")) {
  button.addEventListener("click", () => ({ find: openFind, image: chooseImage, undo, redo })[button.dataset.shortcut]());
}
document.getElementById("find-close").addEventListener("click", closeFind);
document.getElementById("find-next").addEventListener("click", () => stepMatch(1));
document.getElementById("find-prev").addEventListener("click", () => stepMatch(-1));
document.getElementById("replace-one").addEventListener("click", replaceCurrent);
document.getElementById("replace-all").addEventListener("click", replaceAll);
replaceAnyway.addEventListener("click", replaceWithSimilarFont);
findInput.addEventListener("input", () => {
  clearTimeout(findTimer);
  setFindNote("");
  findTimer = setTimeout(() => runSearch(false), 150);
});
for (const option of [findCase, findWord]) option.addEventListener("change", () => runSearch(false));
findInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    stepMatch(event.shiftKey ? -1 : 1);
  }
});
findBar.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    closeFind();
    stageScroll.focus({ preventScroll: true });
  }
});
// The browser's own find can't see text drawn on the canvas, so Cmd+F / Ctrl+F opens this one
// whenever a PDF is open. With no PDF open, the browser's find works as usual.
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "f" && pdfjsDoc && !viewer.hidden) {
    event.preventDefault();
    openFind();
  }
  // Undo and redo, except while typing in the find bar, where the browser's own undo is kept.
  const inFindBar = findBar.contains(document.activeElement);
  const key = event.key.toLowerCase();
  if ((event.metaKey || event.ctrlKey) && !event.altKey && !inFindBar && sourceBytes) {
    if (key === "z" && !event.shiftKey) {
      event.preventDefault();
      undo();
      return;
    }
    if ((key === "z" && event.shiftKey) || (key === "y" && event.ctrlKey && !event.metaKey)) {
      event.preventDefault();
      redo();
      return;
    }
    if (key === "i" && !event.shiftKey) {
      event.preventDefault();
      chooseImage();
      return;
    }
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "g" && !findBar.hidden && findResults.length) {
    event.preventDefault();
    stepMatch(event.shiftKey ? -1 : 1);
  }
});

imageInput.addEventListener("change", () => {
  const file = imageInput.files && imageInput.files[0];
  imageInput.value = "";
  if (file) addImage(file);
});
downloadBtn.addEventListener("click", downloadPdf);

clearBtn.addEventListener("click", () => {
  requestId += 1;
  fileInput.value = "";
  closeDocument();
  resetView();
  setStatus("");
});

new ResizeObserver(() => {
  if (pdfjsDoc) renderPage();
}).observe(stageScroll, { box: "border-box" });

resetView();
pdfjsReady.then((viewerLib) => {
  if (!viewerLib && !sourceBytes) setStatus(VIEWER_UNAVAILABLE, true);
});
