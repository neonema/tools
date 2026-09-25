const sourceInput = document.getElementById("source-input");
const resultOutput = document.getElementById("result-output");
const statusEl = document.getElementById("status");
const encodeBtn = document.getElementById("encode-btn");
const decodeBtn = document.getElementById("decode-btn");
const copyBtn = document.getElementById("copy-btn");
const swapBtn = document.getElementById("swap-btn");
const clearBtn = document.getElementById("clear-btn");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.dataset.state = isError ? "error" : "ok";
}

function encode() {
  const input = sourceInput.value;
  if (!input) {
    setStatus("Paste text to encode.", true);
    resultOutput.value = "";
    return;
  }
  resultOutput.value = encodeURIComponent(input);
  setStatus("URL-encoded.");
}

function decode() {
  const input = sourceInput.value;
  if (!input.trim()) {
    setStatus("Paste an encoded string to decode.", true);
    resultOutput.value = "";
    return;
  }
  try {
    // Forms often use + for spaces; normalize before decodeURIComponent.
    const normalized = input.replace(/\+/g, " ");
    resultOutput.value = decodeURIComponent(normalized);
    setStatus("URL-decoded.");
  } catch {
    resultOutput.value = "";
    setStatus("Invalid percent-encoding (bad % sequence).", true);
  }
}

encodeBtn.addEventListener("click", encode);
decodeBtn.addEventListener("click", decode);

swapBtn.addEventListener("click", () => {
  const previousResult = resultOutput.value;
  sourceInput.value = previousResult;
  resultOutput.value = "";
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
