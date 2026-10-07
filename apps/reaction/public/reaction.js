const MIN_DELAY_MS = 1000;
const MAX_DELAY_MS = 4000;

function delayMs(random) {
  const roll = typeof random === "function" ? random() : Math.random();
  const unit = Number.isFinite(roll) ? Math.min(1, Math.max(0, roll)) : 0;
  return MIN_DELAY_MS + unit * (MAX_DELAY_MS - MIN_DELAY_MS);
}

function describe(ms) {
  if (!Number.isFinite(ms) || ms < 0) return null;
  if (ms < 180) return "Fast";
  if (ms <= 280) return "Typical";
  return "Slow";
}

function average(times) {
  if (!Array.isArray(times) || times.length === 0) return null;
  let sum = 0;
  for (const time of times) {
    if (!Number.isFinite(time)) return null;
    sum += time;
  }
  return sum / times.length;
}

const Reaction = {
  MIN_DELAY_MS,
  MAX_DELAY_MS,
  delayMs,
  describe,
  average,
};

globalThis.Reaction = Reaction;
