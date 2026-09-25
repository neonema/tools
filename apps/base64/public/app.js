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

/** UTF-8 safe Base64 encode (handles emoji and non-Latin1). */
function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/** UTF-8 safe Base64 decode. Accepts whitespace in the input. */
function decodeBase64(text) {
  const cleaned = text.replace(/\s+/g, "");
  if (!cleaned) {
    throw new Error("Nothing to decode.");
  }
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned) || cleaned.length % 4 !== 0) {
    throw new Error("Invalid Base64 string.");
  }
  const binary = atob(cleaned);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encode() {
  try {
    const input = sourceInput.value;
    if (!input) {
      setStatus("Paste text to encode.", true);
      resultOutput.value = "";
      return;
    }
    resultOutput.value = encodeBase64(input);
    setStatus("Encoded to Base64.");
  } catch (error) {
    resultOutput.value = "";
    setStatus(error instanceof Error ? error.message : "Encode failed.", true);
  }
}

function decode() {
  try {
    const input = sourceInput.value;
    if (!input.trim()) {
      setStatus("Paste Base64 to decode.", true);
      resultOutput.value = "";
      return;
    }
    resultOutput.value = decodeBase64(input);
    setStatus("Decoded from Base64.");
  } catch (error) {
    resultOutput.value = "";
    setStatus(error instanceof Error ? error.message : "Decode failed.", true);
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
