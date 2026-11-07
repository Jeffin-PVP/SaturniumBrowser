const fs = require("fs");
const path = require("path");
const { dialog, net, clipboard, Menu } = require("electron");
const scripts = require("./pageScripts");

// Variáveis CSS que extensões podem alterar (todas começam com --sb-).
const COLOR_VARS = new Set([
    "chrome-bg", "toolbar-bg", "surface", "button", "button-hover",
    "content-bg", "tabs-bg", "tab-bg", "tab-hover", "tab-active",
    "accent", "text-muted"
]);

const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.]+\s*(,\s*[\d.]+\s*){2,3}\))$/i;
const IMAGE_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

// Presets de estilo para páginas web. O CSS é fixo aqui no host: extensões só escolhem o nome.
const PAGE_PRESETS = {
    dark: "html{filter:invert(1) hue-rotate(180deg)!important;background:#fff!important}" +
          "img,picture,video,canvas,iframe,svg image,[style*=\"background-image\"]{filter:invert(1) hue-rotate(180deg)!important}",
    dim: "html{filter:brightness(.82) contrast(.95)!important}",
    sepia: "html{filter:sepia(.45) brightness(.95)!important}",
    grayscale: "html{filter:grayscale(1)!important}",
    contrast: "html{filter:contrast(1.25) saturate(1.1)!important}"
};
const HOST_RE = /^[a-z0-9.-]{1,253}$/i;
const MAX_FETCH_BYTES = 1024 * 1024;
const FETCH_TIMEOUT_MS = 8000;

function cleanHost(h) {
    if (typeof h !== "string") return null;
    const v = h.trim().toLowerCase().replace(/^www\./, "");
    return HOST_RE.test(v) ? v : null;
}

function webHost(webContents) {
    try {
        const u = new URL(webContents.getURL());
        if (u.protocol !== "http:" && u.protocol !== "https:") return null;
        return u.hostname.toLowerCase().replace(/^www\./, "");
    } catch { return null; }
}

function hostMatches(list, host) {
    return list.some(h => host === h || host.endsWith("." + h));
}

function isColor(v) {
    return typeof v === "string" && v.length <= 40 && COLOR_RE.test(v.trim());
}

/**
 * ExtensionHost: aplica o que as extensões contribuem (tema, wallpaper)
 * na interface do navegador e nas páginas internas. Extensões nunca
 * injetam CSS cru — só valores validados passam por aqui.
 */
class ExtensionHost {
    constructor({ getWindow, getInternalContents, getWebContents, getActiveWebContents, openExtensionPage }) {
        this.openExtensionPage = openExtensionPage || (() => {});
        this.wired = new WeakSet();      // abas com listeners (Alt+P, menu de contexto)
        this.pipInstalled = new WeakSet();
        this.getWindow = getWindow;
        this.getInternalContents = getInternalContents;
        this.getWebContents = getWebContents || (() => []);
        this.getActiveWebContents = getActiveWebContents || (() => null);
        this.pageKeys = new WeakMap();   // webContents -> key do insertCSS de página web
        this.zoomed = new WeakSet();     // abas cujo zoom foi alterado por extensões
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

    setPageStyle(id, config) {
        const entry = this.entry(id);
        if (!config || typeof config !== "object" || !PAGE_PRESETS[config.preset]) {
            entry.pageStyle = null;
        } else {
            const exclude = Array.isArray(config.excludeHosts)
                ? config.excludeHosts.map(cleanHost).filter(Boolean).slice(0, 200) : [];
            entry.pageStyle = { preset: config.preset, exclude };
        }
        this.refreshWeb();
    }

    setZoom(id, hosts) {
        const entry = this.entry(id);
        const clean = {};
        if (hosts && typeof hosts === "object") {
            for (const [h, f] of Object.entries(hosts).slice(0, 500)) {
                const host = cleanHost(h);
                const factor = Number(f);
                if (host && Number.isFinite(factor) && factor >= 0.5 && factor <= 3) {
                    clean[host] = Math.round(factor * 100) / 100;
                }
            }
        }
        entry.zoom = Object.keys(clean).length ? clean : null;
        this.refreshWeb();
    }

    setPip(id, config) {
        const entry = this.entry(id);
        if (!config || typeof config !== "object") {
            entry.pip = null;
        } else {
            const hosts = Array.isArray(config.hosts) ? config.hosts.map(cleanHost).filter(Boolean).slice(0, 50) : [];
            entry.pip = hosts.length
                ? { hosts, position: scripts.PIP_POSITIONS.has(config.position) ? config.position : "top-right" }
                : null;
        }
        this.refreshWeb();
    }

    // O host confere que a aba ativa pertence ao domínio do cadastro antes de entregar a senha.
    async fillLogin(id, data) {
        const { host, username, password } = data || {};
        const wc = this.getActiveWebContents();
        if (!wc || wc.isDestroyed()) throw new Error("Abra o site do login em uma aba.");
        const target = cleanHost(host);
        let url;
        try { url = new URL(wc.getURL()); } catch { url = null; }
        if (!target || !url) throw new Error("Abra o site do login em uma aba.");
        const current = url.hostname.toLowerCase().replace(/^www\./, "");
        const secure = url.protocol === "https:" || (url.protocol === "http:" && current === "localhost");
        if (!secure) throw new Error("O preenchimento só funciona em páginas https.");
        if (current !== target && !current.endsWith("." + target)) {
            throw new Error(`A aba ativa (${current}) não é do site salvo (${target}).`);
        }
        if (typeof username !== "string" || typeof password !== "string" || username.length > 500 || password.length > 1000) {
            throw new Error("Dados de login inválidos.");
        }
        return wc.executeJavaScript(scripts.fillLoginScript(username, password), true);
    }

    copyText(text, options) {
        if (typeof text !== "string" || !text || text.length > 2000) throw new Error("Texto inválido.");
        clipboard.writeText(text);
        const ms = options && Number(options.clearAfterMs);
        if (Number.isFinite(ms) && ms >= 1000 && ms <= 120000) {
            setTimeout(() => {
                try { if (clipboard.readText() === text) clipboard.clear(); } catch { /* ignore */ }
            }, ms).unref?.();
        }
        return true;
    }

    // Só https e só domínios declarados no manifest da extensão; limite de tempo e de tamanho.
    async fetchJSON(rawUrl, allowedHosts) {
        let url;
        try { url = new URL(String(rawUrl)); } catch { throw new Error("URL inválida."); }
        if (url.protocol !== "https:" || !allowedHosts.includes(url.hostname.toLowerCase())) {
            throw new Error("Endereço não permitido para esta extensão.");
        }
        const res = await net.fetch(url.toString(), {
            headers: { Accept: "application/json" },
            redirect: "error",
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
        });
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > MAX_FETCH_BYTES) throw new Error("Resposta grande demais.");
        let data = null;
        try { data = JSON.parse(buf.toString("utf8")); } catch { /* corpo não-JSON */ }
        return { ok: res.ok, status: res.status, data };
    }

    addContextItem(id, item) {
        const entry = this.entry(id);
        if (!item || typeof item.label !== "string" || typeof item.handler !== "function") {
            throw new Error("Item de menu inválido.");
        }
        if (entry.contextItems.length >= 5) throw new Error("Limite de itens de menu atingido.");
        const maxWords = Math.min(20, Math.max(1, Math.floor(Number(item.maxWords) || 3)));
        entry.contextItems.push({ label: item.label.slice(0, 40), maxWords, handler: item.handler });
    }

    openPage(id, query) {
        const q = typeof query === "string" ? query.trim().slice(0, 200) : "";
        this.openExtensionPage(id, q);
    }

    activeHost() {
        const wc = this.getActiveWebContents();
        return wc && !wc.isDestroyed() ? webHost(wc) : null;
    }

    clear(id) {
        if (this.contributions.delete(id)) {
            this.refreshAll();
            this.refreshWeb();
        }
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
        if (!this.contributions.has(id)) {
            this.contributions.set(id, {
                vars: {}, wallpaper: null, pageStyle: null, zoom: null, pip: null, contextItems: []
            });
        }
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

    // ---------- páginas web (abas normais) ----------

    // Estilo combinado de todas as extensões ativas para um domínio.
    pageCSSFor(host) {
        if (!host) return "";
        const parts = [];
        for (const c of this.contributions.values()) {
            const s = c.pageStyle;
            if (s && !hostMatches(s.exclude, host)) parts.push(PAGE_PRESETS[s.preset]);
        }
        return parts.join("\n");
    }

    zoomFor(host) {
        if (!host) return null;
        let factor = null;
        for (const c of this.contributions.values()) {
            if (!c.zoom) continue;
            for (const [h, f] of Object.entries(c.zoom)) {
                if (host === h || host.endsWith("." + h)) factor = f;
            }
        }
        return factor;
    }

    async applyToWeb(webContents) {
        if (!webContents || webContents.isDestroyed()) return;
        const host = webHost(webContents);

        const oldKey = this.pageKeys.get(webContents);
        if (oldKey) {
            try { await webContents.removeInsertedCSS(oldKey); } catch { /* documento já trocou */ }
            this.pageKeys.delete(webContents);
        }
        const css = this.pageCSSFor(host);
        if (css) {
            try { this.pageKeys.set(webContents, await webContents.insertCSS(css, { cssOrigin: "user" })); }
            catch { /* página ainda carregando */ }
        }

        this.wire(webContents);

        const pip = this.pipFor(host);
        try {
            if (pip) {
                await webContents.executeJavaScript(scripts.pipInstallScript(pip.position));
                this.pipInstalled.add(webContents);
            } else if (this.pipInstalled.has(webContents)) {
                await webContents.executeJavaScript(scripts.PIP_REMOVE_SCRIPT);
                this.pipInstalled.delete(webContents);
            }
        } catch { /* página trocou durante a injeção */ }

        const factor = this.zoomFor(host);
        if (factor) {
            webContents.setZoomFactor(factor);
            this.zoomed.add(webContents);
        } else if (this.zoomed.has(webContents)) {
            webContents.setZoomFactor(1);
            this.zoomed.delete(webContents);
        }
    }

    pipFor(host) {
        if (!host) return null;
        let found = null;
        for (const c of this.contributions.values()) {
            if (c.pip && hostMatches(c.pip.hosts, host)) found = c.pip;
        }
        return found;
    }

    // Listeners de Alt+P (miniplayer) e do menu de contexto com texto selecionado.
    wire(webContents) {
        if (this.wired.has(webContents)) return;
        this.wired.add(webContents);

        webContents.on("before-input-event", (event, input) => {
            if (input.type !== "keyDown" || !input.alt || input.control || input.meta || input.shift) return;
            if (String(input.key).toLowerCase() !== "p") return;
            if (!this.pipFor(webHost(webContents))) return;
            event.preventDefault();
            webContents.executeJavaScript(scripts.PIP_TOGGLE_SCRIPT, true).catch(() => {});
        });

        webContents.on("context-menu", (event, params) => this.showContextMenu(webContents, params));
    }

    showContextMenu(webContents, params) {
        const text = String(params.selectionText || "").trim();
        if (!text || text.length > 200) return;
        const words = text.split(/\s+/).length;
        const short = text.length > 24 ? text.slice(0, 24) + "…" : text;
        const items = [];
        for (const c of this.contributions.values()) {
            for (const item of c.contextItems) {
                if (words > item.maxWords) continue;
                items.push({
                    label: `${item.label} “${short}”`,
                    click: () => { try { item.handler(text); } catch (error) { console.error("[Extensions] Menu:", error.message); } }
                });
            }
        }
        if (!items.length) return; // sem itens de extensão, o comportamento do navegador não muda
        const win = this.getWindow();
        Menu.buildFromTemplate([
            { label: "Copiar", click: () => webContents.copy() },
            { type: "separator" },
            ...items
        ]).popup({ window: win && !win.isDestroyed() ? win : undefined });
    }

    refreshWeb() {
        for (const wc of this.getWebContents()) this.applyToWeb(wc);
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
