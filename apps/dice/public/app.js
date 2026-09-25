const countInputs = document.querySelectorAll('input[name="count"]');
const sideInputs = document.querySelectorAll('input[name="sides"]');
const showSumInput = document.getElementById("show-sum");
const rollBtn = document.getElementById("roll-btn");
const summary = document.getElementById("roll-summary");
const facesEl = document.getElementById("faces");
const totalEl = document.getElementById("roll-total");

function selectedValue(inputs) {
  const checked = [...inputs].find((input) => input.checked);
  return checked ? Number(checked.value) : NaN;
}

let lastResult = null;

function summaryText(result, showSum) {
  const faces = result.faces;
  const joined =
    faces.length === 1
      ? String(faces[0])
      : faces.length === 2
        ? `${faces[0]} and ${faces[1]}`
        : `${faces[0]}, ${faces[1]}, and ${faces[2]}`;
  if (!showSum) return `Rolled ${result.notation}: ${joined}.`;
  return `Rolled ${result.notation}: ${joined}. Sum ${result.total}.`;
}

const PIP_SPOTS = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

function faceElement(value, sides) {
  const item = document.createElement("li");
  if (sides === 20) {
    item.className = "face";
    item.textContent = String(value);
    return item;
  }
  item.className = "face face-pips";
  for (const spot of PIP_SPOTS[value]) {
    const pip = document.createElement("span");
    pip.className = "pip";
    pip.style.gridArea = `${Math.ceil(spot / 3)} / ${((spot - 1) % 3) + 1}`;
    item.append(pip);
  }
  return item;
}

function render(result) {
  const showSum = showSumInput.checked;
  summary.textContent = summaryText(result, showSum);
  facesEl.replaceChildren();
  for (const face of result.faces) {
    facesEl.append(faceElement(face, result.sides));
  }
  totalEl.hidden = !showSum;
  totalEl.textContent = showSum ? String(result.total) : "";
}

function roll() {
  lastResult = DiceRoller.roll(selectedValue(countInputs), selectedValue(sideInputs));
  render(lastResult);
}

rollBtn.addEventListener("click", roll);
showSumInput.addEventListener("change", () => {
  if (lastResult) render(lastResult);
});
roll();
