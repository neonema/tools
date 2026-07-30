const localTimeEl = document.getElementById("local-time");
const localDateEl = document.getElementById("local-date");
const utcTimeEl = document.getElementById("utc-time");
const utcDateEl = document.getElementById("utc-date");
const dstLineEl = document.getElementById("dst-line");

const timeOpts = {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
};

const dateOpts = {
  weekday: "short",
  year: "numeric",
  month: "short",
  day: "numeric",
};

let lastSecondKey = "";
/** @type {ReturnType<typeof setInterval> | null} */
let fallbackIntervalId = null;

function getTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** Signed UTC offset in minutes (e.g. UTC−7 → −420). */
function getUtcOffsetMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );

  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );

  return (asUtc - date.getTime()) / 60000;
}

/**
 * DST is in effect when the zone's Jan/Jul offsets differ and the current
 * offset matches the daylight (larger signed) offset.
 * Zones that never change report "not observed".
 */
function getDstStatus(date, timeZone) {
  const year = date.getUTCFullYear();
  const janOffset = getUtcOffsetMinutes(new Date(Date.UTC(year, 0, 1)), timeZone);
  const julOffset = getUtcOffsetMinutes(new Date(Date.UTC(year, 6, 1)), timeZone);

  if (janOffset === julOffset) {
    return { observes: false, inEffect: false };
  }

  const standardOffset = Math.min(janOffset, julOffset);
  const currentOffset = getUtcOffsetMinutes(date, timeZone);
  return { observes: true, inEffect: currentOffset !== standardOffset };
}

function formatClock(date, timeZone) {
  const timeParts = new Intl.DateTimeFormat("en-GB", {
    ...timeOpts,
    timeZone,
  }).formatToParts(date);
  const get = (type) => timeParts.find((part) => part.type === type)?.value ?? "00";
  return {
    time: `${get("hour")}:${get("minute")}:${get("second")}`,
    date: new Intl.DateTimeFormat(undefined, { ...dateOpts, timeZone }).format(date),
  };
}

function render(now = new Date()) {
  const timeZone = getTimeZone();
  const secondKey = [
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds(),
  ].join("-");
  if (secondKey === lastSecondKey) return;
  lastSecondKey = secondKey;

  const local = formatClock(now, timeZone);
  localTimeEl.textContent = local.time;
  localDateEl.textContent = local.date;

  const utc = formatClock(now, "UTC");
  utcTimeEl.textContent = utc.time;
  utcDateEl.textContent = utc.date;

  const dst = getDstStatus(now, timeZone);
  if (!dst.observes) {
    dstLineEl.textContent = "Daylight saving is not observed in this time zone";
    dstLineEl.dataset.state = "none";
  } else if (dst.inEffect) {
    dstLineEl.textContent = "Daylight saving is in effect";
    dstLineEl.dataset.state = "on";
  } else {
    dstLineEl.textContent = "Daylight saving is not in effect";
    dstLineEl.dataset.state = "off";
  }
}

/**
 * Called by the hub parent on a live timer. Same-origin iframes can have
 * their own timers frozen; the parent heartbeat keeps this tool updating.
 */
function heartbeat() {
  try {
    render(new Date());
  } catch (error) {
    console.error("utc render failed:", error);
  }
}

window.neonemaToolHeartbeat = heartbeat;

function startFallbackInterval() {
  if (fallbackIntervalId != null) return;
  fallbackIntervalId = setInterval(heartbeat, 250);
}

// Standalone / first paint
heartbeat();
startFallbackInterval();

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
