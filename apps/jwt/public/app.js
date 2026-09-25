const tokenInput = document.getElementById("token-input");
const headerOutput = document.getElementById("header-output");
const payloadOutput = document.getElementById("payload-output");
const signatureOutput = document.getElementById("signature-output");
const claimsMeta = document.getElementById("claims-meta");
const statusEl = document.getElementById("status");
const sampleBtn = document.getElementById("sample-btn");
const copyHeaderBtn = document.getElementById("copy-header-btn");
const copyPayloadBtn = document.getElementById("copy-payload-btn");
const clearBtn = document.getElementById("clear-btn");

const SAMPLE_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

/** @type {object | null} */
let lastHeader = null;
/** @type {object | null} */
let lastPayload = null;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.dataset.state = isError ? "error" : "ok";
}

function base64UrlToBytes(segment) {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(pad);
  const binary = atob(padded);
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

function decodeSegmentJson(segment) {
  const bytes = base64UrlToBytes(segment);
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text);
}

function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

function formatUnix(seconds) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return null;
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

function renderClaimsMeta(payload) {
  const bits = [];
  if (payload && typeof payload === "object") {
    const exp = formatUnix(payload.exp);
    const iat = formatUnix(payload.iat);
    const nbf = formatUnix(payload.nbf);
    if (exp) {
      const expired = typeof payload.exp === "number" && payload.exp * 1000 < Date.now();
      bits.push(`<span><strong>exp</strong> ${exp}${expired ? " · expired" : ""}</span>`);
    }
    if (iat) bits.push(`<span><strong>iat</strong> ${iat}</span>`);
    if (nbf) bits.push(`<span><strong>nbf</strong> ${nbf}</span>`);
    if (payload.iss) bits.push(`<span><strong>iss</strong> ${escapeHtml(String(payload.iss))}</span>`);
    if (payload.aud) {
      const aud = Array.isArray(payload.aud) ? payload.aud.join(", ") : String(payload.aud);
      bits.push(`<span><strong>aud</strong> ${escapeHtml(aud)}</span>`);
    }
    if (payload.sub) bits.push(`<span><strong>sub</strong> ${escapeHtml(String(payload.sub))}</span>`);
  }

  if (!bits.length) {
    claimsMeta.hidden = true;
    claimsMeta.innerHTML = "";
    return;
  }
  claimsMeta.hidden = false;
  claimsMeta.innerHTML = bits.join("");
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clearOutputs() {
  headerOutput.textContent = "";
  payloadOutput.textContent = "";
  signatureOutput.textContent = "";
  claimsMeta.hidden = true;
  claimsMeta.innerHTML = "";
  lastHeader = null;
  lastPayload = null;
}

function decodeToken() {
  const raw = tokenInput.value.trim();
  if (!raw) {
    clearOutputs();
    setStatus("");
    return;
  }

  const parts = raw.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) {
    clearOutputs();
    setStatus("A JWT has three Base64URL segments separated by dots.", true);
    return;
  }

  const [headerSeg, payloadSeg, signatureSeg] = parts;

  try {
    lastHeader = decodeSegmentJson(headerSeg);
    lastPayload = decodeSegmentJson(payloadSeg);
    headerOutput.textContent = formatJson(lastHeader);
    payloadOutput.textContent = formatJson(lastPayload);
    signatureOutput.textContent = signatureSeg;
    renderClaimsMeta(lastPayload);
    setStatus("Decoded locally. Signature not verified.");
  } catch {
    clearOutputs();
    setStatus("Could not decode this token — check that it is a valid JWT.", true);
  }
}

async function copyJson(value, label) {
  if (!value) {
    setStatus(`Nothing to copy — decode a token first.`, true);
    return;
  }
  try {
    await navigator.clipboard.writeText(formatJson(value));
    setStatus(`Copied ${label}.`);
  } catch {
    setStatus("Copy failed — select the panel text and copy manually.", true);
  }
}

tokenInput.addEventListener("input", decodeToken);

sampleBtn.addEventListener("click", () => {
  tokenInput.value = SAMPLE_JWT;
  decodeToken();
  tokenInput.focus();
});

copyHeaderBtn.addEventListener("click", () => copyJson(lastHeader, "header"));
copyPayloadBtn.addEventListener("click", () => copyJson(lastPayload, "payload"));

clearBtn.addEventListener("click", () => {
  tokenInput.value = "";
  clearOutputs();
  setStatus("");
  tokenInput.focus();
});
