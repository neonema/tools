// Standalone harness: extract converter helpers from public/app.js and
// exercise every CONVERTER_ROUTES pair against the samples wired up in
// CONVERTER_SOURCE_META, both valid and invalid, plus md-table samples
// (no md-table -> json route exists in the MVP, but the sample is exposed
// when from=md-table, so we record what happens at runtime).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

const here = path.dirname(fileURLToPath(import.meta.url));
const appPath = path.join(here, "..", "public", "app.js");
const src = readFileSync(appPath, "utf8");

// Stub a minimal DOM so the file evaluates without throwing.
function stubElement() {
  const handlers = {};
  const el = {
    value: "",
    textContent: "",
    placeholder: "",
    hidden: false,
    classList: { add() {}, remove() {}, toggle() {} },
    style: {},
    dataset: {},
    options: [],
    selectedIndex: 0,
    innerHTML: "",
    addEventListener(type, fn) { (handlers[type] ||= []).push(fn); },
    removeEventListener() {},
    setAttribute() {},
    getAttribute() { return ""; },
    appendChild() {},
    removeChild() {},
    querySelector() { return stubElement(); },
    querySelectorAll() { return []; },
    focus() {},
    click() {}
  };
  return el;
}

const elements = new Map();
function getEl(id) {
  if (!elements.has(id)) elements.set(id, stubElement());
  return elements.get(id);
}

const document = {
  getElementById: (id) => getEl(id),
  querySelector: () => stubElement(),
  querySelectorAll: () => [],
  createElement: () => stubElement(),
  body: stubElement(),
  activeElement: null
};

const windowStub = {
  location: { href: "http://localhost/", pathname: "/", search: "", hash: "" },
  history: { replaceState() {} },
  addEventListener() {},
  adsbygoogle: { push() {} }
};

const sandbox = {
  window: windowStub,
  document,
  navigator: { clipboard: { writeText: async () => {} } },
  history: windowStub.history,
  URL,
  URLSearchParams,
  Blob: class { constructor(parts) { this.size = parts.join("").length; } },
  FileReader: class {},
  setTimeout,
  clearTimeout,
  requestAnimationFrame: (fn) => fn(),
  console
};
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
// Expose internal functions/constants we need.
const epilogue = `
;globalThis.__exports = {
  CONVERTER_ROUTES,
  CONVERTER_SOURCE_META,
  SAMPLE_VALID,
  SAMPLE_INVALID
};
`;
vm.runInContext(src + epilogue, sandbox);
const { CONVERTER_ROUTES, CONVERTER_SOURCE_META, SAMPLE_VALID, SAMPLE_INVALID } = sandbox.__exports;

// from-format → samples used for the source textarea (matches loadSample()).
const FROM_SAMPLES = {
  json: { valid: SAMPLE_VALID, invalid: SAMPLE_INVALID },
  csv: { valid: CONVERTER_SOURCE_META.csv.validSample, invalid: CONVERTER_SOURCE_META.csv.invalidSample },
  yaml: { valid: CONVERTER_SOURCE_META.yaml.validSample, invalid: CONVERTER_SOURCE_META.yaml.invalidSample },
  "js-object": { valid: CONVERTER_SOURCE_META["js-object"].validSample, invalid: CONVERTER_SOURCE_META["js-object"].invalidSample },
  "md-table": { valid: CONVERTER_SOURCE_META["md-table"].validSample, invalid: CONVERTER_SOURCE_META["md-table"].invalidSample }
};

const PAIRS_TO_TEST = [
  ["csv", "json"],
  ["yaml", "json"],
  ["js-object", "json"],
  ["json", "csv"],
  ["json", "yaml"],
  ["json", "md-table"],
  ["md-table", "json"] // route does not exist; UI falls through to "Pair unavailable"
];

let failed = 0;
const lines = [];

function record(label, status, detail) {
  const tag = status === "PASS" ? "PASS" : status === "FAIL" ? "FAIL" : status;
  if (status === "FAIL") failed += 1;
  lines.push(`[${tag}] ${label}`);
  if (detail) {
    for (const ln of String(detail).split("\n")) lines.push(`       ${ln}`);
  }
}

function tryConvert(routeKey, input) {
  const fn = CONVERTER_ROUTES[routeKey];
  if (!fn) return { kind: "missing" };
  try {
    const result = fn(input);
    return { kind: "ok", result };
  } catch (error) {
    return { kind: "throw", error };
  }
}

for (const [from, to] of PAIRS_TO_TEST) {
  const routeKey = `${from}->${to}`;
  const samples = FROM_SAMPLES[from];
  if (!samples) {
    record(`${routeKey} (no sample for from=${from})`, "SKIP");
    continue;
  }

  // Valid sample
  {
    const outcome = tryConvert(routeKey, samples.valid);
    if (outcome.kind === "missing") {
      record(`${routeKey} valid sample`, "SKIP", "route not registered (UI shows 'Pair unavailable')");
    } else if (outcome.kind === "ok") {
      const preview = String(outcome.result.output ?? "").split("\n").slice(0, 4).join(" | ");
      record(`${routeKey} valid sample`, "PASS", `output preview: ${preview}`);
    } else {
      record(`${routeKey} valid sample`, "FAIL", `unexpected throw: ${outcome.error.message}`);
    }
  }

  // Invalid sample - we expect *either* a throw with a meaningful message
  // (UI surfaces it via showStatus("Conversion failed")) OR a graceful pass
  // when the parser is permissive.
  {
    const outcome = tryConvert(routeKey, samples.invalid);
    if (outcome.kind === "missing") {
      record(`${routeKey} invalid sample`, "SKIP", "route not registered");
    } else if (outcome.kind === "throw") {
      const msg = outcome.error.message || String(outcome.error);
      record(`${routeKey} invalid sample`, "PASS", `error surfaced: ${msg.split("\n")[0]}`);
    } else {
      const preview = String(outcome.result.output ?? "").split("\n").slice(0, 2).join(" | ");
      record(`${routeKey} invalid sample`, "WARN", `parser was lenient, no error thrown. preview: ${preview}`);
    }
  }
}

console.log(lines.join("\n"));
console.log("");
console.log(failed === 0 ? "All conversions executed without unexpected failures." : `${failed} unexpected failure(s).`);
process.exit(failed === 0 ? 0 : 1);
