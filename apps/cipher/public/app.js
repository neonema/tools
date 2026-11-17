const sourceInput = document.getElementById("source-input");
const resultOutput = document.getElementById("result-output");
const statusEl = document.getElementById("status");
const cipherNote = document.getElementById("cipher-note");
const shiftOptions = document.getElementById("shift-options");
const keyOptions = document.getElementById("key-options");
const keyInput = document.getElementById("key-input");
const shiftSlider = document.getElementById("shift-slider");
const shiftNumber = document.getElementById("shift-number");
const directionGroup = document.getElementById("direction-group");
const exampleBtn = document.getElementById("example-btn");
const decodeBtn = document.getElementById("decode-btn");
const encodeBtn = document.getElementById("encode-btn");
const copyBtn = document.getElementById("copy-btn");
const useResultBtn = document.getElementById("use-result-btn");
const clearBtn = document.getElementById("clear-btn");
const singleResult = document.getElementById("single-result");
const shiftResults = document.getElementById("shift-results");
const shiftList = document.getElementById("shift-list");
const modeInputs = Array.from(document.querySelectorAll('input[name="cipher"]'));

const EXAMPLES = {
  caesar: { text: "Phhw ph dw wkh jdwh.", shift: 3, direction: "decode" },
  rot13: { text: "Gur dhvpx oebja sbk whzcf bire gur ynml qbt." },
  vigenere: { text: "Xiqh zp ef rnhr.", key: "LEMON", direction: "decode" },
  atbash: { text: "Svool, dliow!" },
  shifts: { text: "Phhw ph dw wkh jdwh." },
};

const NOTES = {
  caesar: "Decode moves letters backward by the shift. Encode moves them forward. A shift of 13 is ROT13.",
  rot13: "ROT13 is a Caesar shift of 13. Apply it again to get the original text.",
  vigenere: "The key repeats across the text. Only letters in the key are used, and only letters in the text change.",
  atbash: "A becomes Z, B becomes Y, and so on. Apply it again to get the original text.",
  shifts: "Each row is the text decoded with that Caesar shift. Shift 0 is the original text.",
};

let direction = "decode";
let latestShifts = [];

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  if (message && isError) statusEl.dataset.state = "error";
  else delete statusEl.dataset.state;
}

function currentMode() {
  return modeInputs.find((input) => input.checked)?.value || "caesar";
}

function readShift() {
  const raw = shiftNumber.value.trim();
  if (!raw || !/^-?\d+$/.test(raw)) return null;
  const value = Number(raw);
  if (value < 0 || value > 25) return null;
  return value;
}

function setDirection(next) {
  direction = next;
  const decoding = next === "decode";
  decodeBtn.setAttribute("aria-pressed", decoding ? "true" : "false");
  encodeBtn.setAttribute("aria-pressed", decoding ? "false" : "true");
  decodeBtn.classList.toggle("is-selected", decoding);
  decodeBtn.classList.toggle("ghost-btn", !decoding);
  encodeBtn.classList.toggle("is-selected", !decoding);
  encodeBtn.classList.toggle("ghost-btn", decoding);
}

function applyMode() {
  const mode = currentMode();
  const directional = mode === "caesar" || mode === "vigenere";
  shiftOptions.hidden = mode !== "caesar";
  keyOptions.hidden = mode !== "vigenere";
  directionGroup.hidden = !directional;
  useResultBtn.hidden = mode === "shifts";
  singleResult.hidden = mode === "shifts";
  shiftResults.hidden = mode !== "shifts";
  cipherNote.textContent = NOTES[mode] || "";
  run();
}

function renderShifts(rows) {
  latestShifts = rows;
  const fragment = document.createDocumentFragment();
  for (const row of rows) {
    const item = document.createElement("li");
    item.className = "shift-item";

    const index = document.createElement("span");
    index.className = "shift-index";
    index.textContent = String(row.shift);

    const body = document.createElement("span");
    body.className = "shift-text";
    body.textContent = row.text;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "ghost-btn";
    button.textContent = "Copy";
    button.setAttribute("aria-label", `Copy shift ${row.shift}`);
    button.addEventListener("click", () => {
      copyText(row.text, `Copied shift ${row.shift}.`);
    });

    item.append(index, body, button);
    fragment.append(item);
  }
  shiftList.replaceChildren(fragment);
}

function clearOutput() {
  resultOutput.value = "";
  latestShifts = [];
  shiftList.replaceChildren();
}

function run() {
  const text = sourceInput.value;
  const mode = currentMode();

  if (!text) {
    clearOutput();
    setStatus("");
    return;
  }

  if (text.length > Cipher.MAX_CHARS) {
    clearOutput();
    setStatus("That text is too long. The limit is 200,000 characters.", true);
    return;
  }

  try {
    if (mode === "caesar") {
      const shift = readShift();
      if (shift === null) {
        clearOutput();
        setStatus("Enter a shift from 0 to 25.", true);
        return;
      }
      resultOutput.value = Cipher.caesar(text, direction === "encode" ? shift : -shift);
      setStatus(`${direction === "encode" ? "Encoded" : "Decoded"} with Caesar shift ${shift}.`);
      return;
    }

    if (mode === "rot13") {
      resultOutput.value = Cipher.rot13(text);
      setStatus("ROT13 applied.");
      return;
    }

    if (mode === "atbash") {
      resultOutput.value = Cipher.atbash(text);
      setStatus("Atbash applied.");
      return;
    }

    if (mode === "vigenere") {
      const decoding = direction !== "encode";
      resultOutput.value = Cipher.vigenere(text, keyInput.value, decoding);
      setStatus(`${decoding ? "Decoded" : "Encoded"} with the Vigenère key.`);
      return;
    }

    renderShifts(Cipher.allCaesarShifts(text));
    setStatus("All 26 Caesar shifts. Shift 0 is the original text.");
  } catch (error) {
    clearOutput();
    setStatus(error instanceof Error ? error.message : "Could not decode that text.", true);
  }
}

function resultText() {
  if (currentMode() === "shifts") {
    return latestShifts.map((row) => `${row.shift}: ${row.text}`).join("\n");
  }
  return resultOutput.value;
}

async function copyText(text, okMessage) {
  if (!text) {
    setStatus("Nothing to copy.", true);
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    setStatus(okMessage);
  } catch {
    setStatus("Copy failed — select the result and copy manually.", true);
  }
}

for (const input of modeInputs) {
  input.addEventListener("change", applyMode);
}

sourceInput.addEventListener("input", run);
keyInput.addEventListener("input", run);

shiftSlider.addEventListener("input", () => {
  shiftNumber.value = shiftSlider.value;
  run();
});

shiftNumber.addEventListener("input", () => {
  const shift = readShift();
  if (shift === null) {
    run();
    return;
  }
  shiftSlider.value = String(shift);
  run();
});

exampleBtn.addEventListener("click", () => {
  const example = EXAMPLES[currentMode()];
  if (!example) return;
  if (example.shift != null) {
    shiftSlider.value = String(example.shift);
    shiftNumber.value = String(example.shift);
  }
  if (example.key != null) keyInput.value = example.key;
  if (example.direction) setDirection(example.direction);
  sourceInput.value = example.text;
  run();
});

decodeBtn.addEventListener("click", () => {
  setDirection("decode");
  run();
});

encodeBtn.addEventListener("click", () => {
  setDirection("encode");
  run();
});

copyBtn.addEventListener("click", () => {
  const label = currentMode() === "shifts" ? "Copied all 26 shifts." : "Copied to clipboard.";
  copyText(resultText(), label);
});

useResultBtn.addEventListener("click", () => {
  const next = resultOutput.value;
  if (!next) {
    setStatus("Nothing to move into the input.", true);
    return;
  }
  sourceInput.value = next;
  sourceInput.focus();
  run();
});

clearBtn.addEventListener("click", () => {
  sourceInput.value = "";
  clearOutput();
  setStatus("");
  sourceInput.focus();
});

applyMode();
