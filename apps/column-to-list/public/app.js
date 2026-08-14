const sourceInput = document.getElementById("source-input");
const resultOutput = document.getElementById("result-output");
const statusEl = document.getElementById("status");
const sourceLabel = document.getElementById("source-label");
const resultLabel = document.getElementById("result-label");
const delimiterInput = document.getElementById("delimiter");
const itemPrefixInput = document.getElementById("item-prefix");
const itemSuffixInput = document.getElementById("item-suffix");
const resultPrefixInput = document.getElementById("result-prefix");
const resultSuffixInput = document.getElementById("result-suffix");
const collapseEmptyInput = document.getElementById("collapse-empty");
const copyBtn = document.getElementById("copy-btn");
const swapBtn = document.getElementById("swap-btn");
const clearBtn = document.getElementById("clear-btn");
const modeButtons = document.querySelectorAll("[data-mode]");

let mode = "to-list";

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.dataset.state = isError ? "error" : "ok";
}

function getOptions() {
  return {
    delimiter: delimiterInput.value,
    itemPrefix: itemPrefixInput.value,
    itemSuffix: itemSuffixInput.value,
    resultPrefix: resultPrefixInput.value,
    resultSuffix: resultSuffixInput.value,
    collapseEmpty: collapseEmptyInput.checked,
  };
}

function splitLines(text) {
  const parts = text.split(/\r\n|\n|\r/);
  if (parts.length && parts[parts.length - 1] === "") {
    parts.pop();
  }
  return parts;
}

function columnToList(text, opts) {
  let items = splitLines(text);
  if (opts.collapseEmpty) {
    items = items.filter((line) => line.trim() !== "");
  }
  if (!items.length) {
    return "";
  }
  const wrapped = items.map((item) => opts.itemPrefix + item + opts.itemSuffix);
  return opts.resultPrefix + wrapped.join(opts.delimiter) + opts.resultSuffix;
}

function stripAffix(value, prefix, suffix) {
  let next = value;
  if (prefix && next.startsWith(prefix)) {
    next = next.slice(prefix.length);
  }
  if (suffix && next.endsWith(suffix)) {
    next = next.slice(0, next.length - suffix.length);
  }
  return next;
}

function listToColumn(text, opts) {
  if (!text) {
    return "";
  }
  const body = stripAffix(text, opts.resultPrefix, opts.resultSuffix);
  const items =
    opts.delimiter === "" ? [body] : body.split(opts.delimiter);
  let lines = items.map((item) => stripAffix(item, opts.itemPrefix, opts.itemSuffix));
  if (opts.collapseEmpty) {
    lines = lines.filter((line) => line.trim() !== "");
  }
  return lines.join("\n");
}

function convert() {
  const opts = getOptions();
  const input = sourceInput.value;
  resultOutput.value = mode === "to-list" ? columnToList(input, opts) : listToColumn(input, opts);
}

function applyMode(nextMode, { convertNow = true } = {}) {
  mode = nextMode;
  modeButtons.forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  if (mode === "to-list") {
    sourceLabel.textContent = "Column";
    resultLabel.textContent = "List";
    sourceInput.placeholder = "Paste a column — one item per line";
    resultOutput.placeholder = "Joined list appears here";
  } else {
    sourceLabel.textContent = "List";
    resultLabel.textContent = "Column";
    sourceInput.placeholder = "Paste a delimited list";
    resultOutput.placeholder = "One item per line appears here";
  }
  if (convertNow) {
    convert();
  }
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyMode(button.dataset.mode);
    setStatus("");
  });
});

document.querySelectorAll(".preset-btn").forEach((button) => {
  button.addEventListener("click", () => {
    delimiterInput.value = button.dataset.delimiter ?? ",";
    convert();
    setStatus("");
  });
});

[
  sourceInput,
  delimiterInput,
  itemPrefixInput,
  itemSuffixInput,
  resultPrefixInput,
  resultSuffixInput,
].forEach((el) => {
  el.addEventListener("input", () => {
    convert();
  });
});

collapseEmptyInput.addEventListener("change", convert);

swapBtn.addEventListener("click", () => {
  const previousResult = resultOutput.value;
  sourceInput.value = previousResult;
  applyMode(mode === "to-list" ? "to-column" : "to-list");
  setStatus(previousResult ? "Swapped result into input." : "");
  sourceInput.focus();
});

clearBtn.addEventListener("click", () => {
  sourceInput.value = "";
  resultOutput.value = "";
  setStatus("");
  sourceInput.focus();
});

copyBtn.addEventListener("click", async () => {
  const text = resultOutput.value;
  if (!text) {
    setStatus("Nothing to copy.", true);
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Copied to clipboard.");
  } catch {
    setStatus("Copy failed — select the result and copy manually.", true);
  }
});

applyMode("to-list", { convertNow: false });
