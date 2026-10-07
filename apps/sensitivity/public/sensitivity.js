// Yaw is degrees the camera turns per mouse count at sensitivity 1.
// cm/360 = (360 * 2.54) / (DPI * sensitivity * yaw)
// Fortnite sensitivity is the X-axis percent (8 means 8%).
// Rainbow Six Siege is hip fire at the default multiplier of 0.02.
const GAMES = [
  {
    id: "cs2",
    name: "Counter-Strike 2",
    yaw: 0.022,
    unit: "raw",
    hint: "The sensitivity number in game settings.",
  },
  {
    id: "valorant",
    name: "Valorant",
    yaw: 0.07,
    unit: "raw",
    hint: "The sensitivity number in game settings.",
  },
  {
    id: "apex",
    name: "Apex Legends",
    yaw: 0.022,
    unit: "raw",
    hint: "The sensitivity number in game settings. Same scale as Counter-Strike 2.",
  },
  {
    id: "overwatch2",
    name: "Overwatch 2",
    yaw: 0.0066,
    unit: "raw",
    hint: "The sensitivity number in game settings.",
  },
  {
    id: "cod",
    name: "Call of Duty",
    yaw: 0.0066,
    unit: "raw",
    hint: "Look sensitivity in Modern Warfare, Warzone, and Black Ops. Same scale as Overwatch 2.",
  },
  {
    id: "r6",
    name: "Rainbow Six Siege",
    yaw: 0.005729577951308232,
    unit: "raw",
    hint: "Hip-fire sensitivity, with the default multiplier of 0.02.",
  },
  {
    id: "fortnite",
    name: "Fortnite",
    yaw: 0.005555,
    unit: "percent",
    hint: "The X-axis percent. Enter 8 for 8%.",
  },
];

const CM_PER_INCH = 2.54;

function gameById(id) {
  return GAMES.find((game) => game.id === id) || null;
}

function positive(value) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return number;
}

function cmPer360(dpi, sensitivity, yaw) {
  return (360 * CM_PER_INCH) / (dpi * sensitivity * yaw);
}

function calculate(gameId, dpiInput, sensitivityInput) {
  const game = gameById(gameId);
  const dpi = positive(dpiInput);
  const sensitivity = positive(sensitivityInput);
  if (!game || dpi === null || sensitivity === null) return null;

  const cm = cmPer360(dpi, sensitivity, game.yaw);
  const inches = cm / CM_PER_INCH;
  const counts = 360 / (game.yaw * sensitivity);
  const edpi = game.unit === "percent" ? dpi * (sensitivity / 100) : dpi * sensitivity;

  const equivalents = GAMES.map((other) => ({
    id: other.id,
    name: other.name,
    unit: other.unit,
    sensitivity: (360 * CM_PER_INCH) / (cm * dpi * other.yaw),
    current: other.id === game.id,
  }));

  return { game, dpi, sensitivity, cm, inches, counts, edpi, equivalents };
}

function formatSensitivity(value, unit) {
  if (!Number.isFinite(value)) return "";
  if (unit === "percent") return `${value.toFixed(2)}%`;
  if (Math.abs(value) >= 10) return value.toFixed(2);
  if (Math.abs(value) >= 1) return value.toFixed(3);
  return value.toFixed(4);
}

function formatFixed(value) {
  if (!Number.isFinite(value)) return "";
  return value.toFixed(2);
}

function formatGrouped(value) {
  if (!Number.isFinite(value)) return "";
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const Sensitivity = {
  GAMES,
  gameById,
  calculate,
  formatSensitivity,
  formatFixed,
  formatGrouped,
};

globalThis.Sensitivity = Sensitivity;
