const nowSecondsEl = document.getElementById("now-seconds");
const nowMillisEl = document.getElementById("now-millis");
const copySecondsBtn = document.getElementById("copy-seconds-btn");
const copyMillisBtn = document.getElementById("copy-millis-btn");

const epochInput = document.getElementById("epoch-input");
const useNowBtn = document.getElementById("use-now-btn");
const clearEpochBtn = document.getElementById("clear-epoch-btn");
const epochStatus = document.getElementById("epoch-status");
const epochResults = document.getElementById("epoch-results");
const detectedUnitEl = document.getElementById("detected-unit");
const epochUtcEl = document.getElementById("epoch-utc");
const epochLocalEl = document.getElementById("epoch-local");
const epochIsoEl = document.getElementById("epoch-iso");
const epochRelativeEl = document.getElementById("epoch-relative");

const datetimeInput = document.getElementById("datetime-input");
const isoInput = document.getElementById("iso-input");
const convertDateBtn = document.getElementById("convert-date-btn");
const clearDateBtn = document.getElementById("clear-date-btn");
const dateStatus = document.getElementById("date-status");
const dateResults = document.getElementById("date-results");
const outSecondsEl = document.getElementById("out-seconds");
const outMillisEl = document.getElementById("out-millis");
const copyOutSecondsBtn = document.getElementById("copy-out-seconds-btn");
const copyOutMillisBtn = document.getElementById("copy-out-millis-btn");

/** @type {ReturnType<typeof setInterval> | null} */
let fallbackIntervalId = null;
let lastSecondKey = "";

const dateTimeOpts = {
  weekday: "short",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
};

const relativeFmt = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

function setStatus(el, message, isError = false) {
  el.textContent = message;
  el.dataset.state = isError ? "error" : "ok";
}

async function copyText(text, successMessage, statusEl) {
  if (!text) {
    setStatus(statusEl, "Nothing to copy.", true);
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    setStatus(statusEl, successMessage);
  } catch {
    setStatus(statusEl, "Copy failed — select the value and copy manually.", true);
  }
}

function formatDateTime(date, timeZone) {
  return new Intl.DateTimeFormat(undefined, { ...dateTimeOpts, timeZone }).format(date);
}

function formatRelative(date, now = new Date()) {
  const diffMs = date.getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const divisions = [
    { unit: "year", ms: 365.25 * 24 * 60 * 60 * 1000 },
    { unit: "month", ms: 30.44 * 24 * 60 * 60 * 1000 },
    { unit: "day", ms: 24 * 60 * 60 * 1000 },
    { unit: "hour", ms: 60 * 60 * 1000 },
    { unit: "minute", ms: 60 * 1000 },
    { unit: "second", ms: 1000 },
  ];

  for (const { unit, ms } of divisions) {
    if (abs >= ms || unit === "second") {
      return relativeFmt.format(Math.round(diffMs / ms), /** @type {Intl.RelativeTimeFormatUnit} */ (unit));
    }
  }
  return "now";
}

/**
 * Heuristic used by most epoch converters:
 * 1–10 digits → seconds; 11–13 → milliseconds; longer → microseconds/nanoseconds truncated to ms.
 */
function parseEpochInput(raw) {
  const cleaned = raw.trim().replace(/[_,\s]/g, "");
  if (!cleaned) return null;
  if (!/^-?\d+$/.test(cleaned)) {
    throw new Error("Enter a whole-number Unix timestamp.");
  }

  const digits = cleaned.replace("-", "").length;
  const value = Number(cleaned);
  if (!Number.isSafeInteger(value)) {
    throw new Error("Timestamp is outside the safe integer range.");
  }

  let millis;
  let unit;
  if (digits <= 10) {
    millis = value * 1000;
    unit = "seconds";
  } else if (digits <= 13) {
    millis = value;
    unit = "milliseconds";
  } else if (digits <= 16) {
    millis = Math.trunc(value / 1000);
    unit = "microseconds → ms";
  } else {
    millis = Math.trunc(value / 1_000_000);
    unit = "nanoseconds → ms";
  }

  const date = new Date(millis);
  if (Number.isNaN(date.getTime())) {
    throw new Error("That timestamp does not produce a valid date.");
  }
  return { date, unit, millis };
}

function toDatetimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function renderNow(now = new Date()) {
  const ms = now.getTime();
  const secondKey = String(Math.floor(ms / 1000));
  nowMillisEl.textContent = String(ms);
  if (secondKey !== lastSecondKey) {
    lastSecondKey = secondKey;
    nowSecondsEl.textContent = secondKey;
  }
}

function convertEpoch() {
  const raw = epochInput.value;
  if (!raw.trim()) {
    epochResults.hidden = true;
    setStatus(epochStatus, "");
    return;
  }

  try {
    const parsed = parseEpochInput(raw);
    if (!parsed) {
      epochResults.hidden = true;
      setStatus(epochStatus, "");
      return;
    }
    const { date, unit } = parsed;
    detectedUnitEl.textContent = unit;
    epochUtcEl.textContent = formatDateTime(date, "UTC");
    epochLocalEl.textContent = formatDateTime(date, undefined);
    epochIsoEl.textContent = date.toISOString();
    epochRelativeEl.textContent = formatRelative(date);
    epochResults.hidden = false;
    setStatus(epochStatus, "Converted.");
  } catch (error) {
    epochResults.hidden = true;
    setStatus(epochStatus, error instanceof Error ? error.message : "Invalid timestamp.", true);
  }
}

function convertDate() {
  const isoRaw = isoInput.value.trim();
  let date = null;

  if (isoRaw) {
    date = new Date(isoRaw);
    if (Number.isNaN(date.getTime())) {
      dateResults.hidden = true;
      setStatus(dateStatus, "Could not parse that ISO 8601 string.", true);
      return;
    }
  } else if (datetimeInput.value) {
    date = new Date(datetimeInput.value);
    if (Number.isNaN(date.getTime())) {
      dateResults.hidden = true;
      setStatus(dateStatus, "Invalid date & time.", true);
      return;
    }
  } else {
    dateResults.hidden = true;
    setStatus(dateStatus, "Pick a date or paste an ISO string.", true);
    return;
  }

  const ms = date.getTime();
  outSecondsEl.textContent = String(Math.floor(ms / 1000));
  outMillisEl.textContent = String(ms);
  dateResults.hidden = false;
  setStatus(dateStatus, "Converted.");

  // Keep the other field in sync when possible
  if (isoRaw && !datetimeInput.value) {
    datetimeInput.value = toDatetimeLocalValue(date);
  } else if (!isoRaw) {
    isoInput.value = date.toISOString();
  }
}

function heartbeat() {
  try {
    renderNow(new Date());
  } catch (error) {
    console.error("epoch render failed:", error);
  }
}

window.neonemaToolHeartbeat = heartbeat;

function startFallbackInterval() {
  if (fallbackIntervalId != null) return;
  fallbackIntervalId = setInterval(heartbeat, 250);
}

epochInput.addEventListener("input", convertEpoch);

useNowBtn.addEventListener("click", () => {
  epochInput.value = String(Math.floor(Date.now() / 1000));
  convertEpoch();
  epochInput.focus();
});

clearEpochBtn.addEventListener("click", () => {
  epochInput.value = "";
  epochResults.hidden = true;
  setStatus(epochStatus, "");
  epochInput.focus();
});

convertDateBtn.addEventListener("click", convertDate);
datetimeInput.addEventListener("change", convertDate);
isoInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    convertDate();
  }
});

clearDateBtn.addEventListener("click", () => {
  datetimeInput.value = "";
  isoInput.value = "";
  dateResults.hidden = true;
  setStatus(dateStatus, "");
});

copySecondsBtn.addEventListener("click", () =>
  copyText(nowSecondsEl.textContent, "Copied seconds.", epochStatus),
);
copyMillisBtn.addEventListener("click", () =>
  copyText(nowMillisEl.textContent, "Copied milliseconds.", epochStatus),
);
copyOutSecondsBtn.addEventListener("click", () =>
  copyText(outSecondsEl.textContent, "Copied seconds.", dateStatus),
);
copyOutMillisBtn.addEventListener("click", () =>
  copyText(outMillisEl.textContent, "Copied milliseconds.", dateStatus),
);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) heartbeat();
});
window.addEventListener("focus", heartbeat);
window.addEventListener("pageshow", heartbeat);
window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) return;
  if (event.data?.source !== "neonema-hub") return;
  if (event.data.type === "heartbeat" || event.data.type === "tool-shown") {
    heartbeat();
  }
});

heartbeat();
startFallbackInterval();

// Seed date→timestamp with now for a useful first paint
const seed = new Date();
datetimeInput.value = toDatetimeLocalValue(seed);
isoInput.value = seed.toISOString();
convertDate();
