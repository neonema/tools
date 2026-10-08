function stripBom(text) {
  const source = String(text);
  return source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
}

function svgDownloadName(fileName) {
  const base = String(fileName || "gerber").split(/[/\\]/).pop();
  const stem = base.replace(/\.[^.]+$/, "");
  const cleaned = stem
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return `${cleaned || "gerber"}.svg`;
}

function isJobFile(fileName) {
  return /\.gbrjob$/i.test(String(fileName || ""));
}

function looksBinary(text) {
  return String(text).includes("\u0000");
}

function readViewBox(svg) {
  const match = /viewBox="([^"]*)"/.exec(String(svg || ""));
  if (!match) return null;
  const parts = match[1].trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) return null;
  return parts;
}

function isEmptySvg(svg) {
  const box = readViewBox(svg);
  if (!box) return true;
  return box[2] === 0 && box[3] === 0;
}

// Share of the longer side left empty around the artwork, in addition to any
// stroke that would otherwise be clipped by a tight viewBox.
const MARGIN_RATIO = 0.05;

function maxStrokeWidth(svg) {
  let max = 0;
  const pattern = /stroke-width="([0-9.]+)"/g;
  let match = pattern.exec(svg);
  while (match) {
    const value = Number(match[1]);
    if (Number.isFinite(value) && value > max) max = value;
    match = pattern.exec(svg);
  }
  return max;
}

function formatSize(value) {
  return String(Math.round(value * 1000) / 1000);
}

function padSvg(svg) {
  const box = readViewBox(svg);
  if (!box || box[2] === 0 || box[3] === 0) return svg;

  const [x, y, width, height] = box;
  const pad = Math.max(Math.max(width, height) * MARGIN_RATIO, maxStrokeWidth(svg) / 2);
  if (!(pad > 0)) return svg;

  const nextBox = [x - pad, y - pad, width + pad * 2, height + pad * 2];
  const tagEnd = svg.indexOf(">");
  if (tagEnd === -1) return svg;

  const extra = (pad * 2) / 1000;
  const open = svg.slice(0, tagEnd).replace(
    /viewBox="[^"]*"/,
    `viewBox="${nextBox.join(" ")}"`,
  );
  const sized = open.replace(
    /(?<![\w-])(width|height)="([0-9.]+)(mm|in)?"/g,
    (full, attr, number, unit) => {
      const size = Number(number);
      if (!Number.isFinite(size)) return full;
      return `${attr}="${formatSize(size + extra)}${unit || ""}"`;
    },
  );
  return sized + svg.slice(tagEnd);
}

function convertGerber(text, id) {
  const source = stripBom(text);
  return new Promise((resolve, reject) => {
    if (typeof gerberToSvg !== "function") {
      reject(new Error("The Gerber converter did not load."));
      return;
    }
    try {
      gerberToSvg(source, { id: id || "layer" }, (error, svg) => {
        if (error) reject(error);
        else resolve(padSvg(svg));
      });
    } catch (error) {
      reject(error);
    }
  });
}

const Gerber = {
  stripBom,
  svgDownloadName,
  isJobFile,
  looksBinary,
  isEmptySvg,
  padSvg,
  convertGerber,
};

globalThis.Gerber = Gerber;
