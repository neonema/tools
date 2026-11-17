(function (global) {
  const PREFIX = "neonenc1.";
  const VERSION = 1;
  const DEFAULT_ITERATIONS = 600000;
  const MIN_ITERATIONS = 1000;
  const MAX_ITERATIONS = 600000;
  const SALT_BYTES = 16;
  const IV_BYTES = 12;
  const HEADER_BYTES = 1 + 4 + SALT_BYTES + IV_BYTES;
  const MAX_CHARS = 1000000;

  const MESSAGES = {
    "empty-text": "Enter some text to encrypt.",
    "empty-token": "Paste an encrypted message to decrypt.",
    "empty-passphrase": "Enter a passphrase.",
    "too-long": "That text is too long. The limit is 1,000,000 characters.",
    "not-neonenc":
      "This page can only decrypt text it encrypted. The message should start with neonenc1.",
    "bad-format": "That message is incomplete or damaged.",
    "wrong-passphrase":
      "That passphrase does not match this message, or the message was changed.",
    unsupported: "This message uses a version this page does not support.",
    "bad-iterations": "That message is not a valid NeoNema encryption.",
  };

  function fail(code) {
    return { ok: false, code, error: MESSAGES[code] };
  }

  function bytesToBase64(bytes) {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function base64ToBytes(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  function readIterations(passphrase, options) {
    if (passphrase.length === 0) return fail("empty-passphrase");
    const iterations =
      options && Number.isFinite(options.iterations) ? options.iterations : DEFAULT_ITERATIONS;
    if (iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS) return fail("bad-iterations");
    return { ok: true, iterations };
  }

  async function deriveKey(passphrase, salt, iterations, usages) {
    const material = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(passphrase),
      "PBKDF2",
      false,
      ["deriveKey"],
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      usages,
    );
  }

  function pack(iterations, salt, iv, ciphertext) {
    const payload = new Uint8Array(HEADER_BYTES + ciphertext.byteLength);
    const view = new DataView(payload.buffer);
    payload[0] = VERSION;
    view.setUint32(1, iterations);
    payload.set(salt, 5);
    payload.set(iv, 5 + SALT_BYTES);
    payload.set(new Uint8Array(ciphertext), HEADER_BYTES);
    return `${PREFIX}${bytesToBase64(payload)}`;
  }

  function unpack(token) {
    const compact = token.trim().replace(/\s+/g, "");
    if (!compact) return fail("empty-token");
    if (!compact.startsWith(PREFIX)) return fail("not-neonenc");

    let payload;
    try {
      payload = base64ToBytes(compact.slice(PREFIX.length));
    } catch {
      return fail("bad-format");
    }

    if (payload.length < HEADER_BYTES + 16) return fail("bad-format");
    if (payload[0] !== VERSION) return fail("unsupported");

    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
    const iterations = view.getUint32(1);
    if (iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS) return fail("bad-iterations");

    return {
      ok: true,
      iterations,
      salt: payload.slice(5, 5 + SALT_BYTES),
      iv: payload.slice(5 + SALT_BYTES, HEADER_BYTES),
      ciphertext: payload.slice(HEADER_BYTES),
    };
  }

  async function encryptText(plaintext, passphrase, options) {
    if (typeof plaintext !== "string" || plaintext.length === 0) return fail("empty-text");
    if (plaintext.length > MAX_CHARS) return fail("too-long");
    if (typeof passphrase !== "string") return fail("empty-passphrase");
    const checked = readIterations(passphrase, options);
    if (!checked.ok) return checked;

    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const key = await deriveKey(passphrase, salt, checked.iterations, ["encrypt"]);
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plaintext),
    );

    return { ok: true, token: pack(checked.iterations, salt, iv, ciphertext) };
  }

  async function decryptText(token, passphrase) {
    if (typeof token !== "string") return fail("empty-token");
    if (typeof passphrase !== "string" || passphrase.length === 0) return fail("empty-passphrase");

    const parsed = unpack(token);
    if (!parsed.ok) return parsed;

    try {
      const key = await deriveKey(passphrase, parsed.salt, parsed.iterations, ["decrypt"]);
      const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: parsed.iv },
        key,
        parsed.ciphertext,
      );
      return { ok: true, text: new TextDecoder().decode(plain) };
    } catch {
      return fail("wrong-passphrase");
    }
  }

  global.TextEncrypt = {
    PREFIX,
    VERSION,
    DEFAULT_ITERATIONS,
    MIN_ITERATIONS,
    MAX_ITERATIONS,
    MAX_CHARS,
    encryptText,
    decryptText,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
