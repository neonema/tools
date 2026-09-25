const presetList = document.getElementById("preset-list");
const freqSelect = document.getElementById("freq-select");
const builderFields = document.getElementById("builder-fields");
const cronInput = document.getElementById("cron-input");
const copyBtn = document.getElementById("copy-btn");
const clearBtn = document.getElementById("clear-btn");
const statusEl = document.getElementById("status");
const descriptionEl = document.getElementById("description");
const partsEl = document.getElementById("parts");
const nextList = document.getElementById("next-list");

const DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const PRESETS = [
  { label: "Every 15 minutes", expr: "*/15 * * * *" },
  { label: "Every hour", expr: "0 * * * *" },
  { label: "Every 4 hours", expr: "0 */4 * * *" },
  { label: "Every day at midnight", expr: "0 0 * * *" },
  { label: "Every day at 2:00", expr: "0 2 * * *" },
  { label: "Every day at 9:00", expr: "0 9 * * *" },
  { label: "Twice a day (00:00 & 12:00)", expr: "0 0,12 * * *" },
  { label: "Weekdays at 9:00", expr: "0 9 * * 1-5" },
  { label: "Every Monday at 9:00", expr: "0 9 * * 1" },
  { label: "Every Sunday at midnight", expr: "0 0 * * 0" },
  { label: "1st of month at midnight", expr: "0 0 1 * *" },
];

const FIELD_META = [
  { key: "minute", label: "Minute", min: 0, max: 59 },
  { key: "hour", label: "Hour", min: 0, max: 23 },
  { key: "day", label: "Day of month", min: 1, max: 31 },
  { key: "month", label: "Month", min: 1, max: 12 },
  { key: "weekday", label: "Day of week", min: 0, max: 7 },
];

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.dataset.state = isError ? "error" : "ok";
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatClock(h, m) {
  return `${pad2(h)}:${pad2(m)}`;
}

/** Expand a single cron field into a sorted unique list of integers. */
function expandField(field, min, max, { sundayAlias = false } = {}) {
  const values = new Set();

  for (const part of field.split(",")) {
    const stepMatch = part.match(/^(.+)\/(\d+)$/);
    const step = stepMatch ? Number(stepMatch[2]) : 1;
    const rangePart = stepMatch ? stepMatch[1] : part;

    if (!Number.isInteger(step) || step < 1) {
      throw new Error(`Invalid step in "${field}".`);
    }

    let start;
    let end;
    if (rangePart === "*") {
      start = min;
      end = max;
    } else if (rangePart.includes("-")) {
      const [a, b] = rangePart.split("-");
      start = Number(a);
      end = Number(b);
      if (!Number.isInteger(start) || !Number.isInteger(end)) {
        throw new Error(`Invalid range in "${field}".`);
      }
    } else {
      start = Number(rangePart);
      end = start;
      if (!Number.isInteger(start)) {
        throw new Error(`Invalid value in "${field}".`);
      }
    }

    if (start > end) throw new Error(`Invalid range in "${field}".`);
    for (let i = start; i <= end; i += step) {
      if (i < min || i > max) throw new Error(`Value ${i} out of range for this field.`);
      values.add(i);
      if (sundayAlias && (i === 0 || i === 7)) {
        values.add(0);
        values.add(7);
      }
    }
  }

  return [...values].sort((a, b) => a - b);
}

function parseCron(expr) {
  const cleaned = expr.trim().replace(/\s+/g, " ");
  if (!cleaned) throw new Error("Enter a cron expression.");

  const parts = cleaned.split(" ");
  if (parts.length !== 5) {
    throw new Error("Use a standard 5-field cron: minute hour day month weekday.");
  }

  return {
    raw: cleaned,
    minute: expandField(parts[0], 0, 59),
    hour: expandField(parts[1], 0, 23),
    day: expandField(parts[2], 1, 31),
    month: expandField(parts[3], 1, 12),
    weekday: expandField(parts[4], 0, 7, { sundayAlias: true }),
    parts,
  };
}

function describeList(values, min, max, nameFn) {
  if (values.length === max - min + 1 || (min === 0 && max === 7 && new Set(values.map((v) => (v === 7 ? 0 : v))).size === 7)) {
    return "every";
  }
  if (values.length === 1) return nameFn(values[0]);

  // Detect step patterns like */n
  const span = max - min + 1;
  if (values.length > 1) {
    const step = values[1] - values[0];
    const looksStepped =
      step > 1 &&
      values.every((v, i) => i === 0 || v - values[i - 1] === step) &&
      values[0] === min &&
      values.length === Math.floor((max - min) / step) + 1;
    // For weekday 0-7 with both Sundays, length checks differ — keep simple list
    if (looksStepped && values.length === Math.ceil(span / step)) {
      return `every ${step}`;
    }
  }

  return values.map(nameFn).join(", ");
}

function describeCron(parsed) {
  const { parts, minute, hour, day, month, weekday } = parsed;
  const isEveryDay = parts[2] === "*";
  const isEveryMonth = parts[3] === "*";
  const isEveryWeekday = parts[4] === "*";

  const minDesc = describeList(minute, 0, 59, String);
  const hourDesc = describeList(hour, 0, 23, String);
  const dayDesc = describeList(day, 1, 31, String);
  const monthDesc = describeList(month, 1, 12, (m) => MONTH_NAMES[m - 1]);
  const dowUnique = [...new Set(weekday.map((d) => (d === 7 ? 0 : d)))].sort((a, b) => a - b);
  const dowDesc = describeList(dowUnique, 0, 6, (d) => DOW_NAMES[d]);

  // Friendly shortcuts for common job schedules
  if (
    minute.length === 1 &&
    hour.length === 1 &&
    isEveryDay &&
    isEveryMonth &&
    isEveryWeekday
  ) {
    return `Every day at ${formatClock(hour[0], minute[0])}`;
  }

  if (
    minute.length === 1 &&
    hour.length === 1 &&
    isEveryDay &&
    isEveryMonth &&
    parts[4] === "1-5"
  ) {
    return `Weekdays (Mon–Fri) at ${formatClock(hour[0], minute[0])}`;
  }

  if (
    minute.length === 1 &&
    hour.length === 1 &&
    isEveryDay &&
    isEveryMonth &&
    dowUnique.length === 1
  ) {
    return `Every ${DOW_NAMES[dowUnique[0]]} at ${formatClock(hour[0], minute[0])}`;
  }

  if (parts[0] === "0" && /^(\*|\*\/\d+)$/.test(parts[1]) && isEveryDay && isEveryMonth && isEveryWeekday) {
    if (parts[1] === "*") return "Every hour, on the hour";
    const step = Number(parts[1].slice(2));
    return `Every ${step} hours, on the hour`;
  }

  if (/^\*\/\d+$/.test(parts[0]) && parts[1] === "*" && isEveryDay && isEveryMonth && isEveryWeekday) {
    const step = Number(parts[0].slice(2));
    return `Every ${step} minutes`;
  }

  if (
    minute.length === 1 &&
    hour.length === 1 &&
    day.length === 1 &&
    isEveryMonth &&
    isEveryWeekday
  ) {
    return `On day ${day[0]} of every month at ${formatClock(hour[0], minute[0])}`;
  }

  const bits = [];
  bits.push(minDesc === "every" ? "every minute" : minDesc.startsWith("every ") ? `${minDesc} minutes` : `at minute ${minDesc}`);
  bits.push(hourDesc === "every" ? "every hour" : hourDesc.startsWith("every ") ? `${hourDesc} hours` : `at hour ${hourDesc}`);
  if (!isEveryDay) bits.push(dayDesc.startsWith("every ") ? `${dayDesc} day-of-month` : `on day ${dayDesc}`);
  if (!isEveryMonth) bits.push(monthDesc === "every" ? "every month" : `in ${monthDesc}`);
  if (!isEveryWeekday) bits.push(dowDesc === "every" ? "every weekday" : `on ${dowDesc}`);
  return bits.join(", ");
}

function matchesField(values, value, isWeekday = false) {
  if (isWeekday) {
    return values.includes(value) || (value === 0 && values.includes(7)) || (value === 7 && values.includes(0));
  }
  return values.includes(value);
}

/**
 * Cron DOM+DOW rule: if both are restricted, match either (OR).
 * If only one is restricted, that one must match.
 */
function dayMatches(date, parsed) {
  const domRestricted = parsed.parts[2] !== "*";
  const dowRestricted = parsed.parts[4] !== "*";
  const domOk = matchesField(parsed.day, date.getDate());
  const dowOk = matchesField(parsed.weekday, date.getDay(), true);

  if (domRestricted && dowRestricted) return domOk || dowOk;
  if (domRestricted) return domOk;
  if (dowRestricted) return dowOk;
  return true;
}

function nextRuns(parsed, count = 5, from = new Date()) {
  const results = [];
  const cursor = new Date(from);
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);

  // Cap search: ~2 years of minutes
  const limit = 2 * 366 * 24 * 60;
  for (let i = 0; i < limit && results.length < count; i++) {
    if (
      matchesField(parsed.month, cursor.getMonth() + 1) &&
      matchesField(parsed.hour, cursor.getHours()) &&
      matchesField(parsed.minute, cursor.getMinutes()) &&
      dayMatches(cursor, parsed)
    ) {
      results.push(new Date(cursor));
    }
    cursor.setMinutes(cursor.getMinutes() + 1);
  }
  return results;
}

const nextFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function renderParts(parsed) {
  partsEl.hidden = false;
  partsEl.innerHTML = FIELD_META.map((meta, i) => {
    const raw = parsed.parts[i];
    return `<div class="part"><span class="part-label">${meta.label}</span><code>${escapeHtml(raw)}</code></div>`;
  }).join("");
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderExpression(expr, { fromBuilder = false } = {}) {
  const trimmed = expr.trim();
  if (!trimmed) {
    descriptionEl.textContent = "";
    partsEl.hidden = true;
    partsEl.innerHTML = "";
    nextList.innerHTML = "";
    setStatus("");
    return;
  }

  try {
    const parsed = parseCron(trimmed);
    descriptionEl.textContent = describeCron(parsed);
    renderParts(parsed);
    const runs = nextRuns(parsed, 5);
    nextList.innerHTML = runs.length
      ? runs.map((d) => `<li>${escapeHtml(nextFmt.format(d))}</li>`).join("")
      : "<li>No upcoming runs found in the next two years.</li>";
    setStatus(fromBuilder ? "Built from your schedule." : "Parsed.");
  } catch (error) {
    descriptionEl.textContent = "";
    partsEl.hidden = true;
    partsEl.innerHTML = "";
    nextList.innerHTML = "";
    setStatus(error instanceof Error ? error.message : "Invalid cron.", true);
  }
}

function setExpression(expr, opts) {
  cronInput.value = expr;
  renderExpression(expr, opts);
}

function optionHtml(values, selected) {
  return values
    .map(([value, label]) => `<option value="${value}"${String(value) === String(selected) ? " selected" : ""}>${label}</option>`)
    .join("");
}

function hourOptions(selected = 2) {
  return optionHtml(
    Array.from({ length: 24 }, (_, h) => [h, formatClock(h, 0).slice(0, 2) + ":00"]),
    selected,
  );
}

function minuteOptions(selected = 0) {
  return optionHtml(
    Array.from({ length: 60 }, (_, m) => [m, pad2(m)]),
    selected,
  );
}

function renderBuilderFields() {
  const freq = freqSelect.value;
  let html = "";

  if (freq === "minutes") {
    html = `
      <label for="every-n">Every N minutes</label>
      <input id="every-n" type="number" min="1" max="59" value="15" />
    `;
  } else if (freq === "hours") {
    html = `
      <label for="every-n">Every N hours</label>
      <input id="every-n" type="number" min="1" max="23" value="4" />
      <label for="at-minute">At minute</label>
      <select id="at-minute">${minuteOptions(0)}</select>
    `;
  } else if (freq === "daily" || freq === "weekdays") {
    html = `
      <div class="time-row">
        <div>
          <label for="at-hour">Hour</label>
          <select id="at-hour">${hourOptions(2)}</select>
        </div>
        <div>
          <label for="at-minute">Minute</label>
          <select id="at-minute">${minuteOptions(0)}</select>
        </div>
      </div>
    `;
  } else if (freq === "weekly") {
    html = `
      <label for="weekday">Day of week</label>
      <select id="weekday">
        ${optionHtml(
          DOW_NAMES.map((name, i) => [i, name]),
          1,
        )}
      </select>
      <div class="time-row">
        <div>
          <label for="at-hour">Hour</label>
          <select id="at-hour">${hourOptions(9)}</select>
        </div>
        <div>
          <label for="at-minute">Minute</label>
          <select id="at-minute">${minuteOptions(0)}</select>
        </div>
      </div>
    `;
  } else if (freq === "monthly") {
    html = `
      <label for="month-day">Day of month</label>
      <input id="month-day" type="number" min="1" max="31" value="1" />
      <div class="time-row">
        <div>
          <label for="at-hour">Hour</label>
          <select id="at-hour">${hourOptions(0)}</select>
        </div>
        <div>
          <label for="at-minute">Minute</label>
          <select id="at-minute">${minuteOptions(0)}</select>
        </div>
      </div>
    `;
  }

  builderFields.innerHTML = html;
  builderFields.querySelectorAll("input, select").forEach((el) => {
    el.addEventListener("input", applyBuilder);
    el.addEventListener("change", applyBuilder);
  });
  applyBuilder();
}

function applyBuilder() {
  const freq = freqSelect.value;
  let expr = "";

  if (freq === "minutes") {
    const n = clampInt(document.getElementById("every-n")?.value, 1, 59, 15);
    expr = n === 1 ? "* * * * *" : `*/${n} * * * *`;
  } else if (freq === "hours") {
    const n = clampInt(document.getElementById("every-n")?.value, 1, 23, 4);
    const minute = clampInt(document.getElementById("at-minute")?.value, 0, 59, 0);
    const hourField = n === 1 ? "*" : `*/${n}`;
    expr = `${minute} ${hourField} * * *`;
  } else if (freq === "daily") {
    const hour = clampInt(document.getElementById("at-hour")?.value, 0, 23, 2);
    const minute = clampInt(document.getElementById("at-minute")?.value, 0, 59, 0);
    expr = `${minute} ${hour} * * *`;
  } else if (freq === "weekdays") {
    const hour = clampInt(document.getElementById("at-hour")?.value, 0, 23, 2);
    const minute = clampInt(document.getElementById("at-minute")?.value, 0, 59, 0);
    expr = `${minute} ${hour} * * 1-5`;
  } else if (freq === "weekly") {
    const dow = clampInt(document.getElementById("weekday")?.value, 0, 6, 1);
    const hour = clampInt(document.getElementById("at-hour")?.value, 0, 23, 9);
    const minute = clampInt(document.getElementById("at-minute")?.value, 0, 59, 0);
    expr = `${minute} ${hour} * * ${dow}`;
  } else if (freq === "monthly") {
    const day = clampInt(document.getElementById("month-day")?.value, 1, 31, 1);
    const hour = clampInt(document.getElementById("at-hour")?.value, 0, 23, 0);
    const minute = clampInt(document.getElementById("at-minute")?.value, 0, 59, 0);
    expr = `${minute} ${hour} ${day} * *`;
  }

  setExpression(expr, { fromBuilder: true });
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isInteger(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// Presets
presetList.innerHTML = PRESETS.map(
  (p) =>
    `<button type="button" class="preset-btn" data-expr="${escapeHtml(p.expr)}"><span class="preset-label">${escapeHtml(p.label)}</span><code>${escapeHtml(p.expr)}</code></button>`,
).join("");

presetList.addEventListener("click", (event) => {
  const btn = event.target.closest(".preset-btn");
  if (!btn) return;
  setExpression(btn.dataset.expr);
});

freqSelect.addEventListener("change", renderBuilderFields);

cronInput.addEventListener("input", () => renderExpression(cronInput.value));

copyBtn.addEventListener("click", async () => {
  const text = cronInput.value.trim();
  if (!text) {
    setStatus("Nothing to copy.", true);
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Copied expression.");
  } catch {
    setStatus("Copy failed — select the expression and copy manually.", true);
  }
});

clearBtn.addEventListener("click", () => {
  cronInput.value = "";
  renderExpression("");
  cronInput.focus();
});

renderBuilderFields();
