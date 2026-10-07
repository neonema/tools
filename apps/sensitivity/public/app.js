const gameSelect = document.getElementById("game");
const dpiInput = document.getElementById("dpi");
const sensInput = document.getElementById("sens");
const hint = document.getElementById("sens-hint");
const edpiNote = document.getElementById("edpi-note");
const cmEl = document.getElementById("cm");
const inchesEl = document.getElementById("inches");
const countsEl = document.getElementById("counts");
const edpiEl = document.getElementById("edpi");
const tableBody = document.getElementById("equiv-body");
const status = document.getElementById("status");
const summary = document.getElementById("summary");

for (const game of Sensitivity.GAMES) {
  const option = document.createElement("option");
  option.value = game.id;
  option.textContent = game.name;
  gameSelect.append(option);
}
gameSelect.value = "cs2";

let summaryTimer = 0;

function setSummary(text) {
  window.clearTimeout(summaryTimer);
  summaryTimer = window.setTimeout(() => {
    summary.textContent = text;
  }, 350);
}

function clearFacts() {
  cmEl.textContent = "—";
  inchesEl.textContent = "—";
  countsEl.textContent = "—";
  edpiEl.textContent = "—";
  tableBody.replaceChildren();
}

function render() {
  const game = Sensitivity.gameById(gameSelect.value);
  hint.textContent = game ? game.hint : "";
  edpiNote.textContent =
    game && game.unit === "percent"
      ? "eDPI is DPI times this percent divided by 100. It only compares two setups in the same game."
      : "eDPI only compares two setups in the same game.";

  const result = Sensitivity.calculate(gameSelect.value, dpiInput.value, sensInput.value);
  if (!result) {
    clearFacts();
    status.textContent = "Enter a DPI and a sensitivity above zero.";
    setSummary("Enter a DPI and a sensitivity above zero.");
    return;
  }

  status.textContent = "";
  cmEl.textContent = Sensitivity.formatFixed(result.cm);
  inchesEl.textContent = Sensitivity.formatFixed(result.inches);
  countsEl.textContent = Sensitivity.formatGrouped(result.counts);
  edpiEl.textContent = Sensitivity.formatGrouped(result.edpi);

  tableBody.replaceChildren();
  for (const row of result.equivalents) {
    const tr = document.createElement("tr");
    if (row.current) tr.className = "is-current";
    const name = document.createElement("th");
    name.scope = "row";
    name.textContent = row.name;
    const sens = document.createElement("td");
    sens.textContent = Sensitivity.formatSensitivity(row.sensitivity, row.unit);
    tr.append(name, sens);
    tableBody.append(tr);
  }

  setSummary(
    `${Sensitivity.formatFixed(result.cm)} centimeters per 360 degrees at ${Sensitivity.formatGrouped(result.dpi)} DPI in ${result.game.name}.`,
  );
}

gameSelect.addEventListener("change", render);
dpiInput.addEventListener("input", render);
sensInput.addEventListener("input", render);
render();
