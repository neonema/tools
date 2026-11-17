const cryptoApi = window.TextEncrypt;

const sourceInput = document.getElementById("source-input");
const passphraseInput = document.getElementById("passphrase-input");
const resultOutput = document.getElementById("result-output");
const encryptBtn = document.getElementById("encrypt-btn");
const decryptBtn = document.getElementById("decrypt-btn");
const copyBtn = document.getElementById("copy-btn");
const swapBtn = document.getElementById("swap-btn");
const clearBtn = document.getElementById("clear-btn");
const togglePassphraseBtn = document.getElementById("toggle-passphrase");
const statusEl = document.getElementById("status");

let busy = false;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.dataset.state = isError ? "error" : message ? "ok" : "";
}

function setBusy(next) {
  busy = next;
  encryptBtn.disabled = next;
  decryptBtn.disabled = next;
  copyBtn.disabled = next;
  swapBtn.disabled = next;
  clearBtn.disabled = next;
  togglePassphraseBtn.disabled = next;
}

async function encrypt() {
  if (busy) return;
  setBusy(true);
  setStatus("Encrypting…");
  resultOutput.value = "";
  try {
    const result = await cryptoApi.encryptText(sourceInput.value, passphraseInput.value);
    if (!result.ok) {
      setStatus(result.error, true);
      return;
    }
    resultOutput.value = result.token;
    setStatus("Encrypted. Keep the passphrase. It cannot be recovered.");
  } catch {
    setStatus("Encryption failed. Try again.", true);
  } finally {
    setBusy(false);
  }
}

async function decrypt() {
  if (busy) return;
  setBusy(true);
  setStatus("Decrypting…");
  resultOutput.value = "";
  try {
    const result = await cryptoApi.decryptText(sourceInput.value, passphraseInput.value);
    if (!result.ok) {
      setStatus(result.error, true);
      return;
    }
    resultOutput.value = result.text;
    setStatus("Decrypted.");
  } catch {
    setStatus("Decryption failed. Try again.", true);
  } finally {
    setBusy(false);
  }
}

async function copyResult() {
  if (busy) return;
  if (!resultOutput.value) {
    setStatus("Nothing to copy.", true);
    return;
  }
  try {
    await navigator.clipboard.writeText(resultOutput.value);
    setStatus("Copied.");
  } catch {
    resultOutput.focus();
    resultOutput.select();
    setStatus("Copy failed. The result is selected so you can copy it.", true);
  }
}

function swap() {
  if (busy || !resultOutput.value) {
    if (!busy) setStatus("Nothing to move up.", true);
    return;
  }
  sourceInput.value = resultOutput.value;
  resultOutput.value = "";
  setStatus("Moved the result into the input.");
  sourceInput.focus();
}

function clearAll() {
  if (busy) return;
  sourceInput.value = "";
  resultOutput.value = "";
  setStatus("");
  sourceInput.focus();
}

function togglePassphrase() {
  const hidden = passphraseInput.type === "password";
  passphraseInput.type = hidden ? "text" : "password";
  togglePassphraseBtn.textContent = hidden ? "Hide" : "Show";
  togglePassphraseBtn.setAttribute("aria-pressed", hidden ? "true" : "false");
  passphraseInput.focus();
}

encryptBtn.addEventListener("click", encrypt);
decryptBtn.addEventListener("click", decrypt);
copyBtn.addEventListener("click", copyResult);
swapBtn.addEventListener("click", swap);
clearBtn.addEventListener("click", clearAll);
togglePassphraseBtn.addEventListener("click", togglePassphrase);

sourceInput.addEventListener("keydown", (event) => {
  if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") return;
  event.preventDefault();
  const compact = sourceInput.value.trim().replace(/\s+/g, "");
  if (compact.startsWith(cryptoApi.PREFIX)) {
    decrypt();
  } else {
    encrypt();
  }
});
