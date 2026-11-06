class ExtensionAPI {
    constructor({ id, permissions, storage, host }) {
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
