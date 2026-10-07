const ClickSpeed = {
  DURATIONS: [5, 10],
  perSecond(clicks, seconds) {
    if (!Number.isFinite(clicks) || clicks < 0) return null;
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    return clicks / seconds;
  },
  formatCps(value) {
    if (!Number.isFinite(value)) return "";
    return value.toFixed(2);
  },
};

globalThis.ClickSpeed = ClickSpeed;
