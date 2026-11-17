(function (global) {
  const MAX_CHARS = 200000;

  function normalizeShift(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return ((Math.trunc(n) % 26) + 26) % 26;
  }

  function shiftChar(ch, shift) {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      return String.fromCharCode(65 + ((code - 65 + shift) % 26 + 26) % 26);
    }
    if (code >= 97 && code <= 122) {
      return String.fromCharCode(97 + ((code - 97 + shift) % 26 + 26) % 26);
    }
    return ch;
  }

  function mapText(text, mapChar) {
    let out = "";
    for (const ch of text) {
      out += ch.length === 1 ? mapChar(ch) : ch;
    }
    return out;
  }

  function caesar(text, shift) {
    const amount = normalizeShift(shift);
    if (amount === null) {
      throw new Error("Shift must be a whole number.");
    }
    return mapText(text, (ch) => shiftChar(ch, amount));
  }

  function rot13(text) {
    return caesar(text, 13);
  }

  function atbash(text) {
    return mapText(text, (ch) => {
      const code = ch.charCodeAt(0);
      if (code >= 65 && code <= 90) return String.fromCharCode(65 + (25 - (code - 65)));
      if (code >= 97 && code <= 122) return String.fromCharCode(97 + (25 - (code - 97)));
      return ch;
    });
  }

  function keyLetters(key) {
    return String(key).toUpperCase().replace(/[^A-Z]/g, "");
  }

  function vigenere(text, key, decode) {
    const letters = keyLetters(key);
    if (!letters) {
      throw new Error("Enter a key with at least one letter.");
    }
    let index = 0;
    return mapText(text, (ch) => {
      const code = ch.charCodeAt(0);
      const upper = code >= 65 && code <= 90;
      const lower = code >= 97 && code <= 122;
      if (!upper && !lower) return ch;
      const base = upper ? 65 : 97;
      const shift = letters.charCodeAt(index % letters.length) - 65;
      index += 1;
      const applied = decode ? (26 - shift) % 26 : shift;
      return String.fromCharCode(base + ((code - base + applied) % 26));
    });
  }

  /** Decode by every Caesar shift. Shift 0 is the original text. */
  function allCaesarShifts(text) {
    const rows = [];
    for (let shift = 0; shift < 26; shift += 1) {
      rows.push({ shift, text: caesar(text, -shift) });
    }
    return rows;
  }

  global.Cipher = {
    MAX_CHARS,
    normalizeShift,
    caesar,
    rot13,
    atbash,
    vigenere,
    allCaesarShifts,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
