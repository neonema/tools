const sourceInput = document.getElementById("source-input");
const resultOutput = document.getElementById("result-output");
const runBtn = document.getElementById("run-btn");
const secondaryBtn = document.getElementById("secondary-btn");
const copyBtn = document.getElementById("copy-btn");
const downloadBtn = document.getElementById("download-btn");
const clearBtn = document.getElementById("clear-btn");
const status = document.getElementById("status");
const toolCaption = document.getElementById("tool-caption");
const typeOptions = document.getElementById("type-options");
const rootNameInput = document.getElementById("root-name-input");
const typegenFormatRadios = Array.from(document.querySelectorAll('input[name="typegen-format"]'));
const comparePanel = document.getElementById("compare-panel");
const compareInput = document.getElementById("compare-input");
const jsonpathPanel = document.getElementById("jsonpath-panel");
const jsonpathInput = document.getElementById("jsonpath-input");
const converterPanel = document.getElementById("converter-panel");
const convertFromSelect = document.getElementById("convert-from");
const convertToSelect = document.getElementById("convert-to");
const convertSwapBtn = document.getElementById("convert-swap-btn");
const converterHint = document.getElementById("converter-hint");
const sourceLabel = document.getElementById("source-label");
const jsonpathExampleButtons = Array.from(document.querySelectorAll(".jsonpath-example"));
const toolTabs = Array.from(document.querySelectorAll(".tool-tab"));
const sampleButtons = Array.from(document.querySelectorAll("[data-sample]"));
const statsEl = document.getElementById("json-stats");
const statValueEls = {
  size: statsEl.querySelector('[data-stat="size"]'),
  depth: statsEl.querySelector('[data-stat="depth"]'),
  keys: statsEl.querySelector('[data-stat="keys"]'),
  objects: statsEl.querySelector('[data-stat="objects"]'),
  arrays: statsEl.querySelector('[data-stat="arrays"]')
};

const TOOL_CONFIG = {
  vfl: {
    caption: "Validate syntax, format output, and run lint checks in one tab.",
    runLabel: "Run Checks",
    secondaryLabel: "Minify JSON"
  },
  typegen: {
    caption: "Generate TypeScript types or Zod schemas from JSON (local, no upload).",
    runLabel: "Generate types"
  },
  diff: {
    caption:
      "Diff Finder compares two JSON documents, shows the first mismatch with a JSON Pointer path, and can show a sorted line-by-line diff.",
    runLabel: "Find mismatches",
    secondaryLabel: "Line diff only"
  },
  jsonpath: {
    caption:
      "Selector runs a JSONPath-style path on your document ($.a[0], [*], quoted keys) and lists matches; your path is saved in the URL to share.",
    runLabel: "Run query"
  },
  convert: {
    caption: "Convert between JSON and common formats locally in your browser.",
    runLabel: "Convert"
  }
};

const VALID_TOOLS = Object.keys(TOOL_CONFIG);
const CONVERTER_FORMATS = [
  { id: "json", label: "JSON" },
  { id: "csv", label: "CSV" },
  { id: "yaml", label: "YAML" },
  { id: "js-object", label: "JS Object Literal" },
  { id: "md-table", label: "Markdown Table" }
];

const CONVERTER_ROUTES = {
  "csv->json": convertCsvToJson,
  "yaml->json": convertYamlToJson,
  "js-object->json": convertJsObjectToJson,
  "md-table->json": convertMarkdownTableToJson,
  "json->csv": convertJsonToCsv,
  "json->yaml": convertJsonToYaml,
  "json->md-table": convertJsonToMarkdownTable
};

const SAMPLE_VALID = JSON.stringify(
  {
    name: "Ada Lovelace",
    born: 1815,
    active: false,
    fields: ["mathematics", "computing"],
    notes: {
      firstAlgorithm: true,
      collaborators: ["Charles Babbage"]
    }
  },
  null,
  2
);

const SAMPLE_INVALID = `{
  'name': 'Ada Lovelace',
  born: 1815,
  fields: ["mathematics", "computing",],
  notes: { firstAlgorithm: true }
}`;

const CONVERTER_SOURCE_META = {
  json: {
    placeholder: "Paste JSON here, or drop a .json file",
    validSample: SAMPLE_VALID,
    invalidSample: SAMPLE_INVALID
  },
  csv: {
    placeholder: "Paste CSV here, or drop a .csv file",
    validSample: "name,age,active\nAda,36,true\nGrace,42,false",
    invalidSample: "name,age\n\"Ada,36\nGrace,42"
  },
  yaml: {
    placeholder: "Paste YAML here, or drop a .yml/.yaml file",
    validSample: "name: Ada Lovelace\nborn: 1815\nactive: false\nfields:\n  - mathematics\n  - computing",
    invalidSample: "name: Ada\nborn: [1815\nactive: true"
  },
  "js-object": {
    placeholder: "Paste JS object literal here (for strict JSON conversion)",
    validSample: "{ name: 'Ada Lovelace', born: 1815, active: false, tags: ['math', 'computing'] }",
    invalidSample: "{ name: 'Ada', born: , active: true }"
  },
  "md-table": {
    placeholder: "Paste Markdown table here",
    validSample: "| name | age |\n| --- | --- |\n| Ada | 36 |\n| Grace | 42 |",
    invalidSample: "| name | age |\n| Ada | 36 |"
  }
};

let activeTool = "vfl";

function showStatus(message) {
  status.textContent = message;
  if (!message) return;
  setTimeout(() => {
    if (status.textContent === message) {
      status.textContent = "";
    }
  }, 1800);
}

function hideStats() {
  Object.values(statValueEls).forEach((el) => {
    el.textContent = "—";
  });
  statsEl.hidden = true;
}

function renderStats(stats) {
  statValueEls.size.textContent = formatBytes(stats.bytes);
  statValueEls.depth.textContent = String(stats.depth);
  statValueEls.keys.textContent = String(stats.keys);
  statValueEls.objects.textContent = String(stats.objects);
  statValueEls.arrays.textContent = String(stats.arrays);
  statsEl.hidden = false;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function computeStats(value, source) {
  let depth = 0;
  let keys = 0;
  let arrays = 0;
  let objects = 0;
  function walk(node, d) {
    if (d > depth) depth = d;
    if (Array.isArray(node)) {
      arrays += 1;
      node.forEach((item) => walk(item, d + 1));
      return;
    }
    if (node && typeof node === "object") {
      objects += 1;
      const ks = Object.keys(node);
      keys += ks.length;
      ks.forEach((k) => walk(node[k], d + 1));
    }
  }
  walk(value, value && typeof value === "object" ? 1 : 0);
  const bytes = new Blob([source]).size;
  return { bytes, depth, keys, arrays, objects };
}

function setActiveTool(tool, options = {}) {
  activeTool = tool;
  const config = TOOL_CONFIG[tool];
  toolCaption.textContent = config.caption;
  toolCaption.hidden = false;
  runBtn.textContent = config.runLabel;
  if (config.secondaryLabel) {
    secondaryBtn.textContent = config.secondaryLabel;
  }
  secondaryBtn.hidden = !config.secondaryLabel;
  typeOptions.hidden = tool !== "typegen";
  comparePanel.hidden = tool !== "diff";
  jsonpathPanel.hidden = tool !== "jsonpath";
  if (converterPanel) converterPanel.hidden = tool !== "convert";
  if (sourceLabel) {
    if (tool === "diff") {
      sourceLabel.textContent = "JSON A";
    } else if (tool === "convert") {
      sourceLabel.textContent = "Source input";
    } else {
      sourceLabel.textContent = "JSON input";
    }
  }
  toolTabs.forEach((tab) => {
    const isActive = tab.dataset.tool === tool;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  resultOutput.value = "";
  hideStats();
  if (tool === "jsonpath") {
    applyJsonPathFromUrl();
  }
  if (tool === "convert") {
    updateConverterHint();
  }
  updateSourceUiForActiveTool();
  if (options.updateHash !== false) {
    syncUrlForTool(tool);
  }
  showStatus(`${config.runLabel} ready`);
}

function syncUrlForTool(tool) {
  const url = new URL(window.location.href);
  url.hash = tool;
  if (tool !== "jsonpath") {
    url.searchParams.delete("jp");
  }
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== next) {
    history.replaceState(null, "", next);
  }
}

function getToolFromHash() {
  const raw = window.location.hash.replace(/^#/, "");
  const h = raw.split("&")[0];
  if (h === "validator" || h === "formatter" || h === "linter") return "vfl";
  return VALID_TOOLS.includes(h) ? h : null;
}

function resolveInitialTool() {
  const fromHash = getToolFromHash();
  if (fromHash) return fromHash;
  const jp = new URLSearchParams(window.location.search).get("jp");
  if (jp !== null && jp !== "") return "jsonpath";
  return null;
}

function applyJsonPathFromUrl() {
  if (!jsonpathInput) return;
  const jp = new URLSearchParams(window.location.search).get("jp");
  if (jp != null) {
    jsonpathInput.value = jp;
  }
}

let jsonpathUrlTimer = null;

function pushJsonPathSearchState() {
  if (activeTool !== "jsonpath" || !jsonpathInput) return;
  const expr = jsonpathInput.value;
  const url = new URL(window.location.href);
  url.hash = "jsonpath";
  if (expr.trim()) {
    url.searchParams.set("jp", expr);
  } else {
    url.searchParams.delete("jp");
  }
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== next) {
    history.replaceState(null, "", next);
  }
}

function scheduleJsonPathUrlSync() {
  if (activeTool !== "jsonpath" || !jsonpathInput) return;
  clearTimeout(jsonpathUrlTimer);
  jsonpathUrlTimer = setTimeout(pushJsonPathSearchState, 400);
}

function getLineAndColumn(text, index) {
  const safeIndex = Math.max(0, Math.min(index, text.length));
  const lines = text.slice(0, safeIndex).split("\n");
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

function parseJsonInput(source) {
  try {
    return { ok: true, value: JSON.parse(source) };
  } catch (error) {
    return { ok: false, error };
  }
}

function detectSourceIssues(source) {
  const issues = [];
  if (/^\uFEFF/.test(source)) {
    issues.push("UTF-8 BOM at the start — remove the invisible character before the first { or [.");
  }
  if (/[\u201C\u201D\u2018\u2019]/.test(source)) {
    issues.push("Smart quotes detected — JSON only allows straight double quotes (\").");
  }
  if (/,\s*[\]}]/.test(source)) {
    issues.push("Trailing comma before a closing bracket or brace.");
  }
  if (/'[^'\n]*'\s*[:,}\]]/.test(source) || /[:[,]\s*'[^'\n]*'/.test(source)) {
    issues.push("Single quotes detected — JSON requires double quotes.");
  }
  if (/[{,]\s*[A-Za-z_$][\w$]*\s*:/.test(source)) {
    issues.push("Unquoted key(s) — JSON keys must be in double quotes.");
  }
  return issues.slice(0, 5);
}

function getLineSlice(source, line) {
  const lines = source.split(/\r?\n/);
  const idx = Math.max(0, Math.min(line - 1, lines.length - 1));
  return { text: lines[idx] || "", lineIndex: idx, total: lines.length };
}

function lineLocalHints(source, index) {
  const { line, column } = getLineAndColumn(source, index);
  const { text } = getLineSlice(source, line);
  const hints = [];
  if (!text) return hints;
  const col = Math.max(0, Math.min(column - 1, text.length));
  const ch = text[col] || "";
  const before = text.slice(0, col);
  const trimmedRight = text.slice(col).trimStart();
  if (/,\s*[\]}]/.test(text)) {
    hints.push("On this line: remove the trailing comma before `]` or `}`.");
  }
  if (ch === "'" || /'[^']*'/.test(text)) {
    hints.push("On this line: replace single-quoted strings with double quotes.");
  }
  if (/^\s*[}\]]/.test(trimmedRight) && /,\s*$/.test(before.trimEnd())) {
    hints.push("Right before this closing bracket you may have an extra comma — delete it.");
  }
  const nextNonSpace = trimmedRight[0];
  if (nextNonSpace && /[{\["0-9tfn-]/.test(nextNonSpace) && before.trim().length > 0 && !/[,:{\[]\s*$/.test(before)) {
    const last = before.trim().slice(-1);
    if (last !== "," && last !== "[" && last !== "{") {
      hints.push("You may be missing a comma between two values on this line.");
    }
  }
  return hints.slice(0, 3);
}

function explainParseError(source, error) {
  const message = String(error.message || "Invalid JSON");
  const positionMatch = message.match(/position\s+(\d+)/i);
  const index = positionMatch ? Number(positionMatch[1]) : 0;
  const { line, column } = getLineAndColumn(source, index);
  const nearby = source.slice(Math.max(0, index - 18), Math.min(source.length, index + 18));
  const { text: lineText } = getLineSlice(source, line);
  const caret = lineText ? `\nLine ${line} text: ${lineText}\n${" ".repeat(String(line).length + 10 + Math.min(column - 1, lineText.length))}^` : "";

  const issues = detectSourceIssues(source);
  const local = lineLocalHints(source, index);
  const merged = [...new Set([...issues, ...local])];
  let hintBlock;
  if (merged.length > 0) {
    hintBlock = `Likely causes:\n${merged.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}`;
  } else if (/Unexpected end of JSON input/i.test(message)) {
    hintBlock = "Hint: JSON appears incomplete. A quote, bracket, or brace may be missing.";
  } else {
    hintBlock = "Hint: Check nearby quotes, commas, and brackets.";
  }

  return `Invalid JSON\nLine ${line}, Column ${column}\n${hintBlock}\nParser: ${message}\nNear: ${nearby || "(start of input)"}${caret}`;
}

function ensureSource() {
  const source = sourceInput.value.trim();
  if (!source) {
    resultOutput.value = "";
    hideStats();
    showStatus("Please paste JSON first");
    return null;
  }
  return source;
}

function formatJson(source, minify) {
  const parsed = parseJsonInput(source);
  if (!parsed.ok) {
    resultOutput.value = explainParseError(source, parsed.error);
    hideStats();
    showStatus("Invalid JSON");
    return;
  }
  const output = minify ? JSON.stringify(parsed.value) : JSON.stringify(parsed.value, null, 2);
  resultOutput.value = output;
  renderStats(computeStats(parsed.value, output));
  showStatus(minify ? "Minified successfully" : "Formatted successfully");
}

function detectDominantKeyStyle(keys) {
  const counters = {
    camelCase: 0,
    snake_case: 0,
    kebab_case: 0,
    PascalCase: 0
  };
  keys.forEach((key) => {
    if (/^[a-z][a-zA-Z0-9]*$/.test(key) && /[A-Z]/.test(key)) counters.camelCase += 1;
    if (/^[a-z0-9]+(_[a-z0-9]+)+$/.test(key)) counters.snake_case += 1;
    if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(key)) counters.kebab_case += 1;
    if (/^[A-Z][a-zA-Z0-9]*$/.test(key)) counters.PascalCase += 1;
  });
  const dominant = Object.entries(counters).sort((a, b) => b[1] - a[1])[0];
  return dominant && dominant[1] > 0 ? dominant[0] : null;
}

function analyzeJson(value, source) {
  const issues = [];
  const allKeys = [];
  const depthLimit = 8;
  const sizeLimit = 100000;

  function walk(node, depth) {
    if (depth > depthLimit) {
      issues.push(`Depth warning: structure deeper than ${depthLimit} levels.`);
    }
    if (Array.isArray(node)) {
      node.forEach((item) => walk(item, depth + 1));
      return;
    }
    if (node && typeof node === "object") {
      const keys = Object.keys(node);
      allKeys.push(...keys);
      keys.forEach((key) => walk(node[key], depth + 1));
    }
  }

  walk(value, 1);

  if (source.length > sizeLimit) {
    issues.push(`Size warning: payload is ${source.length.toLocaleString()} bytes.`);
  }

  const dominantStyle = detectDominantKeyStyle(allKeys);
  if (dominantStyle) {
    const styleMismatches = allKeys.filter((key) => {
      if (dominantStyle === "camelCase") return !/^[a-z][a-zA-Z0-9]*$/.test(key);
      if (dominantStyle === "snake_case") return !/^[a-z0-9]+(_[a-z0-9]+)*$/.test(key);
      if (dominantStyle === "kebab_case") return !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(key);
      if (dominantStyle === "PascalCase") return !/^[A-Z][a-zA-Z0-9]*$/.test(key);
      return false;
    });
    if (styleMismatches.length > 0) {
      issues.push(`Naming warning: mixed key naming styles detected (dominant: ${dominantStyle}).`);
    }
  }

  const quotedKeyMatches = source.match(/"([^"\\]*(?:\\.[^"\\]*)*)"\s*:/g) || [];
  const keyCountMap = new Map();
  quotedKeyMatches.forEach((match) => {
    const rawKey = match.replace(/"\s*:\s*$/, "");
    keyCountMap.set(rawKey, (keyCountMap.get(rawKey) || 0) + 1);
  });
  const repeats = Array.from(keyCountMap.entries()).filter((entry) => entry[1] > 1);
  if (repeats.length > 0) {
    issues.push(`Duplicate key risk: repeated key names found (${repeats.slice(0, 3).map((entry) => entry[0]).join(", ")}).`);
  }

  return issues;
}

function runValidateFormatLint(source) {
  const parsed = parseJsonInput(source);
  if (!parsed.ok) {
    resultOutput.value = explainParseError(source, parsed.error);
    hideStats();
    showStatus("Invalid JSON");
    return;
  }

  const lintIssues = analyzeJson(parsed.value, source);
  const sourceIssues = detectSourceIssues(source);
  const allIssues = [...sourceIssues, ...lintIssues];
  const topLevelType = Array.isArray(parsed.value) ? "array" : typeof parsed.value;
  const formatted = JSON.stringify(parsed.value, null, 2);

  const issueSection =
    allIssues.length === 0
      ? "No lint issues found."
      : allIssues.map((issue, index) => `${index + 1}. ${issue}`).join("\n");

  resultOutput.value = [
    "Validation: Valid JSON",
    `Top-level type: ${topLevelType}`,
    "",
    `Lint checks (${allIssues.length} issue${allIssues.length === 1 ? "" : "s"}):`,
    issueSection,
    "",
    "Formatted JSON:",
    formatted
  ].join("\n");

  renderStats(computeStats(parsed.value, formatted));
  showStatus(allIssues.length === 0 ? "Validation, format, and lint passed" : `${allIssues.length} issue(s) found`);
}

function toPascalCase(input) {
  const chunks = String(input || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  if (chunks.length === 0) return "GeneratedType";
  return chunks
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

function singularize(name) {
  if (/ies$/i.test(name)) return name.replace(/ies$/i, "y");
  if (/sses$/i.test(name)) return name;
  if (/s$/i.test(name) && name.length > 1) return name.slice(0, -1);
  return name;
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isValidIdentifier(key) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key);
}

function formatPropertyName(key) {
  return isValidIdentifier(key) ? key : JSON.stringify(key);
}

function makeUniqueTypeName(baseName, usedNames) {
  const safeBase = toPascalCase(baseName);
  if (!usedNames.has(safeBase)) {
    usedNames.add(safeBase);
    return safeBase;
  }
  let i = 2;
  while (usedNames.has(`${safeBase}${i}`)) i += 1;
  const next = `${safeBase}${i}`;
  usedNames.add(next);
  return next;
}

function irKey(node) {
  if (node.kind === "primitive") return `p:${node.t}`;
  if (node.kind === "ref") return `r:${node.name}`;
  if (node.kind === "array") return `a:${irKey(node.item)}`;
  if (node.kind === "union") return `u:${node.items.map(irKey).sort().join("|")}`;
  return "?";
}

function normalizeIrUnion(nodes) {
  const flattened = [];
  for (const n of nodes) {
    if (n.kind === "union") flattened.push(...n.items);
    else flattened.push(n);
  }
  const byKey = new Map();
  for (const n of flattened) {
    const k = irKey(n);
    if (!byKey.has(k)) byKey.set(k, n);
  }
  const list = Array.from(byKey.values()).sort((a, b) => irKey(a).localeCompare(irKey(b)));
  if (list.length === 0) return { kind: "primitive", t: "unknown" };
  if (list.length === 1) return list[0];
  return { kind: "union", items: list };
}

function mergeIrNodes(nodes) {
  return normalizeIrUnion(nodes);
}

function irToTs(node) {
  if (node.kind === "primitive") return node.t;
  if (node.kind === "ref") return node.name;
  if (node.kind === "array") {
    const inner = irToTs(node.item);
    const wrapped = node.item.kind === "union" ? `(${inner})` : inner;
    return `${wrapped}[]`;
  }
  if (node.kind === "union") return node.items.map(irToTs).join(" | ");
  return "unknown";
}

function irToZodExpr(node) {
  if (node.kind === "primitive") {
    const map = {
      string: "z.string()",
      number: "z.number()",
      boolean: "z.boolean()",
      null: "z.null()",
      unknown: "z.unknown()"
    };
    return map[node.t] || "z.unknown()";
  }
  if (node.kind === "ref") return `${node.name}Schema`;
  if (node.kind === "array") return `z.array(${irToZodExpr(node.item)})`;
  if (node.kind === "union") {
    const parts = node.items.map(irToZodExpr);
    if (parts.length === 1) return parts[0];
    return `z.union([${parts.join(", ")}])`;
  }
  return "z.unknown()";
}

function renderTypeScriptFromIr(interfaces, rootName, rootNode) {
  const safeRoot = toPascalCase(rootName || "Root");
  const blocks = interfaces.map((entry) => {
    const lines = entry.fields
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((field) => {
        const ts = irToTs(field.node);
        return `  ${formatPropertyName(field.key)}${field.optional ? "?" : ""}: ${ts};`;
      });
    return `interface ${entry.name} {\n${lines.join("\n")}\n}`;
  });
  const rootTs = irToTs(rootNode);
  if (rootNode.kind === "ref" && rootNode.name === safeRoot) {
    return blocks.join("\n\n");
  }
  return `${blocks.join("\n\n")}${blocks.length > 0 ? "\n\n" : ""}type ${safeRoot} = ${rootTs};`;
}

function renderZodFromIr(interfaces, rootName, rootNode) {
  const safeRoot = toPascalCase(rootName || "Root");
  const schemaBlocks = interfaces.map((entry) => {
    const lines = entry.fields
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((field) => {
        let zexpr = irToZodExpr(field.node);
        if (field.optional) zexpr = `${zexpr}.optional()`;
        return `  ${formatPropertyName(field.key)}: ${zexpr},`;
      });
    return `const ${entry.name}Schema = z.object({\n${lines.join("\n")}\n});`;
  });
  let out = `import { z } from "zod";\n\n`;
  out += schemaBlocks.join("\n\n");
  const rootSchemaName = `${safeRoot}Schema`;
  if (rootNode.kind === "ref" && rootNode.name === safeRoot) {
    return out;
  }
  const rootExpr = irToZodExpr(rootNode);
  out += `\n\nconst ${rootSchemaName} = ${rootExpr};\n`;
  return out;
}

function createIrBuilder() {
  const interfaces = [];
  const usedNames = new Set();

  function inferNode(value, hintName) {
    if (value === null) return { kind: "primitive", t: "null" };
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return { kind: "array", item: { kind: "primitive", t: "unknown" } };
      }
      const objectItems = value.filter((item) => isPlainObject(item));
      if (objectItems.length === value.length) {
        const refNode = buildInterfaceFromObjects(objectItems, `${singularize(hintName)}Item`);
        return { kind: "array", item: refNode };
      }
      const itemNodes = value.map((item) => inferNode(item, `${singularize(hintName)}Item`));
      return { kind: "array", item: mergeIrNodes(itemNodes) };
    }
    if (isPlainObject(value)) {
      return buildInterfaceFromObject(value, hintName);
    }
    if (typeof value === "string") return { kind: "primitive", t: "string" };
    if (typeof value === "number") return { kind: "primitive", t: "number" };
    if (typeof value === "boolean") return { kind: "primitive", t: "boolean" };
    return { kind: "primitive", t: "unknown" };
  }

  function buildInterfaceFromObject(obj, hintName) {
    const fields = Object.entries(obj).map(([key, val]) => ({
      key,
      optional: false,
      node: inferNode(val, key)
    }));
    const typeName = makeUniqueTypeName(hintName, usedNames);
    interfaces.push({ name: typeName, fields });
    return { kind: "ref", name: typeName };
  }

  function buildInterfaceFromObjects(objects, hintName) {
    const fieldMap = new Map();
    objects.forEach((obj) => {
      Object.keys(obj).forEach((key) => {
        if (!fieldMap.has(key)) {
          fieldMap.set(key, { seen: 0, nodes: [] });
        }
        const bucket = fieldMap.get(key);
        bucket.seen += 1;
        bucket.nodes.push(inferNode(obj[key], key));
      });
    });
    const fields = Array.from(fieldMap.entries()).map(([key, meta]) => ({
      key,
      optional: meta.seen < objects.length,
      node: mergeIrNodes(meta.nodes)
    }));
    const typeName = makeUniqueTypeName(hintName, usedNames);
    interfaces.push({ name: typeName, fields });
    return { kind: "ref", name: typeName };
  }

  function inferRoot(rootValue, rootHint) {
    const safeRoot = toPascalCase(rootHint || "Root");
    return inferNode(rootValue, safeRoot);
  }

  return { inferRoot, getInterfaces: () => interfaces };
}

function getTypegenFormat() {
  const checked = typegenFormatRadios.find((r) => r.checked);
  return checked && checked.value === "zod" ? "zod" : "typescript";
}

function runTypeGenerator(source) {
  const parsed = parseJsonInput(source);
  if (!parsed.ok) {
    resultOutput.value = explainParseError(source, parsed.error);
    hideStats();
    showStatus("Invalid JSON");
    return;
  }
  const builder = createIrBuilder();
  const rootName = rootNameInput && rootNameInput.value ? rootNameInput.value.trim() : "Root";
  const rootNode = builder.inferRoot(parsed.value, rootName || "Root");
  const interfaces = builder.getInterfaces();
  const format = getTypegenFormat();
  if (format === "zod") {
    resultOutput.value = renderZodFromIr(interfaces, rootName || "Root", rootNode);
    showStatus("Zod schema generated locally");
  } else {
    resultOutput.value = renderTypeScriptFromIr(interfaces, rootName || "Root", rootNode);
    showStatus("TypeScript generated locally");
  }
  renderStats(computeStats(parsed.value, source));
}

function jsonPointerEscapeSegment(seg) {
  return String(seg).replace(/~/g, "~0").replace(/\//g, "~1");
}

function segmentsToPointer(segments) {
  if (segments.length === 0) return "";
  return `/${segments.map(jsonPointerEscapeSegment).join("/")}`;
}

function deepCompareReport(a, b, maxNodes = 80000) {
  let visited = 0;

  function fail(path, message, detail) {
    return { ok: false, path: segmentsToPointer(path), message, detail };
  }

  function walk(x, y, path) {
    if (visited++ > maxNodes) {
      return fail(path, "Stopped: payload too large to compare in one pass", null);
    }
    if (Object.is(x, y)) return null;
    if (Number.isNaN(x) && Number.isNaN(y)) return null;
    const tx = x === null ? "null" : Array.isArray(x) ? "array" : typeof x;
    const ty = y === null ? "null" : Array.isArray(y) ? "array" : typeof y;
    if (tx !== ty) {
      return fail(path, `Type mismatch: ${tx} vs ${ty}`, { left: x, right: y });
    }
    if (tx === "null") return null;
    if (tx === "array") {
      if (x.length !== y.length) {
        return fail(path, `Array length differs (${x.length} vs ${y.length})`, null);
      }
      for (let i = 0; i < x.length; i += 1) {
        const r = walk(x[i], y[i], path.concat(String(i)));
        if (r) return r;
      }
      return null;
    }
    if (tx === "object") {
      const kx = Object.keys(x).sort();
      const ky = Object.keys(y).sort();
      if (kx.length !== ky.length || kx.some((k, i) => k !== ky[i])) {
        return fail(path, "Objects have different keys", { keysA: kx, keysB: ky });
      }
      for (const k of kx) {
        const r = walk(x[k], y[k], path.concat(k));
        if (r) return r;
      }
      return null;
    }
    if (x !== y) return fail(path, "Scalar value mismatch", { left: x, right: y });
    return null;
  }

  const err = walk(a, b, []);
  if (err) return err;
  return { ok: true };
}

function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortKeysDeep(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function firstLineDiff(aText, bText) {
  const la = aText.split(/\r?\n/);
  const lb = bText.split(/\r?\n/);
  let i = 0;
  while (i < la.length && i < lb.length && la[i] === lb[i]) i += 1;
  if (i === la.length && i === lb.length) return { same: true };
  return {
    same: false,
    line: i + 1,
    aLine: la[i] ?? "(end of A)",
    bLine: lb[i] ?? "(end of B)",
    aLen: la.length,
    bLen: lb.length
  };
}

function ensureCompareSources() {
  const a = sourceInput.value.trim();
  const b = compareInput ? compareInput.value.trim() : "";
  if (!a) {
    resultOutput.value = "";
    hideStats();
    showStatus("Paste JSON A first");
    return null;
  }
  if (!b) {
    resultOutput.value = "";
    hideStats();
    showStatus("Paste JSON B first");
    return null;
  }
  return { a, b };
}

function runDiffTool(sourceA, sourceB, mode) {
  const pa = parseJsonInput(sourceA);
  if (!pa.ok) {
    resultOutput.value = `JSON A is invalid:\n${explainParseError(sourceA, pa.error)}`;
    hideStats();
    showStatus("JSON A invalid");
    return;
  }
  const pb = parseJsonInput(sourceB);
  if (!pb.ok) {
    resultOutput.value = `JSON B is invalid:\n${explainParseError(sourceB, pb.error)}`;
    hideStats();
    showStatus("JSON B invalid");
    return;
  }

  const prettyA = JSON.stringify(sortKeysDeep(pa.value), null, 2);
  const prettyB = JSON.stringify(sortKeysDeep(pb.value), null, 2);

  if (mode === "lines") {
    const d = firstLineDiff(prettyA, prettyB);
    if (d.same) {
      resultOutput.value = "Line diff: no differences (sorted keys, 2-space indent).";
    } else {
      resultOutput.value = `Line diff (sorted keys, 2-space indent)\nFirst difference at formatted line ${d.line} (A has ${d.aLen} lines, B has ${d.bLen})\n\nA: ${d.aLine}\nB: ${d.bLine}`;
    }
    renderStats(computeStats(pa.value, sourceA));
    showStatus(d.same ? "No line differences" : "Differences found");
    return;
  }

  const report = deepCompareReport(pa.value, pb.value);
  let out = "";
  if (report.ok) {
    out = "Deep equality: values are equal (same structure and scalars).\n\n";
  } else {
    out = `Deep equality: not equal\nJSON Pointer: ${report.path || "/"}\n${report.message}\n`;
    if (report.detail && Object.prototype.hasOwnProperty.call(report.detail, "left")) {
      out += `A: ${JSON.stringify(report.detail.left)}\nB: ${JSON.stringify(report.detail.right)}\n`;
    }
    if (report.detail && report.detail.keysA) {
      out += `Keys A: ${report.detail.keysA.join(", ")}\nKeys B: ${report.detail.keysB.join(", ")}\n`;
    }
    out += "\n";
  }

  const ld = firstLineDiff(prettyA, prettyB);
  if (ld.same) {
    out += "Formatted line diff: no differences (sorted keys).";
  } else {
    out += `Formatted line diff (sorted keys)\nFirst difference at line ${ld.line}\n\nA: ${ld.aLine}\nB: ${ld.bLine}`;
  }

  resultOutput.value = out;
  renderStats(computeStats(pa.value, sourceA));
  showStatus(report.ok ? "Documents match" : "Differences found");
}

function normalizeJsonPathInput(raw) {
  const s = String(raw || "").trim();
  if (!s) return "$";
  if (s.startsWith("$")) return s;
  if (s.startsWith(".") || s.startsWith("[")) return `$${s}`;
  return `$.${s}`;
}

function walkJsonPath(pathStr, root) {
  const s = pathStr.trim();
  if (!s.startsWith("$")) {
    throw new Error("Path must start with $");
  }
  let pos = 1;
  let current = [root];

  function skipSpace() {
    while (pos < s.length && /\s/.test(s[pos])) pos += 1;
  }

  while (pos < s.length) {
    skipSpace();
    if (pos >= s.length) break;

    if (s[pos] === ".") {
      pos += 1;
      if (pos < s.length && s[pos] === ".") {
        throw new Error("Recursive descent `..` is not supported");
      }
      const m = /^([A-Za-z_$][\w$]*)/.exec(s.slice(pos));
      if (!m) {
        throw new Error(`Expected property name after . at position ${pos}`);
      }
      const key = m[1];
      pos += m[1].length;
      current = current.flatMap((node) => {
        if (
          node != null &&
          typeof node === "object" &&
          !Array.isArray(node) &&
          Object.prototype.hasOwnProperty.call(node, key)
        ) {
          return [node[key]];
        }
        return [];
      });
      continue;
    }

    if (s[pos] === "[") {
      const close = s.indexOf("]", pos);
      if (close === -1) throw new Error("Missing closing ]");
      const inner = s.slice(pos + 1, close).trim();
      pos = close + 1;
      if (inner === "*") {
        current = current.flatMap((node) => (Array.isArray(node) ? [...node] : []));
      } else if (/^\d+$/.test(inner)) {
        const idx = Number(inner);
        current = current.flatMap((node) =>
          node != null && Array.isArray(node) && idx < node.length ? [node[idx]] : []
        );
      } else {
        let key;
        if (inner.startsWith('"')) {
          key = JSON.parse(inner);
        } else if (inner.startsWith("'") && inner.endsWith("'")) {
          key = inner.slice(1, -1);
        } else {
          key = inner;
        }
        current = current.flatMap((node) => {
          if (
            node != null &&
            typeof node === "object" &&
            !Array.isArray(node) &&
            Object.prototype.hasOwnProperty.call(node, key)
          ) {
            return [node[key]];
          }
          return [];
        });
      }
      continue;
    }

    throw new Error(`Unexpected character at position ${pos}`);
  }

  return current;
}

function runJsonPathTool(source) {
  const parsed = parseJsonInput(source);
  if (!parsed.ok) {
    resultOutput.value = explainParseError(source, parsed.error);
    hideStats();
    showStatus("Invalid JSON");
    return;
  }
  const exprRaw = jsonpathInput ? jsonpathInput.value : "";
  let norm;
  try {
    norm = normalizeJsonPathInput(exprRaw);
  } catch (e) {
    resultOutput.value = String(e.message || e);
    hideStats();
    showStatus("Bad path");
    return;
  }
  try {
    const matches = walkJsonPath(norm, parsed.value);
    resultOutput.value = JSON.stringify(matches, null, 2);
    renderStats(computeStats(parsed.value, source));
    pushJsonPathSearchState();
    showStatus(`${matches.length} match(es)`);
  } catch (e) {
    resultOutput.value = `Query path error: ${e.message || e}`;
    hideStats();
    showStatus("Path error");
  }
}

function assertOfflineConversion() {
  // Privacy invariant: converters always run in local JS only.
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Offline conversion environment not available.");
  }
}

function getConverterKey() {
  const from = convertFromSelect ? convertFromSelect.value : "";
  const to = convertToSelect ? convertToSelect.value : "";
  return `${from}->${to}`;
}

function updateConverterHint() {
  if (!converterHint) return;
  const key = getConverterKey();
  if (!CONVERTER_ROUTES[key]) {
    converterHint.textContent = "This pair is not in MVP yet. Try JSON, CSV, YAML, JS Object Literal, or Markdown Table.";
    return;
  }
  converterHint.textContent = "Runs fully in your browser. Nothing is uploaded.";
}

function getConverterSourceMeta() {
  if (!convertFromSelect) return CONVERTER_SOURCE_META.json;
  return CONVERTER_SOURCE_META[convertFromSelect.value] || CONVERTER_SOURCE_META.json;
}

function enforceJsonPair(changedField) {
  if (!convertFromSelect || !convertToSelect) return;
  const from = convertFromSelect.value;
  const to = convertToSelect.value;
  if (from === "json" || to === "json") return;
  if (changedField === "from") {
    convertToSelect.value = "json";
  } else {
    convertFromSelect.value = "json";
  }
}

function updateSourceUiForActiveTool() {
  if (!sourceInput) return;
  if (activeTool !== "convert") {
    sourceInput.placeholder = "Paste JSON here, or drop a .json file";
    return;
  }
  const meta = getConverterSourceMeta();
  sourceInput.placeholder = meta.placeholder;
}

function populateConverterOptions() {
  if (!convertFromSelect || !convertToSelect) return;
  const options = CONVERTER_FORMATS.map((format) => `<option value="${format.id}">${format.label}</option>`).join("");
  convertFromSelect.innerHTML = options;
  convertToSelect.innerHTML = options;
  convertFromSelect.value = "csv";
  convertToSelect.value = "json";
  updateConverterHint();
  updateSourceUiForActiveTool();
}

function parseCsvLine(line) {
  const cells = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (inQuotes) throw new Error("CSV has an unclosed quoted cell.");
  cells.push(cur);
  return cells.map((cell) => cell.trim());
}

function convertScalar(value) {
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === "true";
  if (/^null$/i.test(value)) return null;
  return value;
}

function convertCsvToJson(input) {
  const rows = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (rows.length < 2) throw new Error("CSV needs a header row and at least one data row.");
  const headers = parseCsvLine(rows[0]);
  if (!headers.length) throw new Error("CSV header is empty.");
  const data = rows.slice(1).map((row) => {
    const cells = parseCsvLine(row);
    const out = {};
    headers.forEach((h, idx) => {
      out[h] = convertScalar(cells[idx] == null ? "" : cells[idx]);
    });
    return out;
  });
  return { output: JSON.stringify(data, null, 2) };
}

function splitYamlInlineList(inner) {
  const parts = [];
  let cur = "";
  let quote = "";
  let depth = 0;
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    if (quote) {
      if (ch === "\\" && i + 1 < inner.length) {
        cur += ch + inner[i + 1];
        i += 1;
        continue;
      }
      if (ch === quote) quote = "";
      cur += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === "[" || ch === "{") depth += 1;
    if (ch === "]" || ch === "}") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function parseYamlScalar(raw) {
  const value = raw.trim();
  if (!value.length) return "";
  if (value === "~" || /^(null)$/i.test(value)) return null;
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === "true";
  if (/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(value)) return Number(value);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    const unquoted = value.slice(1, -1);
    return value.startsWith('"') ? unquoted.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\") : unquoted;
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    const items = splitYamlInlineList(value.slice(1, -1));
    return items.map((item) => parseYamlScalar(item));
  }
  if (value.startsWith("{") && value.endsWith("}")) {
    const pairs = splitYamlInlineList(value.slice(1, -1));
    const obj = {};
    pairs.forEach((pair) => {
      const idx = pair.indexOf(":");
      if (idx === -1) return;
      const k = pair.slice(0, idx).trim().replace(/^["']|["']$/g, "");
      obj[k] = parseYamlScalar(pair.slice(idx + 1).trim());
    });
    return obj;
  }
  return value;
}

function stripYamlComment(line) {
  let quote = "";
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quote) {
      if (ch === "\\" && i + 1 < line.length) {
        i += 1;
        continue;
      }
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === "#") return line.slice(0, i);
  }
  return line;
}

function parseYamlLine(trimmed) {
  let quote = "";
  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i];
    if (quote) {
      if (ch === "\\" && i + 1 < trimmed.length) {
        i += 1;
        continue;
      }
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === ":") {
      const key = trimmed.slice(0, i).trim().replace(/^["']|["']$/g, "");
      const value = trimmed.slice(i + 1).trim();
      return { key, value };
    }
  }
  throw new Error(`Invalid YAML mapping line: ${trimmed}`);
}

function parseSimpleYaml(input) {
  const rows = input.replace(/\t/g, "  ").split(/\r?\n/).map((line) => stripYamlComment(line).replace(/\s+$/, ""));
  const nonEmptyRows = rows.filter((line) => line.trim().length > 0);
  if (!nonEmptyRows.length) throw new Error("YAML input is empty.");

  const root = {};
  const stack = [{ indent: -1, value: root, kind: "object" }];

  for (let rowIndex = 0; rowIndex < nonEmptyRows.length; rowIndex += 1) {
    const line = nonEmptyRows[rowIndex];
    const indent = line.match(/^ */)[0].length;
    const trimmed = line.trim();
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const frame = stack[stack.length - 1];

    if (trimmed.startsWith("- ")) {
      if (!Array.isArray(frame.value)) throw new Error(`YAML list item must be inside a list: ${trimmed}`);
      const item = trimmed.slice(2).trim();
      if (!item) {
        const nested = {};
        frame.value.push(nested);
        stack.push({ indent, value: nested, kind: "object" });
      } else if (item.includes(":") && !item.startsWith("{")) {
        const mapping = {};
        const parsed = parseYamlLine(item);
        mapping[parsed.key] = parsed.value ? parseYamlScalar(parsed.value) : {};
        frame.value.push(mapping);
        if (!parsed.value) stack.push({ indent, value: mapping[parsed.key], kind: "object" });
      } else {
        frame.value.push(parseYamlScalar(item));
      }
      continue;
    }

    const parsed = parseYamlLine(trimmed);
    if (frame.kind !== "object" || Array.isArray(frame.value)) {
      throw new Error(`YAML mapping line is in an invalid context: ${trimmed}`);
    }
    if (!parsed.value) {
      const lookaheadIndex = rowIndex + 1;
      const next = nonEmptyRows[lookaheadIndex];
      const nextTrimmed = next ? next.trim() : "";
      const isList = nextTrimmed.startsWith("- ");
      const container = isList ? [] : {};
      frame.value[parsed.key] = container;
      stack.push({ indent, value: container, kind: isList ? "array" : "object" });
      continue;
    }
    frame.value[parsed.key] = parseYamlScalar(parsed.value);
  }

  return root;
}

function convertYamlToJson(input) {
  const parsed = parseSimpleYaml(input);
  return {
    output: JSON.stringify(parsed, null, 2),
    warnings: [
      "YAML parser now supports nested objects/lists, inline arrays/objects, comments, quoted strings, booleans, nulls, and numbers.",
      "Anchors, aliases, tags, and multi-document YAML are not supported in this client-only MVP."
    ]
  };
}

function convertJsObjectToJson(input) {
  let normalized = input.trim();
  if (!normalized.startsWith("{") && !normalized.startsWith("[")) {
    throw new Error("JS object literal input must start with { or [.");
  }
  normalized = normalized.replace(/([{,]\s*)([A-Za-z_$][\w$]*)(\s*:)/g, '$1"$2"$3');
  normalized = normalized.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, inner) => `"${inner.replace(/"/g, '\\"')}"`);
  normalized = normalized.replace(/,\s*([}\]])/g, "$1");
  const parsed = JSON.parse(normalized);
  return {
    output: JSON.stringify(parsed, null, 2),
    warnings: ["Converted using best-effort JS literal normalization (keys/quotes/trailing commas)."]
  };
}

function parseJsonRequired(input) {
  const parsed = parseJsonInput(input);
  if (!parsed.ok) {
    throw new Error(explainParseError(input, parsed.error));
  }
  return parsed.value;
}

function escapeCsvCell(value) {
  const raw = String(value == null ? "" : value);
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

function convertJsonToCsv(input) {
  const value = parseJsonRequired(input);
  const arr = Array.isArray(value) ? value : [value];
  if (!arr.length) return { output: "" };
  const headers = Array.from(
    new Set(
      arr.flatMap((item) => (item && typeof item === "object" && !Array.isArray(item) ? Object.keys(item) : ["value"]))
    )
  );
  const lines = [headers.join(",")];
  arr.forEach((item) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      lines.push(headers.map((h) => escapeCsvCell(item[h])).join(","));
    } else {
      lines.push(headers.map((h) => (h === "value" ? escapeCsvCell(item) : "")).join(","));
    }
  });
  return { output: lines.join("\n") };
}

function stringifyYamlScalar(value) {
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (!value.length) return '""';
    if (/[:#\-\[\]\{\},&*!?|>@`'"]/.test(value) || /^\s|\s$/.test(value) || value.includes("\n")) {
      return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
    }
    return value;
  }
  return `"${JSON.stringify(value).replace(/"/g, '\\"')}"`;
}

function toYamlValue(node, depth) {
  const pad = "  ".repeat(depth);
  if (Array.isArray(node)) {
    if (!node.length) return `${pad}[]`;
    return node
      .map((item) => {
        if (item && typeof item === "object") {
          const nested = toYamlValue(item, depth + 1);
          return `${pad}-\n${nested}`;
        }
        return `${pad}- ${stringifyYamlScalar(item)}`;
      })
      .join("\n");
  }
  if (node && typeof node === "object") {
    const keys = Object.keys(node);
    if (!keys.length) return `${pad}{}`;
    return keys
      .map((key) => {
        const value = node[key];
        const safeKey = /^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) ? key : `"${key.replace(/"/g, '\\"')}"`;
        if (value && typeof value === "object") {
          return `${pad}${safeKey}:\n${toYamlValue(value, depth + 1)}`;
        }
        return `${pad}${safeKey}: ${stringifyYamlScalar(value)}`;
      })
      .join("\n");
  }
  return `${pad}${stringifyYamlScalar(node)}`;
}

function convertJsonToYaml(input) {
  const value = parseJsonRequired(input);
  return {
    output: toYamlValue(value, 0),
    warnings: [
      "YAML serializer now emits stable quoted scalars, nested arrays/objects, and explicit null/boolean values.",
      "Advanced YAML directives and anchors are intentionally omitted for a predictable browser-only output."
    ]
  };
}

function flattenObject(obj, prefix = "", out = {}) {
  Object.keys(obj).forEach((key) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      flattenObject(value, nextKey, out);
    } else {
      out[nextKey] = Array.isArray(value) ? JSON.stringify(value) : value;
    }
  });
  return out;
}

function splitMarkdownTableRow(line) {
  const cells = [];
  let cur = "";
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "\\" && line[i + 1] === "|") {
      cur += "|";
      i += 1;
      continue;
    }
    if (ch === "|") {
      cells.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  cells.push(cur);
  if (cells.length && cells[0].trim() === "") cells.shift();
  if (cells.length && cells[cells.length - 1].trim() === "") cells.pop();
  return cells.map((c) => c.trim());
}

function isMarkdownDividerRow(cells) {
  if (!cells.length) return false;
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function convertMarkdownTableToJson(input) {
  const rows = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (rows.length < 3) {
    throw new Error("Markdown table needs a header row, a divider row (| --- | --- |), and at least one data row.");
  }
  const headers = splitMarkdownTableRow(rows[0]);
  if (!headers.length) throw new Error("Markdown table header is empty.");
  const divider = splitMarkdownTableRow(rows[1]);
  if (!isMarkdownDividerRow(divider)) {
    throw new Error("Second row must be a divider like | --- | --- |.");
  }
  if (divider.length !== headers.length) {
    throw new Error(`Header has ${headers.length} columns but divider has ${divider.length}.`);
  }
  const data = rows.slice(2).map((row, idx) => {
    const cells = splitMarkdownTableRow(row);
    if (cells.length !== headers.length) {
      throw new Error(`Row ${idx + 1} has ${cells.length} cell(s), expected ${headers.length}.`);
    }
    const out = {};
    headers.forEach((h, i) => {
      out[h] = convertScalar(cells[i] == null ? "" : cells[i]);
    });
    return out;
  });
  return { output: JSON.stringify(data, null, 2) };
}

function convertJsonToMarkdownTable(input) {
  const value = parseJsonRequired(input);
  const rows = Array.isArray(value) ? value : [value];
  if (!rows.length) throw new Error("JSON array is empty.");
  const normalized = rows.map((row) =>
    row && typeof row === "object" && !Array.isArray(row) ? flattenObject(row) : { value: row }
  );
  const headers = Array.from(new Set(normalized.flatMap((row) => Object.keys(row))));
  const headerLine = `| ${headers.join(" | ")} |`;
  const dividerLine = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = normalized.map((row) => `| ${headers.map((h) => String(row[h] ?? "")).join(" | ")} |`).join("\n");
  return {
    output: [headerLine, dividerLine, body].join("\n"),
    warnings: ["Nested objects are flattened with dot notation for table output."]
  };
}

function runConverterTool(source) {
  assertOfflineConversion();
  const key = getConverterKey();
  const runConverter = CONVERTER_ROUTES[key];
  if (!runConverter) {
    resultOutput.value = "This converter pair is not available in the current MVP.";
    hideStats();
    showStatus("Pair unavailable");
    return;
  }
  try {
    const result = runConverter(source);
    const warnings = result.warnings && result.warnings.length ? `\n\nWarnings:\n- ${result.warnings.join("\n- ")}` : "";
    resultOutput.value = `${result.output}${warnings}`;
    renderStats(computeStats(parseJsonInput(source).ok ? JSON.parse(source) : source, source));
    showStatus("Converted");
  } catch (error) {
    resultOutput.value = String(error.message || error);
    hideStats();
    showStatus("Conversion failed");
  }
}

function runPrimaryAction() {
  if (activeTool === "diff") {
    const pair = ensureCompareSources();
    if (!pair) return;
    runDiffTool(pair.a, pair.b, "full");
    return;
  }
  if (activeTool === "jsonpath") {
    const source = ensureSource();
    if (!source) return;
    runJsonPathTool(source);
    return;
  }
  if (activeTool === "convert") {
    const source = ensureSource();
    if (!source) return;
    runConverterTool(source);
    return;
  }

  const source = ensureSource();
  if (!source) return;

  if (activeTool === "vfl") runValidateFormatLint(source);
  if (activeTool === "typegen") runTypeGenerator(source);
}

function runSecondaryAction() {
  if (activeTool === "diff") {
    const pair = ensureCompareSources();
    if (!pair) return;
    runDiffTool(pair.a, pair.b, "lines");
    return;
  }

  const source = ensureSource();
  if (!source) return;

  if (activeTool === "vfl") {
    formatJson(source, true);
    return;
  }
}

async function copyResult() {
  if (!resultOutput.value) {
    showStatus("Nothing to copy");
    return;
  }
  try {
    await navigator.clipboard.writeText(resultOutput.value);
    showStatus("Copied to clipboard");
  } catch (error) {
    showStatus("Copy failed");
  }
}

function downloadResult() {
  if (!resultOutput.value) {
    showStatus("Nothing to download");
    return;
  }
  const converterKey = activeTool === "convert" ? getConverterKey() : "";
  const looksLikeJson =
    activeTool === "vfl" || activeTool === "jsonpath" || converterKey.endsWith("->json");
  const ext =
    looksLikeJson
      ? "json"
      : activeTool === "typegen"
        ? "ts"
        : converterKey.endsWith("->csv")
          ? "csv"
          : converterKey.endsWith("->yaml")
            ? "yml"
            : converterKey.endsWith("->md-table")
              ? "md"
              : "txt";
  const mime = looksLikeJson ? "application/json" : "text/plain";
  const blob = new Blob([resultOutput.value], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `json-toolkit-${activeTool}.${ext}`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  showStatus("Download started");
}

function loadSample(kind) {
  if (activeTool === "convert") {
    const meta = getConverterSourceMeta();
    sourceInput.value = kind === "invalid" ? meta.invalidSample : meta.validSample;
  } else {
    sourceInput.value = kind === "invalid" ? SAMPLE_INVALID : SAMPLE_VALID;
  }
  resultOutput.value = "";
  hideStats();
  if (activeTool === "convert") {
    const from = convertFromSelect ? convertFromSelect.options[convertFromSelect.selectedIndex].text : "source";
    showStatus(kind === "invalid" ? `Loaded invalid ${from} sample` : `Loaded ${from} sample`);
  } else {
    showStatus(kind === "invalid" ? "Loaded invalid sample" : "Loaded sample JSON");
  }
  sourceInput.focus();
}

function clearAll() {
  sourceInput.value = "";
  if (compareInput) compareInput.value = "";
  resultOutput.value = "";
  hideStats();
  showStatus("Cleared");
}

function handleFileDrop(file) {
  const reader = new FileReader();
  reader.onload = () => {
    sourceInput.value = String(reader.result || "");
    resultOutput.value = "";
    hideStats();
    showStatus(`Loaded ${file.name}`);
  };
  reader.onerror = () => showStatus("Could not read file");
  reader.readAsText(file);
}

toolTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setActiveTool(tab.dataset.tool);
  });
});

sampleButtons.forEach((btn) => {
  btn.addEventListener("click", () => loadSample(btn.dataset.sample));
});

runBtn.addEventListener("click", runPrimaryAction);
secondaryBtn.addEventListener("click", runSecondaryAction);
copyBtn.addEventListener("click", copyResult);
downloadBtn.addEventListener("click", downloadResult);
clearBtn.addEventListener("click", clearAll);

sourceInput.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    runPrimaryAction();
  }
});

["dragenter", "dragover"].forEach((eventName) => {
  sourceInput.addEventListener(eventName, (event) => {
    if (!event.dataTransfer || !Array.from(event.dataTransfer.types || []).includes("Files")) return;
    event.preventDefault();
    sourceInput.classList.add("drag-over");
  });
});

["dragleave", "dragend"].forEach((eventName) => {
  sourceInput.addEventListener(eventName, () => {
    sourceInput.classList.remove("drag-over");
  });
});

sourceInput.addEventListener("drop", (event) => {
  const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
  if (!file) return;
  event.preventDefault();
  sourceInput.classList.remove("drag-over");
  handleFileDrop(file);
});

window.addEventListener("hashchange", () => {
  const tool = getToolFromHash();
  if (tool && tool !== activeTool) {
    setActiveTool(tool, { updateHash: false });
  }
});

if (jsonpathInput) {
  jsonpathInput.addEventListener("input", scheduleJsonPathUrlSync);
}

if (convertFromSelect && convertToSelect) {
  populateConverterOptions();
  convertFromSelect.addEventListener("change", () => {
    enforceJsonPair("from");
    updateConverterHint();
    updateSourceUiForActiveTool();
  });
  convertToSelect.addEventListener("change", () => {
    enforceJsonPair("to");
    updateConverterHint();
    updateSourceUiForActiveTool();
  });
}

if (convertSwapBtn && convertFromSelect && convertToSelect) {
  convertSwapBtn.addEventListener("click", () => {
    const from = convertFromSelect.value;
    convertFromSelect.value = convertToSelect.value;
    convertToSelect.value = from;
    enforceJsonPair("from");
    updateConverterHint();
    updateSourceUiForActiveTool();
    showStatus("Formats swapped");
  });
}

jsonpathExampleButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const p = btn.getAttribute("data-path") || "";
    if (jsonpathInput) jsonpathInput.value = p;
    scheduleJsonPathUrlSync();
    if (activeTool === "jsonpath") {
      const source = sourceInput.value.trim();
      if (source) runJsonPathTool(source);
    }
    showStatus("Sample query path loaded");
  });
});

setActiveTool(resolveInitialTool() || activeTool);
requestAnimationFrame(() => {
  if (document.activeElement === document.body && sourceInput) {
    sourceInput.focus({ preventScroll: true });
  }
});
