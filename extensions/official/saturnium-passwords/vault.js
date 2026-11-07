const crypto = require("crypto");

// Cofre: scrypt (senha mestra -> chave) + AES-256-GCM. Nada em texto puro vai para o disco.
const KDF = { N: 32768, r: 8, p: 1, keylen: 32, maxmem: 128 * 1024 * 1024 };
const MIN_MASTER = 10;

function deriveKey(master, salt, params = KDF) {
    return crypto.scryptSync(master, salt, params.keylen || 32, {
        N: params.N, r: params.r, p: params.p, maxmem: KDF.maxmem
    });
}

function encrypt(key, payload, kdfMeta) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const data = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
    return {
        v: 1,
        kdf: kdfMeta,
        iv: iv.toString("base64"),
        tag: cipher.getAuthTag().toString("base64"),
        data: data.toString("base64")
    };
}

function decrypt(key, blob) {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(blob.iv, "base64"));
    decipher.setAuthTag(Buffer.from(blob.tag, "base64"));
    const plain = Buffer.concat([decipher.update(Buffer.from(blob.data, "base64")), decipher.final()]);
    return JSON.parse(plain.toString("utf8"));
}

function newVault(master) {
    if (typeof master !== "string" || master.length < MIN_MASTER) {
        throw new Error(`A senha mestra precisa ter pelo menos ${MIN_MASTER} caracteres.`);
    }
    const salt = crypto.randomBytes(16);
    const key = deriveKey(master, salt);
    const kdfMeta = { N: KDF.N, r: KDF.r, p: KDF.p, salt: salt.toString("base64") };
    return { key, kdfMeta };
}

function unlock(master, blob) {
    const meta = blob.kdf;
    const key = deriveKey(String(master), Buffer.from(meta.salt, "base64"), meta);
    try {
        return { key, payload: decrypt(key, blob) };
    } catch {
        key.fill(0);
        throw new Error("Senha mestra incorreta.");
    }
}

// ---------- gerador ----------
const SETS = {
    lower: "abcdefghijkmnopqrstuvwxyz",
    upper: "ABCDEFGHJKLMNPQRSTUVWXYZ",
    digits: "23456789",
    symbols: "!@#$%&*?-_=+"
};

function generate(opts = {}) {
    const length = Math.min(64, Math.max(8, Math.floor(Number(opts.length) || 20)));
    const classes = ["lower", "upper", "digits", "symbols"].filter(c => opts[c] !== false);
    if (!classes.length) throw new Error("Escolha ao menos um tipo de caractere.");
    const pool = classes.map(c => SETS[c]).join("");
    const out = classes.map(c => SETS[c][crypto.randomInt(SETS[c].length)]); // garante um de cada tipo
    while (out.length < length) out.push(pool[crypto.randomInt(pool.length)]);
    for (let i = out.length - 1; i > 0; i--) {              // embaralha (Fisher-Yates)
        const j = crypto.randomInt(i + 1);
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out.join("");
}

function isWeak(pw) {
    if (pw.length < 12) return true;
    const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(pw)).length;
    return kinds < 3;
}

// ---------- importação de CSV (formato do Chrome/Edge: name,url,username,password) ----------
function parseCsv(text) {
    const rows = [];
    let row = [], field = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
            else if (c === '"') quoted = false;
            else field += c;
        } else if (c === '"') quoted = true;
        else if (c === ",") { row.push(field); field = ""; }
        else if (c === "\n" || c === "\r") {
            if (c === "\r" && text[i + 1] === "\n") i++;
            row.push(field); field = "";
            if (row.some(x => x !== "")) rows.push(row);
            row = [];
        } else field += c;
    }
    row.push(field);
    if (row.some(x => x !== "")) rows.push(row);
    return rows;
}

module.exports = { newVault, unlock, encrypt, decrypt, deriveKey, generate, isWeak, parseCsv, MIN_MASTER, KDF };
