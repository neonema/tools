const sourceInput = document.getElementById("source-input");
const wordCountEl = document.getElementById("word-count");
const charCountEl = document.getElementById("char-count");
const tokenCountEl = document.getElementById("token-count");
const clearBtn = document.getElementById("clear-btn");

const numberFmt = new Intl.NumberFormat();

/** Rough English heuristic used by many LLM docs: ~4 characters per token. */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function countWords(text) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function updateCounts() {
  const text = sourceInput.value;
  wordCountEl.textContent = numberFmt.format(countWords(text));
  charCountEl.textContent = numberFmt.format(text.length);
  tokenCountEl.textContent = numberFmt.format(estimateTokens(text));
}

sourceInput.addEventListener("input", updateCounts);

clearBtn.addEventListener("click", () => {
  sourceInput.value = "";
  updateCounts();
  sourceInput.focus();
});

updateCounts();
