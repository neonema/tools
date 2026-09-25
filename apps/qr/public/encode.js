(function (root) {
  const BORDER = 4;
  const PNG_MIN_PX = 1024;
  const ECC_LEVELS = ["L", "M", "Q", "H"];
  const SECURITIES = ["WPA", "WEP", "nopass"];
  const SECURITY_LABELS = {
    WPA: "WPA/WPA2",
    WEP: "WEP",
    nopass: "None",
  };
  const CAPTION_WIDTH = 32;
  const ECC_NAMES = {
    L: "LOW",
    M: "MEDIUM",
    Q: "QUARTILE",
    H: "HIGH",
  };

  function escapeWifi(value) {
    return String(value).replace(/[\\;,":]/g, (ch) => `\\${ch}`);
  }

  function wifiPayload({ ssid, password = "", security, hidden = false }) {
    if (typeof ssid !== "string" || ssid.length === 0) {
      throw new Error("Enter a network name.");
    }
    if (!SECURITIES.includes(security)) {
      throw new Error("Unsupported security type.");
    }
    if (security !== "nopass" && password.length === 0) {
      throw new Error("Enter the Wi-Fi password.");
    }
    const fields = [`T:${security}`, `S:${escapeWifi(ssid)}`];
    if (security !== "nopass") fields.push(`P:${escapeWifi(password)}`);
    if (hidden) fields.push("H:true");
    return `WIFI:${fields.join(";")};;`;
  }

  function encodeText(text, level) {
    if (typeof text !== "string" || text.length === 0) {
      throw new Error("Enter text or a URL.");
    }
    const name = ECC_NAMES[level];
    if (!name) throw new Error("Unsupported error correction.");
    const QrCode = root.qrcodegen && root.qrcodegen.QrCode;
    if (!QrCode) throw new Error("QR encoder failed to load.");
    try {
      return QrCode.encodeText(text, QrCode.Ecc[name]);
    } catch (err) {
      if (err instanceof RangeError && /too long/i.test(err.message)) {
        throw new Error("This is too long for a QR code at this error correction.");
      }
      throw err;
    }
  }

  function escapeXml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function wrapCaption(text) {
    const lines = [];
    for (const paragraph of String(text).split("\n")) {
      let rest = paragraph.trim();
      if (!rest) {
        lines.push("");
        continue;
      }
      while (rest.length > CAPTION_WIDTH) {
        let breakAt = rest.lastIndexOf(" ", CAPTION_WIDTH);
        if (breakAt <= 0) breakAt = CAPTION_WIDTH;
        lines.push(rest.slice(0, breakAt).trimEnd());
        rest = rest.slice(breakAt).trimStart();
      }
      lines.push(rest);
    }
    return lines;
  }

  function downloadCaption({
    mode,
    text = "",
    ssid = "",
    password = "",
    security = "",
    includeText = false,
    includeNetwork = false,
    includePassword = false,
    includeSecurity = false,
  }) {
    if (mode === "wifi") {
      const lines = [];
      if (includeNetwork) lines.push(...wrapCaption(`Network: ${ssid}`));
      if (includePassword && security !== "nopass") lines.push(...wrapCaption(`Password: ${password}`));
      if (includeSecurity) lines.push(...wrapCaption(`Security: ${SECURITY_LABELS[security] || security}`));
      return lines;
    }
    if (!includeText) return [];
    return wrapCaption(text);
  }

  function toSvg(qr, lines = []) {
    const dim = qr.size + BORDER * 2;
    const caption = Array.isArray(lines) ? lines : [];
    const lineHeight = 2.15;
    const captionHeight = caption.length ? 1.4 + caption.length * lineHeight + 0.6 : 0;
    const height = dim + captionHeight;
    const parts = [];
    for (let y = 0; y < qr.size; y += 1) {
      for (let x = 0; x < qr.size; x += 1) {
        if (qr.getModule(x, y)) {
          parts.push(`M${x + BORDER},${y + BORDER}h1v1h-1z`);
        }
      }
    }
    const text = caption
      .map((line, index) => {
        const y = dim + 1.4 + (index + 0.85) * lineHeight;
        return `<text x="${dim / 2}" y="${y}" text-anchor="middle" font-family="Outfit, system-ui, sans-serif" font-size="1.65" font-weight="600" fill="#000000">${escapeXml(line)}</text>`;
      })
      .join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${height}" shape-rendering="crispEdges" role="img"><rect width="100%" height="100%" fill="#ffffff"/><path d="${parts.join("")}" fill="#000000"/>${text}</svg>`;
  }

  function pngLayout(qr, lineCount = 0) {
    const modules = qr.size + BORDER * 2;
    const scale = Math.max(1, Math.ceil(PNG_MIN_PX / modules));
    const pixels = modules * scale;
    const count = lineCount > 0 ? lineCount : 0;
    const lineHeight = Math.round(scale * 2.1);
    const captionPx = count ? Math.round(scale * 1.2) + count * lineHeight + Math.round(scale * 0.8) : 0;
    return { modules, scale, pixels, border: BORDER, lineHeight, captionPx, height: pixels + captionPx };
  }

  function moduleBits(qr) {
    let bits = "";
    for (let y = 0; y < qr.size; y += 1) {
      for (let x = 0; x < qr.size; x += 1) {
        bits += qr.getModule(x, y) ? "1" : "0";
      }
    }
    return bits;
  }

  root.QrTool = {
    BORDER,
    PNG_MIN_PX,
    ECC_LEVELS,
    SECURITIES,
    escapeWifi,
    wifiPayload,
    downloadCaption,
    encodeText,
    toSvg,
    pngLayout,
    moduleBits,
  };
})(globalThis);
