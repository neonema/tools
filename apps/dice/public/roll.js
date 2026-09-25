(function (root) {
  const SIDES = [4, 6, 20];
  const MIN_COUNT = 1;
  const MAX_COUNT = 3;
  const UINT32_RANGE = 0x100000000;

  function randomUint32() {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0];
  }

  function rollDie(sides, nextUint32) {
    if (!SIDES.includes(sides)) {
      throw new Error("unsupported die");
    }
    const next = nextUint32 || randomUint32;
    const limit = UINT32_RANGE - (UINT32_RANGE % sides);
    let value;
    do {
      value = next();
    } while (value >= limit);
    return (value % sides) + 1;
  }

  function roll(count, sides, nextUint32) {
    if (!Number.isInteger(count) || count < MIN_COUNT || count > MAX_COUNT) {
      throw new Error("unsupported count");
    }
    const faces = [];
    for (let i = 0; i < count; i += 1) {
      faces.push(rollDie(sides, nextUint32));
    }
    const total = faces.reduce((sum, face) => sum + face, 0);
    return { count, sides, faces, total, notation: `${count}d${sides}` };
  }

  root.DiceRoller = { SIDES, MIN_COUNT, MAX_COUNT, rollDie, roll };
})(globalThis);
