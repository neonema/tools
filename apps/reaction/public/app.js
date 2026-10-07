const stage = document.getElementById("stage");
const kicker = document.getElementById("stage-kicker");
const valueEl = document.getElementById("stage-value");
const labelEl = document.getElementById("stage-label");
const status = document.getElementById("status");
const recent = document.getElementById("recent");
const averageEl = document.getElementById("average");
const attemptsEl = document.getElementById("attempts");

const attempts = [];
let state = "idle";
let waitTimer = 0;
let goAt = 0;
let ignoreClick = false;

function setStage(next, kickerText, valueText, labelText) {
  state = next;
  stage.dataset.state = next;
  kicker.textContent = kickerText;
  valueEl.textContent = valueText;
  labelEl.textContent = labelText;
}

function renderAttempts() {
  recent.hidden = attempts.length === 0;
  averageEl.hidden = attempts.length < 2;
  if (attempts.length >= 2) {
    const mean = Reaction.average(attempts.map((attempt) => attempt.ms));
    averageEl.textContent = `Average ${Math.round(mean)} ms`;
  }
  attemptsEl.replaceChildren();
  for (const attempt of attempts) {
    const item = document.createElement("li");
    const time = document.createElement("span");
    time.textContent = `${attempt.ms} ms`;
    const word = document.createElement("span");
    word.textContent = attempt.label;
    item.append(time, word);
    attemptsEl.append(item);
  }
}

function beginWait() {
  window.clearTimeout(waitTimer);
  setStage("wait", "", "", "Wait for green");
  status.textContent = "Wait for green.";
  const delay = Reaction.delayMs();
  waitTimer = window.setTimeout(() => {
    if (state !== "wait") return;
    goAt = performance.now();
    setStage("go", "", "", "Click");
    status.textContent = "Click.";
  }, delay);
}

function tooSoon() {
  window.clearTimeout(waitTimer);
  setStage("soon", "", "Too soon", "Click to try again");
  status.textContent = "Too soon. Click to try again.";
}

function finish(ms) {
  const rounded = Math.round(ms);
  const label = Reaction.describe(rounded);
  attempts.unshift({ ms: rounded, label });
  if (attempts.length > 5) attempts.pop();
  setStage("done", "milliseconds", String(rounded), `${label}. Click to try again`);
  status.textContent = `${rounded} milliseconds. ${label}.`;
  renderAttempts();
}

function stopForHiddenTab() {
  if (state !== "wait" && state !== "go") return;
  window.clearTimeout(waitTimer);
  setStage("idle", "", "", "Click to start");
  status.textContent = "This tab was hidden, so the test stopped.";
}

function press() {
  if (state === "wait") {
    tooSoon();
    return;
  }
  if (state === "go") {
    finish(performance.now() - goAt);
    return;
  }
  beginWait();
}

stage.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  ignoreClick = true;
  press();
});

stage.addEventListener("click", () => {
  if (ignoreClick) {
    ignoreClick = false;
    return;
  }
  press();
});

stage.addEventListener("keydown", (event) => {
  if (event.repeat) event.preventDefault();
});

stage.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopForHiddenTab();
});

setStage("idle", "", "", "Click to start");
