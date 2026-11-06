const fs = require("fs");
const path = require("path");

class ExtensionStorage {
    constructor(basePath) {
        this.basePath = basePath;
        fs.mkdirSync(basePath, { recursive: true });
    }
    file(id) { return path.join(this.basePath, `${id}.json`); }
    get(id) {
        try { return JSON.parse(fs.readFileSync(this.file(id), "utf8")); } catch { return {}; }
    }
    set(id, data) {
        fs.writeFileSync(this.file(id), JSON.stringify(data, null, 2), "utf8");
    }
}
module.exports = ExtensionStorage;
