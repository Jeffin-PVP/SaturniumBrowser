const path = require("path");
const ExtensionValidator = require("./ExtensionValidator");
const ExtensionPermissions = require("./ExtensionPermissions");
const ExtensionAPI = require("./ExtensionAPI");

class ExtensionLoader {
    constructor(storage, host) { this.storage = storage; this.host = host; }
    load(extensionPath) {
        const manifest = ExtensionValidator.readManifest(extensionPath);
        const permissions = ExtensionPermissions.sanitize(manifest.permissions);
        const api = new ExtensionAPI({ id: manifest.id, permissions, storage: this.storage, host: this.host, hosts: manifest.hosts || [] });
        let module = null;
        if (manifest.main) {
            const entry = path.join(extensionPath, manifest.main);
            // Extensões só são carregadas pelo ExtensionLoader; páginas web nunca recebem require.
            module = require(entry);
        }
        return { path: extensionPath, manifest, permissions, api, module };
    }
}
module.exports = ExtensionLoader;
