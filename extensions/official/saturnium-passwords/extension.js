const crypto = require("crypto");
const vault = require("./vault");

const HOST_RE = /^[a-z0-9.-]{1,253}$/;
const MAX_ENTRIES = 2000;
const AUTO_LOCK_MS = 5 * 60 * 1000;
const CLIPBOARD_CLEAR_MS = 30 * 1000;

function siteFrom(input) {
    let v = String(input || "").trim().toLowerCase();
    if (!v) return "";
    try { if (/^[a-z]+:\/\//.test(v)) v = new URL(v).hostname; } catch { /* usa como veio */ }
    v = v.replace(/^www\./, "").replace(/\/.*$/, "");
    return HOST_RE.test(v) ? v : "";
}

function clip(s, n) { return String(s == null ? "" : s).slice(0, n); }

module.exports = {
    activate(api) {
        const store = api.storageAPI;
        let key = null;        // só na memória, enquanto desbloqueado
        let meta = null;       // parâmetros do KDF (salt etc.)
        let entries = [];
        let lockTimer = null;
        let failures = 0;
        let lockedUntil = 0;

        const exists = () => !!store.get().vault;
        const unlocked = () => !!key;

        function lock() {
            if (key) key.fill(0);
            key = null; meta = null; entries = [];
            clearTimeout(lockTimer); lockTimer = null;
        }
        function touch() {
            clearTimeout(lockTimer);
            lockTimer = setTimeout(lock, AUTO_LOCK_MS);
            if (lockTimer.unref) lockTimer.unref();
        }
        function requireUnlocked() {
            if (!unlocked()) throw new Error("O cofre está bloqueado.");
            touch();
        }
        function persist() {
            store.set({ vault: vault.encrypt(key, { entries }, meta) });
        }
        function find(id) {
            const e = entries.find(x => x.id === id);
            if (!e) throw new Error("Entrada não encontrada.");
            return e;
        }
        function summary() {
            const counts = new Map();
            for (const e of entries) counts.set(e.password, (counts.get(e.password) || 0) + 1);
            return entries
                .map(e => ({
                    id: e.id, title: e.title, site: e.site, username: e.username, updated: e.updated,
                    weak: vault.isWeak(e.password), reused: counts.get(e.password) > 1
                }))
                .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
        }
        function status() {
            return {
                exists: exists(), unlocked: unlocked(),
                currentHost: api.tabs.activeHost(),
                minMaster: vault.MIN_MASTER,
                entries: unlocked() ? summary() : [],
                autoLockMinutes: AUTO_LOCK_MS / 60000
            };
        }
        function sanitize(input, existing) {
            const title = clip(input.title, 120).trim();
            const site = siteFrom(input.site);
            const password = clip(input.password, 1000);
            if (!title && !site) throw new Error("Informe um título ou um site.");
            if (!password) throw new Error("A senha não pode ficar vazia.");
            return {
                id: existing ? existing.id : crypto.randomBytes(8).toString("hex"),
                title: title || site, site,
                username: clip(input.username, 300),
                password,
                notes: clip(input.notes, 5000),
                updated: Date.now()
            };
        }

        return {
            methods: {
                status: () => status(),

                setup: master => {
                    if (exists()) throw new Error("Já existe um cofre.");
                    const fresh = vault.newVault(master);
                    key = fresh.key; meta = fresh.kdfMeta; entries = [];
                    persist(); touch();
                    return status();
                },

                unlock: master => {
                    if (!exists()) throw new Error("Crie o cofre primeiro.");
                    if (Date.now() < lockedUntil) {
                        throw new Error(`Muitas tentativas. Aguarde ${Math.ceil((lockedUntil - Date.now()) / 1000)}s.`);
                    }
                    const blob = store.get().vault;
                    try {
                        const r = vault.unlock(master, blob);
                        key = r.key; meta = blob.kdf;
                        entries = Array.isArray(r.payload.entries) ? r.payload.entries : [];
                        failures = 0; touch();
                    } catch (error) {
                        failures += 1;
                        if (failures >= 5) lockedUntil = Date.now() + Math.min(300, 15 * (failures - 4)) * 1000;
                        throw error;
                    }
                    return status();
                },

                lock: () => { lock(); return status(); },

                changeMaster: ({ current, next } = {}) => {
                    requireUnlocked();
                    vault.unlock(current, store.get().vault); // confere a senha atual
                    const fresh = vault.newVault(next);
                    key.fill(0);
                    key = fresh.key; meta = fresh.kdfMeta;
                    persist();
                    return status();
                },

                get: id => { requireUnlocked(); return { ...find(id) }; },

                save: input => {
                    requireUnlocked();
                    const existing = input && input.id ? find(input.id) : null;
                    if (!existing && entries.length >= MAX_ENTRIES) throw new Error("Limite de entradas atingido.");
                    const clean = sanitize(input || {}, existing);
                    if (existing) Object.assign(existing, clean); else entries.push(clean);
                    persist();
                    return status();
                },

                remove: id => {
                    requireUnlocked();
                    find(id);
                    entries = entries.filter(e => e.id !== id);
                    persist();
                    return status();
                },

                copyPassword: id => {
                    requireUnlocked();
                    api.clipboard.writeText(find(id).password, { clearAfterMs: CLIPBOARD_CLEAR_MS });
                    return { seconds: CLIPBOARD_CLEAR_MS / 1000 };
                },

                copyUsername: id => {
                    requireUnlocked();
                    const u = find(id).username;
                    if (!u) throw new Error("Esta entrada não tem usuário.");
                    api.clipboard.writeText(u);
                    return true;
                },

                fill: async id => {
                    requireUnlocked();
                    const e = find(id);
                    if (!e.site) throw new Error("Defina o site desta entrada para usar o preenchimento.");
                    return api.autofill.fill({ host: e.site, username: e.username, password: e.password });
                },

                generate: opts => vault.generate(opts),

                importCsv: text => {
                    requireUnlocked();
                    const rows = vault.parseCsv(String(text || "").slice(0, 5 * 1024 * 1024));
                    if (rows.length < 2) throw new Error("Arquivo CSV vazio.");
                    const head = rows[0].map(h => h.trim().toLowerCase());
                    const col = n => head.indexOf(n);
                    const iName = col("name"), iUrl = col("url"), iUser = col("username"), iPass = col("password");
                    if (iPass < 0 || (iUrl < 0 && iName < 0)) {
                        throw new Error("Formato não reconhecido. Use colunas name, url, username, password.");
                    }
                    let added = 0, skipped = 0;
                    for (const r of rows.slice(1)) {
                        if (entries.length >= MAX_ENTRIES) { skipped++; continue; }
                        const site = siteFrom(iUrl >= 0 ? r[iUrl] : "");
                        const username = iUser >= 0 ? clip(r[iUser], 300) : "";
                        const password = clip(r[iPass], 1000);
                        const title = clip(iName >= 0 ? r[iName] : "", 120).trim() || site;
                        if (!password || !title || entries.some(e => e.site === site && e.username === username && e.password === password)) {
                            skipped++; continue;
                        }
                        entries.push({ id: crypto.randomBytes(8).toString("hex"), title, site, username, password, notes: "", updated: Date.now() });
                        added++;
                    }
                    persist();
                    return { added, skipped, ...status() };
                }
            },
            deactivate() { lock(); }
        };
    }
};
