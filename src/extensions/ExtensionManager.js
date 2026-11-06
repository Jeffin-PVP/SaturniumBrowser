const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const ExtensionStorage = require("./ExtensionStorage");
const ExtensionLoader = require("./ExtensionLoader");
const ExtensionHost = require("./ExtensionHost");

class ExtensionManager {
    constructor({ getWindow, getInternalContents } = {}) {
        this.root = path.join(app.getPath("userData"), "extensions");
        this.statePath = path.join(this.root, "state.json");
        this.storage = new ExtensionStorage(path.join(this.root, "storage"));
        this.host = new ExtensionHost({
            getWindow: getWindow || (() => null),
            getInternalContents: getInternalContents || (() => [])
        });
        this.loader = new ExtensionLoader(this.storage, this.host);
        this.extensions = new Map();
        this.ensureDirectories();
    }

    ensureDirectories() { fs.mkdirSync(this.root, { recursive: true }); }

    // ---------- estado persistido (ativada/desativada) ----------

    loadState() {
        try { return JSON.parse(fs.readFileSync(this.statePath, "utf8")); } catch { return {}; }
    }

    saveState() {
        const state = {};
        for (const [id, e] of this.extensions) state[id] = { enabled: e.enabled };
        try { fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2), "utf8"); }
        catch (error) { console.error("[Extensions] Falha ao salvar estado:", error.message); }
    }

    // ---------- ciclo de vida ----------

    initialize() {
        this.extensions.clear();
        const saved = this.loadState();
        const official = path.join(__dirname, "..", "..", "extensions", "official");
        if (!fs.existsSync(official)) return;
        for (const dir of fs.readdirSync(official, { withFileTypes: true })) {
            if (!dir.isDirectory()) continue;
            try {
                const ext = this.loader.load(path.join(official, dir.name));
                const enabled = saved[ext.manifest.id] ? saved[ext.manifest.id].enabled !== false : true;
                const record = { ...ext, enabled: false, instance: null, source: "official" };
                this.extensions.set(ext.manifest.id, record);
                if (enabled) this.activate(record);
            } catch (error) {
                console.error(`[Extensions] Falha ao carregar ${dir.name}:`, error.message);
            }
        }
        this.saveState();
    }

    activate(record) {
        try {
            const mod = record.module;
            record.instance = (mod && typeof mod.activate === "function") ? (mod.activate(record.api) || {}) : {};
            record.enabled = true;
        } catch (error) {
            record.enabled = false;
            record.instance = null;
            this.host.clear(record.manifest.id);
            console.error(`[Extensions] Falha ao ativar ${record.manifest.id}:`, error.message);
        }
    }

    deactivate(record) {
        try {
            if (record.instance && typeof record.instance.deactivate === "function") record.instance.deactivate();
        } catch (error) {
            console.error(`[Extensions] Erro ao desativar ${record.manifest.id}:`, error.message);
        }
        this.host.clear(record.manifest.id); // remove tema/wallpaper contribuídos
        record.instance = null;
        record.enabled = false;
    }

    setEnabled(id, enabled) {
        const record = this.extensions.get(id);
        if (record && record.enabled !== !!enabled) {
            if (enabled) this.activate(record); else this.deactivate(record);
            this.saveState();
        }
        return this.list();
    }

    // Executa um método exposto pela extensão (instance.methods) para a UI de configurações.
    async call(id, method, args) {
        const record = this.extensions.get(id);
        if (!record || !record.enabled) throw new Error("Extensão inativa.");
        const methods = record.instance && record.instance.methods;
        if (!methods || typeof method !== "string" || !Object.prototype.hasOwnProperty.call(methods, method)) {
            throw new Error("Método não disponível.");
        }
        return methods[method](args);
    }

    settingsFile(id) {
        const record = this.extensions.get(id);
        if (!record || !record.manifest.settings) return null;
        return record.manifest.settings;
    }

    // Resolve com segurança um arquivo dentro da pasta da extensão.
    resolveAsset(id, relative) {
        const record = this.extensions.get(id);
        if (!record) return null;
        const root = path.resolve(record.path);
        const candidate = path.resolve(root, relative.replace(/^\/+/, ""));
        if (!candidate.startsWith(root + path.sep)) return null;
        return fs.existsSync(candidate) ? candidate : null;
    }

    list() {
        return [...this.extensions.values()].map(e => ({
            id: e.manifest.id, name: e.manifest.name, version: e.manifest.version,
            description: e.manifest.description || "", author: e.manifest.author || "Saturnium",
            permissions: e.permissions, enabled: e.enabled, source: e.source,
            hasSettings: !!e.manifest.settings
        }));
    }
}

module.exports = ExtensionManager;
