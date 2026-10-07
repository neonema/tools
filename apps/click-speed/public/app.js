const stage = document.getElementById("stage");
const kicker = document.getElementById("stage-kicker");
const valueEl = document.getElementById("stage-value");
const labelEl = document.getElementById("stage-label");
const status = document.getElementById("status");
const summary = document.getElementById("summary");
const durationInputs = [...document.querySelectorAll('input[name="duration"]')];
const recent = document.getElementById("recent");
const averageEl = document.getElementById("average");
const attemptsEl = document.getElementById("attempts");

const attempts = [];
let running = false;
let start = 0;
let clicks = 0;
let durationMs = 5000;
let rafId = 0;
let ignoreClick = false;

function selectedSeconds() {
  const checked = durationInputs.find((input) => input.checked);
  const seconds = checked ? Number(checked.value) : 5;
  return ClickSpeed.DURATIONS.includes(seconds) ? seconds : 5;
}

function lockDuration(locked) {
  for (const input of durationInputs) input.disabled = locked;
}

function setStage(state, kickerText, valueText, labelText) {
  stage.dataset.state = state;
  kicker.textContent = kickerText;
  valueEl.textContent = valueText;
  labelEl.textContent = labelText;
}

function renderRunning(count, remainingMs) {
  const secondsLeft = Math.max(0, remainingMs) / 1000;
  setStage("run", "clicks", String(count), `${secondsLeft.toFixed(1)}s left`);
}

function renderAttempts() {
  recent.hidden = attempts.length === 0;
  averageEl.hidden = attempts.length < 2;
  if (attempts.length >= 2) {
    const mean = attempts.reduce((sum, attempt) => sum + attempt.cps, 0) / attempts.length;
    averageEl.textContent = `Average ${ClickSpeed.formatCps(mean)} clicks per second`;
  }
  attemptsEl.replaceChildren();
  for (const attempt of attempts) {
    const item = document.createElement("li");
    const rate = document.createElement("span");
    rate.textContent = `${ClickSpeed.formatCps(attempt.cps)} CPS`;
    const detail = document.createElement("span");
    detail.textContent = `${attempt.clicks} clicks`;
    item.append(rate, detail);
    attemptsEl.append(item);
  }
}

function finish() {
  if (!running) return;
  running = false;
  cancelAnimationFrame(rafId);
  lockDuration(false);
  const seconds = durationMs / 1000;
  const cps = ClickSpeed.perSecond(clicks, seconds);
  attempts.unshift({ cps, clicks, seconds });
  if (attempts.length > 5) attempts.pop();
  setStage("done", "clicks per second", ClickSpeed.formatCps(cps), "Click to try again");
  summary.hidden = false;
  summary.textContent = `${clicks} clicks in ${seconds} seconds.`;
  status.textContent = `${ClickSpeed.formatCps(cps)} clicks per second. ${clicks} clicks in ${seconds} seconds.`;
  renderAttempts();
}

function stopForHiddenTab() {
  if (!running) return;
  running = false;
  cancelAnimationFrame(rafId);
  lockDuration(false);
  setStage("idle", "", "", "Click to start");
  summary.hidden = true;
  status.textContent = "This tab was hidden, so the test stopped.";
}

function tick(now) {
  if (!running) return;
  const elapsed = now - start;
  if (elapsed >= durationMs) {
    finish();
    return;
  }
  renderRunning(clicks, durationMs - elapsed);
  rafId = requestAnimationFrame(tick);
}

function startRun() {
  running = true;
  start = performance.now();
  clicks = 1;
  durationMs = selectedSeconds() * 1000;
  lockDuration(true);
  summary.hidden = true;
  status.textContent = "Test started.";
  renderRunning(clicks, durationMs);
  rafId = requestAnimationFrame(tick);
}

function press() {
  if (!running) {
    startRun();
    return;
  }
  if (performance.now() - start >= durationMs) {
    finish();
    return;
  }
  clicks += 1;
  renderRunning(clicks, durationMs - (performance.now() - start));
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
