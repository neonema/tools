const tool = globalThis.QrTool;

const modeInputs = document.querySelectorAll('input[name="mode"]');
const textPanel = document.getElementById("text-panel");
const wifiPanel = document.getElementById("wifi-panel");
const textInput = document.getElementById("qr-text");
const ssidInput = document.getElementById("wifi-ssid");
const passwordInput = document.getElementById("wifi-password");
const hiddenInput = document.getElementById("wifi-hidden");
const securityInputs = document.querySelectorAll('input[name="security"]');
const eccInputs = document.querySelectorAll('input[name="ecc"]');
const statusEl = document.getElementById("status");
const previewEl = document.getElementById("preview");
const textCaption = document.getElementById("text-caption");
const wifiCaption = document.getElementById("wifi-caption");
const includeText = document.getElementById("include-text");
const includeNetwork = document.getElementById("include-network");
const includePassword = document.getElementById("include-password");
const includeSecurity = document.getElementById("include-security");
const pngBtn = document.getElementById("png-btn");
const svgBtn = document.getElementById("svg-btn");

let currentQr = null;
let currentSvg = "";

function selectedValue(inputs) {
  const checked = [...inputs].find((input) => input.checked);
  return checked ? checked.value : "";
}

function setStatus(message, isError) {
  statusEl.textContent = message;
  statusEl.dataset.state = isError ? "error" : message ? "ok" : "";
}

function payload() {
  if (selectedValue(modeInputs) === "wifi") {
    const security = selectedValue(securityInputs);
    const openNetwork = security === "nopass";
    passwordInput.disabled = openNetwork;
    includePassword.disabled = openNetwork;
    try {
      return tool.wifiPayload({
        ssid: ssidInput.value,
        password: security === "nopass" ? "" : passwordInput.value,
        security,
        hidden: hiddenInput.checked,
      });
    } catch (err) {
      if (err instanceof Error && err.message === "Enter a network name.") return "";
      throw err;
    }
  }
  passwordInput.disabled = false;
  includePassword.disabled = false;
  return textInput.value;
}

function renderEmpty(message, isError) {
  currentQr = null;
  currentSvg = "";
  previewEl.classList.remove("has-caption");
  previewEl.replaceChildren();
  const note = document.createElement("p");
  note.className = "preview-empty";
  note.textContent = "The code appears here.";
  previewEl.append(note);
  previewEl.setAttribute("aria-label", "No QR code yet");
  pngBtn.disabled = true;
  svgBtn.disabled = true;
  setStatus(message, isError);
}

function renderCode(qr) {
  currentQr = qr;
  const lines = captionLines();
  currentSvg = tool.toSvg(qr, lines);
  previewEl.classList.toggle("has-caption", lines.length > 0);
  previewEl.innerHTML = currentSvg;
  const svg = previewEl.querySelector("svg");
  if (svg) svg.setAttribute("aria-label", "QR code");
  previewEl.setAttribute("aria-label", "QR code");
  pngBtn.disabled = false;
  svgBtn.disabled = false;
  setStatus("", false);
}

function update() {
  let text = "";
  try {
    text = payload();
  } catch (err) {
    renderEmpty(err instanceof Error ? err.message : "Could not build the code.", true);
    return;
  }
  if (!text) {
    renderEmpty("", false);
    return;
  }
  try {
    renderCode(tool.encodeText(text, selectedValue(eccInputs)));
  } catch (err) {
    renderEmpty(err instanceof Error ? err.message : "Could not build the code.", true);
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function captionLines() {
  if (!currentQr) return [];
  if (selectedValue(modeInputs) === "wifi") {
    const security = selectedValue(securityInputs);
    return tool.downloadCaption({
      mode: "wifi",
      ssid: ssidInput.value,
      password: passwordInput.value,
      security,
      includeNetwork: includeNetwork.checked,
      includePassword: includePassword.checked && security !== "nopass",
      includeSecurity: includeSecurity.checked,
    });
  }
  return tool.downloadCaption({
    mode: "text",
    text: textInput.value,
    includeText: includeText.checked,
  });
}

function downloadSvg() {
  if (!currentQr) return;
  const svg = tool.toSvg(currentQr, captionLines());
  downloadBlob(new Blob([svg], { type: "image/svg+xml" }), "qr-code.svg");
}

function drawCaption(ctx, lines, width, top, lineHeight) {
  let fontSize = Math.round(lineHeight * 0.72);
  const font = (size) => `600 ${size}px Outfit, system-ui, sans-serif`;
  ctx.font = font(fontSize);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const widest = Math.max(...lines.map((line) => ctx.measureText(line).width), 0);
  const maxWidth = width * 0.92;
  if (widest > maxWidth && widest > 0) {
    fontSize = Math.max(12, Math.floor((fontSize * maxWidth) / widest));
    ctx.font = font(fontSize);
  }
  ctx.fillStyle = "#000000";
  lines.forEach((line, index) => {
    ctx.fillText(line, width / 2, top + (index + 0.5) * lineHeight);
  });
}

function downloadPng() {
  if (!currentQr) return;
  const lines = captionLines();
  const { scale, pixels, border, lineHeight, captionPx, height } = tool.pngLayout(currentQr, lines.length);
  const canvas = document.createElement("canvas");
  canvas.width = pixels;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, pixels, height);
  ctx.fillStyle = "#000000";
  for (let y = 0; y < currentQr.size; y += 1) {
    for (let x = 0; x < currentQr.size; x += 1) {
      if (currentQr.getModule(x, y)) {
        ctx.fillRect((x + border) * scale, (y + border) * scale, scale, scale);
      }
    }
  }
  if (lines.length) {
    const top = pixels + Math.round(scale * 1.2);
    drawCaption(ctx, lines, pixels, top, lineHeight);
  }
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, "qr-code.png");
  }, "image/png");
}

function syncMode() {
  const wifi = selectedValue(modeInputs) === "wifi";
  textPanel.hidden = wifi;
  wifiPanel.hidden = !wifi;
  textCaption.hidden = wifi;
  wifiCaption.hidden = !wifi;
  update();
}

const captionInputs = [includeText, includeNetwork, includePassword, includeSecurity];

for (const input of [...modeInputs, ...securityInputs, ...eccInputs, hiddenInput, ...captionInputs]) {
  input.addEventListener("change", syncMode);
}
textInput.addEventListener("input", update);
ssidInput.addEventListener("input", update);
passwordInput.addEventListener("input", update);
pngBtn.addEventListener("click", downloadPng);
svgBtn.addEventListener("click", downloadSvg);
syncMode();
