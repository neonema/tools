import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const generatePath = path.join(here, "..", "public", "generate.js");
const appPath = path.join(here, "..", "public", "app.js");
const src = readFileSync(generatePath, "utf8");
const appSrc = readFileSync(appPath, "utf8");

let failed = 0;

function assert(condition, message) {
  if (!condition) {
    failed += 1;
    console.error(`  ✗ ${message}`);
  }
}

const sandbox = {
  crypto: webcrypto,
  Uint32Array,
  Math,
  console,
};
sandbox.globalThis = sandbox;
vm.runInNewContext(src, sandbox, { filename: "generate.js" });

const gen = sandbox.PasswordGenerator;
assert(gen && typeof gen.generatePassword === "function", "PasswordGenerator is exported");

assert(!src.includes("Math.random"), "generate.js must not use Math.random");
assert(!appSrc.includes("Math.random"), "app.js must not use Math.random");

const defaultResult = gen.generatePassword(gen.DEFAULT_OPTIONS);
assert(defaultResult.ok, "default options generate a password");
assert(
  defaultResult.password.length === gen.DEFAULT_LENGTH,
  `default length is ${gen.DEFAULT_LENGTH}`,
);

const { charset: defaultCharset } = gen.buildCharset(gen.DEFAULT_OPTIONS);
assert(defaultCharset.length === 26 + 26 + 10 + 8 + 5, "default charset is lower+upper+digits+common+safe extras");

const empty = gen.generatePassword({
  ...gen.DEFAULT_OPTIONS,
  lowercase: false,
  uppercase: false,
  numbers: false,
  common: false,
  safeExtras: false,
  extra: false,
  rarelyAccepted: false,
});
assert(!empty.ok, "no groups returns an error");
assert(empty.error.includes("at least one"), "empty charset error names the problem");

const tooShort = gen.generatePassword({ ...gen.DEFAULT_OPTIONS, length: 7 });
assert(!tooShort.ok && tooShort.error.includes("between"), "length 7 is rejected");

const tooLong = gen.generatePassword({ ...gen.DEFAULT_OPTIONS, length: 65 });
assert(!tooLong.ok && tooLong.error.includes("between"), "length 65 is rejected");

const extraOff = gen.generatePassword({
  ...gen.DEFAULT_OPTIONS,
  extra: false,
  rarelyAccepted: false,
});
assert(extraOff.ok, "generate with extra/rarely off");
for (const ch of extraOff.password) {
  assert(defaultCharset.includes(ch), `glyph "${ch}" is in the enabled charset`);
}

const extraChars = gen.GROUPS.extra.chars;
const rarelyChars = gen.GROUPS.rarelyAccepted.chars;
let leakedExtra = false;
let leakedRare = false;
for (let i = 0; i < 80; i += 1) {
  const result = gen.generatePassword({
    ...gen.DEFAULT_OPTIONS,
    extra: false,
    rarelyAccepted: false,
  });
  for (const ch of result.password) {
    if (extraChars.includes(ch)) leakedExtra = true;
    if (rarelyChars.includes(ch)) leakedRare = true;
  }
}
assert(!leakedExtra, "disabled Extra glyphs never appear");
assert(!leakedRare, "disabled Rarely accepted glyphs never appear");

const similarSet = new Set(gen.SIMILAR_CHARS);
let similarLeaked = false;
for (let i = 0; i < 80; i += 1) {
  const result = gen.generatePassword({
    ...gen.DEFAULT_OPTIONS,
    extra: true,
    rarelyAccepted: true,
    excludeSimilar: true,
  });
  assert(result.ok, "exclude-similar still generates");
  for (const ch of result.password) {
    if (similarSet.has(ch)) similarLeaked = true;
  }
}
assert(!similarLeaked, "exclude-similar drops 0 O o 1 l I |");

const { charset: similarCharset } = gen.buildCharset({
  ...gen.DEFAULT_OPTIONS,
  excludeSimilar: true,
});
assert(!similarCharset.includes("0"), "exclude-similar removes 0 from charset");
assert(similarCharset.includes("2"), "exclude-similar keeps other digits");

for (let i = 0; i < 40; i += 1) {
  const result = gen.generatePassword({
    length: 20,
    lowercase: true,
    uppercase: true,
    numbers: true,
    common: true,
    safeExtras: false,
    extra: false,
    rarelyAccepted: false,
    excludeSimilar: false,
  });
  assert(result.ok, "four-group generate succeeds");
  const lower = /[a-z]/.test(result.password);
  const upper = /[A-Z]/.test(result.password);
  const digit = /[0-9]/.test(result.password);
  const common = /[!@#$%^&*]/.test(result.password);
  assert(lower && upper && digit && common, "each enabled group appears at least once");
}

const extraOn = gen.generatePassword({
  ...gen.DEFAULT_OPTIONS,
  extra: true,
  length: 24,
});
assert(extraOn.ok, "extra group generate succeeds");
assert(
  extraOn.password.split("").some((ch) => extraChars.includes(ch)),
  "Extra group is represented when enabled",
);

const bound = 0x100000000;
const rejected = 0xffffffff;
assert(rejected >= bound - (bound % 3), "0xffffffff is in the biased remainder for length 3");

let rngCalls = 0;
function scriptedRng(buf) {
  rngCalls += 1;
  buf[0] = rngCalls === 1 ? rejected : 0;
}
const sampled = gen.pickUniformIndex(3, scriptedRng);
assert(sampled === 0, "rejection sampling maps an accepted value uniformly");
assert(rngCalls === 2, "values in the biased remainder are skipped");

assert(gen.entropyBits(20, 75) > 120, "entropy for default-sized charset is above 120 bits");
assert(gen.strengthLabel(30) === "weak", "strength: weak");
assert(gen.strengthLabel(50) === "ok", "strength: ok");
assert(gen.strengthLabel(70) === "strong", "strength: strong");
assert(gen.strengthLabel(90) === "very strong", "strength: very strong");

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}

console.log("test:password passed");
