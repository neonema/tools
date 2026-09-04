const gen = window.PasswordGenerator;

const passwordOutput = document.getElementById("password-output");
const copyBtn = document.getElementById("copy-btn");
const generateBtn = document.getElementById("generate-btn");
const statusEl = document.getElementById("status");
const entropyFill = document.getElementById("entropy-fill");
const entropyLine = document.getElementById("entropy-line");
const lengthSlider = document.getElementById("length-slider");
const lengthNumber = document.getElementById("length-number");
const optLowercase = document.getElementById("opt-lowercase");
const optUppercase = document.getElementById("opt-uppercase");
const optNumbers = document.getElementById("opt-numbers");
const optCommon = document.getElementById("opt-common");
const optSafeExtras = document.getElementById("opt-safe-extras");
const optExtra = document.getElementById("opt-extra");
const optRarely = document.getElementById("opt-rarely");
const optExcludeSimilar = document.getElementById("opt-exclude-similar");

const optionInputs = [
  optLowercase,
  optUppercase,
  optNumbers,
  optCommon,
  optSafeExtras,
  optExtra,
  optRarely,
  optExcludeSimilar,
];

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.dataset.state = isError ? "error" : "ok";
}

function clampLength(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return gen.DEFAULT_LENGTH;
  return Math.min(gen.MAX_LENGTH, Math.max(gen.MIN_LENGTH, Math.round(n)));
}

function readOptions() {
  return {
    length: clampLength(lengthNumber.value),
    lowercase: optLowercase.checked,
    uppercase: optUppercase.checked,
    numbers: optNumbers.checked,
    common: optCommon.checked,
    safeExtras: optSafeExtras.checked,
    extra: optExtra.checked,
    rarelyAccepted: optRarely.checked,
    excludeSimilar: optExcludeSimilar.checked,
  };
}

function syncLengthInputs(length) {
  const value = String(length);
  lengthSlider.value = value;
  lengthNumber.value = value;
}

function renderEntropy(result) {
  if (!result || !result.ok) {
    entropyFill.style.width = "0%";
    entropyLine.textContent = "";
    return;
  }

  const bits = result.entropyBits;
  const pct = Math.max(4, Math.min(100, (bits / 128) * 100));
  entropyFill.style.width = `${pct}%`;
  const rounded = Math.round(bits);
  const label = gen.strengthLabel(bits);
  entropyLine.textContent = `~${rounded} bits · ${label} · ${result.password.length} characters from a ${result.charsetSize}-character set`;
}

function regenerate() {
  const options = readOptions();
  syncLengthInputs(options.length);
  const result = gen.generatePassword(options);

  if (!result.ok) {
    passwordOutput.value = "";
    renderEntropy(null);
    setStatus(result.error, true);
    return;
  }

  passwordOutput.value = result.password;
  renderEntropy(result);
  setStatus("");
}

async function copyPassword() {
  const value = passwordOutput.value;
  if (!value) {
    setStatus("Generate a password first.", true);
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
    setStatus("Copied.");
  } catch {
    setStatus("Copy failed.", true);
  }
}

copyBtn.addEventListener("click", copyPassword);
generateBtn.addEventListener("click", () => {
  setStatus("");
  regenerate();
});

lengthSlider.addEventListener("input", () => {
  lengthNumber.value = lengthSlider.value;
  regenerate();
});

lengthNumber.addEventListener("input", () => {
  const raw = Number(lengthNumber.value);
  if (!Number.isInteger(raw)) return;
  if (raw < gen.MIN_LENGTH || raw > gen.MAX_LENGTH) return;
  lengthSlider.value = String(raw);
  regenerate();
});

lengthNumber.addEventListener("change", () => {
  syncLengthInputs(clampLength(lengthNumber.value));
  regenerate();
});

for (const input of optionInputs) {
  input.addEventListener("change", regenerate);
}

if (!gen) {
  setStatus("Password generator failed to load.", true);
} else {
  lengthSlider.min = String(gen.MIN_LENGTH);
  lengthSlider.max = String(gen.MAX_LENGTH);
  lengthNumber.min = String(gen.MIN_LENGTH);
  lengthNumber.max = String(gen.MAX_LENGTH);
  syncLengthInputs(gen.DEFAULT_LENGTH);
  regenerate();
}
