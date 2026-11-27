// PDF.js is the legacy build, the same one the PDF editor uses, so text still reads in browsers
// a release or two behind. The folder is named for the version, so a cached worker is never
// paired with a newer viewer.
const PDFJS_DIR = new URL("./vendor/pdfjs-6.5.438/", import.meta.url);
const VIEWER_UNAVAILABLE = "This browser can't read PDFs. Update the browser, then reload this page.";

const pdfjsReady = import(new URL("pdf.min.js", PDFJS_DIR).href).then(
  (module) => {
    module.GlobalWorkerOptions.workerSrc = new URL("pdf.worker.min.js", PDFJS_DIR).href;
    return module;
  },
  (error) => {
    console.error("The PDF reader did not load.", error);
    return null;
  },
);

const fileInput = document.getElementById("pdf-file");
const fileDrop = document.getElementById("file-drop");
const fileLabel = document.getElementById("file-label");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const outputEl = document.getElementById("markdown-output");
const copyBtn = document.getElementById("copy-btn");
const downloadBtn = document.getElementById("download-btn");
const layoutCheck = document.getElementById("layout-check");
const clearBtn = document.getElementById("clear-btn");

let requestId = 0;
let markdownName = "document.md";
let lastPieces = null;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  if (isError) statusEl.dataset.state = "error";
  else delete statusEl.dataset.state;
}

function resetOutput() {
  outputEl.value = "";
  resultEl.hidden = true;
  copyBtn.disabled = true;
  downloadBtn.disabled = true;
  lastPieces = null;
  markdownName = "document.md";
  fileLabel.textContent = "Choose a PDF";
}

function showMarkdown(markdown) {
  outputEl.value = markdown;
  resultEl.hidden = false;
  copyBtn.disabled = !markdown;
  downloadBtn.disabled = !markdown;
}

function openError(error) {
  const name = error && error.name;
  const message = String((error && error.message) || "");
  if (name === "PasswordException" || /password/i.test(message)) {
    return "This PDF is password protected, so it can't be converted here.";
  }
  return "This file couldn't be read as a PDF.";
}

function faceOf(page, item) {
  try {
    const font = page.commonObjs.has(item.fontName) ? page.commonObjs.get(item.fontName) : null;
    if (!font) return null;
    return { name: font.name || "", bold: Boolean(font.bold), italic: Boolean(font.italic) };
  } catch {
    return null;
  }
}

function pageLinks(annotations) {
  const links = [];
  for (const annotation of annotations || []) {
    if (!annotation || annotation.subtype !== "Link" || !annotation.url) continue;
    const rect = annotation.rect || [];
    if (rect.length < 4) continue;
    const [x1, y1, x2, y2] = rect;
    links.push({
      url: annotation.url,
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    });
  }
  return links;
}

async function readDocument(pdfjs, bytes) {
  const task = pdfjs.getDocument({
    data: bytes.slice(0),
    cMapUrl: new URL("cmaps/", PDFJS_DIR).href,
    cMapPacked: true,
    standardFontDataUrl: new URL("standard_fonts/", PDFJS_DIR).href,
    enableScripting: false,
    verbosity: 0,
  });
  task.onPassword = () => {
    task.destroy();
  };
  try {
    const doc = await task.promise;
    if (doc.numPages > PdfMarkdown.MAX_PAGES) {
      await task.destroy();
      return { error: `PDFs have to be ${PdfMarkdown.MAX_PAGES} pages or fewer.` };
    }
    const pages = [];
    let rotated = 0;
    for (let number = 1; number <= doc.numPages; number += 1) {
      setStatus(`Reading page ${number} of ${doc.numPages}…`);
      const page = await doc.getPage(number);
      const content = await page.getTextContent();
      const runs = [];
      for (const item of content.items) {
        const inspected = PdfMarkdown.inspectItem(item, content.styles && content.styles[item.fontName], faceOf(page, item));
        if (!inspected) continue;
        if (inspected.skipped) rotated += 1;
        else runs.push(inspected.run);
      }
      const view = page.getViewport({ scale: 1 });
      let annotations = [];
      try {
        annotations = await page.getAnnotations();
      } catch {
        annotations = [];
      }
      pages.push({ width: view.width, height: view.height, runs, links: pageLinks(annotations) });
      page.cleanup();
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    }
    await task.destroy();
    return { pages, rotated };
  } catch (error) {
    try {
      await task.destroy();
    } catch {
      /* The password path destroys the task itself. */
    }
    return { error: openError(error) };
  }
}

async function convertFile(file) {
  const id = ++requestId;
  resetOutput();
  fileLabel.textContent = file.name;
  clearBtn.disabled = false;
  markdownName = PdfMarkdown.downloadName(file.name);
  setStatus("Reading…");

  const size = PdfMarkdown.checkFileSize(file.size);
  if (!size.ok) {
    setStatus(size.error, true);
    return;
  }

  const pdfjs = await pdfjsReady;
  if (id !== requestId) return;
  if (!pdfjs) {
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
  if (!PdfMarkdown.hasPdfHeader(bytes)) {
    setStatus("This file couldn't be read as a PDF.", true);
    return;
  }

  const read = await readDocument(pdfjs, bytes);
  if (id !== requestId) return;
  if (read.error) {
    setStatus(read.error, true);
    return;
  }

  const markdown = PdfMarkdown.toMarkdown(read.pages);
  if (!markdown) {
    setStatus(
      read.rotated
        ? "This text is rotated, so it can't be converted. Scanned pages can't be converted either."
        : "No text was found. Scanned pages and text inside images can't be converted.",
      true,
    );
    return;
  }

  lastPieces = PdfMarkdown.pagePieces(read.pages);
  showMarkdown(markdownForPieces());
  const pages = read.pages.length === 1 ? "1 page" : `${read.pages.length} pages`;
  setStatus(read.rotated ? `${pages} converted. Rotated text was skipped.` : `${pages} converted.`);
}

function markdownForPieces() {
  if (!lastPieces) return "";
  const parts = [];
  for (const piece of lastPieces) {
    const fallback = piece.markdown.trim();
    const visual = layoutCheck.checked ? PdfMarkdown.visualMarkdown(piece.transcript).trim() : "";
    const chosen = visual || fallback;
    if (chosen) parts.push(chosen);
  }
  const markdown = parts.join("\n\n");
  return markdown ? `${markdown}\n` : "";
}

async function copyMarkdown() {
  const text = outputEl.value;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Copied.");
  } catch {
    outputEl.focus();
    outputEl.select();
    setStatus("Select the Markdown and copy it.", true);
  }
}

function downloadMarkdown() {
  const text = outputEl.value;
  if (!text) return;
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = markdownName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files && fileInput.files[0];
  if (file) convertFile(file);
});

clearBtn.addEventListener("click", () => {
  requestId += 1;
  fileInput.value = "";
  resetOutput();
  clearBtn.disabled = true;
  setStatus("");
});

copyBtn.addEventListener("click", () => {
  copyMarkdown();
});

downloadBtn.addEventListener("click", downloadMarkdown);

layoutCheck.addEventListener("change", () => {
  if (!lastPieces) return;
  showMarkdown(markdownForPieces());
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
  if (file) convertFile(file);
});

resetOutput();
clearBtn.disabled = true;
