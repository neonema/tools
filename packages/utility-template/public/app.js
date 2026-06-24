const sourceInput = document.getElementById("source-input");
const resultOutput = document.getElementById("result-output");
const generateBtn = document.getElementById("generate-btn");
const copyBtn = document.getElementById("copy-btn");
const status = document.getElementById("status");

function toSlug(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function showStatus(message) {
  status.textContent = message;
  if (!message) return;
  setTimeout(() => {
    if (status.textContent === message) {
      status.textContent = "";
    }
  }, 1500);
}

function generateSlug() {
  const source = sourceInput.value;
  const result = toSlug(source);
  resultOutput.value = result;
  showStatus(result ? "Generated successfully" : "Please enter some text");
}

async function copyResult() {
  if (!resultOutput.value) {
    showStatus("Nothing to copy");
    return;
  }

  try {
    await navigator.clipboard.writeText(resultOutput.value);
    showStatus("Copied to clipboard");
  } catch (error) {
    showStatus("Copy failed");
  }
}

generateBtn.addEventListener("click", generateSlug);
copyBtn.addEventListener("click", copyResult);

sourceInput.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    generateSlug();
  }
});
