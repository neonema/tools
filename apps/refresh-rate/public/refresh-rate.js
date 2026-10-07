const COMMON_RATES = [60, 75, 90, 100, 120, 144, 165, 180, 240, 300, 360, 480, 500];

function hzFromFrameTimes(times) {
  if (!Array.isArray(times) || times.length < 2) return null;
  const elapsed = times[times.length - 1] - times[0];
  if (!(elapsed > 0)) return null;
  return ((times.length - 1) / elapsed) * 1000;
}

function nearestCommonRate(hz) {
  if (!Number.isFinite(hz) || hz <= 0) return null;
  let best = null;
  let bestGap = Infinity;
  for (const rate of COMMON_RATES) {
    const gap = Math.abs(hz - rate);
    if (gap < bestGap) {
      best = rate;
      bestGap = gap;
    }
  }
  const limit = Math.max(2, best * 0.02);
  return bestGap <= limit ? best : null;
}

const RefreshRate = {
  COMMON_RATES,
  SAMPLE_MS: 2000,
  hzFromFrameTimes,
  nearestCommonRate,
};

globalThis.RefreshRate = RefreshRate;
