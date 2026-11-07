class ExtensionAPI {
    constructor({ id, permissions, storage, host, hosts }) {
        this.allowedHosts = Array.isArray(hosts) ? hosts.map(h => String(h).toLowerCase()) : [];
        this.id = id;
        this.permissions = new Set(permissions);
        this.storage = storage;
        this.host = host;
    }

    require(permission) {
        if (!this.permissions.has(permission)) throw new Error(`Permissão negada: ${permission}`);
    }

    get storageAPI() {
        this.require("storage");
        return {
            get: () => this.storage.get(this.id),
            set: data => this.storage.set(this.id, data)
        };
    }

    // Permissão: theme.apply
    get theme() {
        this.require("theme.apply");
        return {
            apply: vars => this.host.setTheme(this.id, vars),
            clear: () => this.host.setTheme(this.id, {})
        };
    }

    // Permissão: pages.style (presets visuais fixos em páginas web; nunca CSS cru)
    get pages() {
        this.require("pages.style");
        return {
            setStyle: config => this.host.setPageStyle(this.id, config),
            clearStyle: () => this.host.setPageStyle(this.id, null)
        };
    }

    // Permissão: pages.zoom (zoom por site)
    get zoom() {
        this.require("pages.zoom");
        return {
            set: hosts => this.host.setZoom(this.id, hosts),
            clear: () => this.host.setZoom(this.id, null)
        };
    }

    // Permissão: pages.pip (botão Miniplayer + Alt+P nos sites informados)
    get pip() {
        this.require("pages.pip");
        return {
            enable: config => this.host.setPip(this.id, config),
            disable: () => this.host.setPip(this.id, null)
        };
    }

    // Permissão: pages.autofill (o host confere o domínio da aba antes de preencher)
    get autofill() {
        this.require("pages.autofill");
        return { fill: data => this.host.fillLogin(this.id, data) };
    }

    // Permissão: clipboard.write
    get clipboard() {
        this.require("clipboard.write");
        return { writeText: (text, options) => this.host.copyText(text, options) };
    }

    // Permissão: network.fetch (somente https e domínios listados em "hosts" no manifest)
    get network() {
        this.require("network.fetch");
        return { getJSON: url => this.host.fetchJSON(url, this.allowedHosts) };
    }

    // Permissão: contextmenu.add (item no menu de botão direito quando há texto selecionado)
    get contextMenu() {
        this.require("contextmenu.add");
        return { addSelectionItem: item => this.host.addContextItem(this.id, item) };
    }

    // Permissão: ui.openpage (abre a página de configurações da própria extensão)
    get ui() {
        this.require("ui.openpage");
        return { openPage: query => this.host.openPage(this.id, query) };
    }

    // Permissão: tabs.read (somente o domínio da aba ativa)
    get tabs() {
        this.require("tabs.read");
        return { activeHost: () => this.host.activeHost() };
    }

    // Permissão: newtab.wallpaper
    get newtab() {
        this.require("newtab.wallpaper");
        return {
            setWallpaper: wallpaper => this.host.setWallpaper(this.id, wallpaper),
            clearWallpaper: () => this.host.setWallpaper(this.id, null),
            pickImage: () => this.host.pickImage()
        };
    }
}
module.exports = ExtensionAPI;
