class ExtensionPermissions {
    static allowed = new Set([
        "storage",
        "theme.apply",
        "newtab.wallpaper",
        "sounds.play",
        "cursor.change",
        "tabs.read",
        "page.content",
        "pages.style",
        "pages.zoom",
        "pages.pip",
        "pages.autofill",
        "clipboard.write",
        "network.fetch",
        "contextmenu.add",
        "ui.openpage"
    ]);
    static sanitize(list = []) {
        if (!Array.isArray(list)) return [];
        return list.filter(p => typeof p === "string" && this.allowed.has(p));
    }
    static isAllowed(permission) { return this.allowed.has(permission); }
}
module.exports = ExtensionPermissions;
