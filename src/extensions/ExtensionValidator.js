const fs = require("fs");
const path = require("path");

class ExtensionValidator {
    static validateManifest(manifest) {
        if (!manifest || typeof manifest !== "object") throw new Error("Manifest inválido.");
        const required = ["name", "id", "version", "main"];
        for (const key of required) {
            if (typeof manifest[key] !== "string" || !manifest[key].trim()) throw new Error(`Manifest sem ${key}.`);
        }
        if (!/^[a-z0-9._-]+$/i.test(manifest.id)) throw new Error("ID de extensão inválido.");
        if (manifest.permissions && !Array.isArray(manifest.permissions)) throw new Error("permissions deve ser uma lista.");
        if (manifest.hosts !== undefined) {
            if (!Array.isArray(manifest.hosts) || manifest.hosts.length > 10 ||
                !manifest.hosts.every(h => typeof h === "string" && /^[a-z0-9.-]{3,253}$/i.test(h))) {
                throw new Error("hosts inválido.");
            }
        }
        return true;
    }

    static readManifest(extensionPath) {
        const file = path.join(extensionPath, "manifest.json");
        if (!fs.existsSync(file)) throw new Error("manifest.json não encontrado.");
        const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
        this.validateManifest(manifest);
        return manifest;
    }
}
module.exports = ExtensionValidator;
