const fs = require("fs");
const path = require("path");
const { dialog } = require("electron");

// Variáveis CSS que extensões podem alterar (todas começam com --sb-).
const COLOR_VARS = new Set([
    "chrome-bg", "toolbar-bg", "surface", "button", "button-hover",
    "content-bg", "tabs-bg", "tab-bg", "tab-hover", "tab-active",
    "accent", "text-muted"
]);

const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.]+\s*(,\s*[\d.]+\s*){2,3}\))$/i;
const IMAGE_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function isColor(v) {
    return typeof v === "string" && v.length <= 40 && COLOR_RE.test(v.trim());
}

/**
 * ExtensionHost: aplica o que as extensões contribuem (tema, wallpaper)
 * na interface do navegador e nas páginas internas. Extensões nunca
 * injetam CSS cru — só valores validados passam por aqui.
 */
class ExtensionHost {
    constructor({ getWindow, getInternalContents }) {
        this.getWindow = getWindow;
        this.getInternalContents = getInternalContents;
        this.contributions = new Map(); // id -> { vars, wallpaper }
        this.cssKeys = new WeakMap();   // webContents -> key do insertCSS
    }

    // ---------- API chamada pelo ExtensionAPI ----------

    setTheme(id, vars) {
        const clean = {};
        for (const [k, v] of Object.entries(vars || {})) {
            if (COLOR_VARS.has(k) && isColor(v)) clean[k] = v.trim();
        }
        const entry = this.entry(id);
        entry.vars = clean;
        this.refreshAll();
    }

    setWallpaper(id, wallpaper) {
        this.entry(id).wallpaper = this.buildWallpaper(wallpaper);
        this.refreshAll();
    }

    clear(id) {
        if (this.contributions.delete(id)) this.refreshAll();
    }

    async pickImage() {
        const win = this.getWindow();
        const result = await dialog.showOpenDialog(win, {
            title: "Escolher imagem de fundo",
            properties: ["openFile"],
            filters: [{ name: "Imagens", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }]
        });
        if (result.canceled || !result.filePaths[0]) return null;

        const file = result.filePaths[0];
        const ext = path.extname(file).slice(1).toLowerCase();
        const mime = { png: "png", jpg: "jpeg", jpeg: "jpeg", webp: "webp", gif: "gif" }[ext];
        if (!mime) throw new Error("Formato de imagem não suportado.");
        const size = fs.statSync(file).size;
        if (size > MAX_IMAGE_BYTES) throw new Error("Imagem muito grande (máximo 4 MB).");
        return `data:image/${mime};base64,${fs.readFileSync(file).toString("base64")}`;
    }

    // ---------- internos ----------

    entry(id) {
        if (!this.contributions.has(id)) this.contributions.set(id, { vars: {}, wallpaper: null });
        return this.contributions.get(id);
    }

    buildWallpaper(w) {
        if (!w || typeof w !== "object") return null;
        if (w.type === "gradient") {
            const colors = Array.isArray(w.colors) ? w.colors.filter(isColor).slice(0, 5) : [];
            if (colors.length < 2) return null;
            const angle = Number.isFinite(w.angle) ? Math.round(w.angle) % 360 : 135;
            return `linear-gradient(${angle}deg, ${colors.join(", ")})`;
        }
        if (w.type === "image" && typeof w.dataUrl === "string" && IMAGE_RE.test(w.dataUrl)) {
            return `url("${w.dataUrl}") center / cover no-repeat`;
        }
        return null;
    }

    merged() {
        const vars = {};
        let wallpaper = null;
        for (const c of this.contributions.values()) {
            Object.assign(vars, c.vars);
            if (c.wallpaper) wallpaper = c.wallpaper;
        }
        return { vars, wallpaper };
    }

    buildCSS({ includeWallpaper }) {
        const { vars, wallpaper } = this.merged();
        const lines = Object.entries(vars).map(([k, v]) => `--sb-${k}: ${v};`);
        if (includeWallpaper && wallpaper) lines.push(`--sb-wallpaper: ${wallpaper};`);
        return lines.length ? `:root { ${lines.join(" ")} }` : "";
    }

    async inject(webContents, css) {
        if (!webContents || webContents.isDestroyed()) return;
        const oldKey = this.cssKeys.get(webContents);
        if (oldKey) {
            try { await webContents.removeInsertedCSS(oldKey); } catch { /* documento já trocou */ }
            this.cssKeys.delete(webContents);
        }
        if (!css) return;
        try {
            this.cssKeys.set(webContents, await webContents.insertCSS(css));
        } catch { /* página ainda carregando */ }
    }

    // Chamado quando uma página interna termina de carregar.
    applyTo(webContents) {
        this.cssKeys.delete(webContents); // navegação descarta o CSS antigo
        return this.inject(webContents, this.buildCSS({ includeWallpaper: true }));
    }

    refreshAll() {
        const win = this.getWindow();
        if (win && !win.isDestroyed()) {
            this.inject(win.webContents, this.buildCSS({ includeWallpaper: false }));
        }
        for (const wc of this.getInternalContents()) {
            this.inject(wc, this.buildCSS({ includeWallpaper: true }));
        }
    }
}

module.exports = ExtensionHost;
