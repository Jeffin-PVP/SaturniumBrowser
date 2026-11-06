const fs = require("fs");
const path = require("path");
const { app, safeStorage, net } = require("electron");

const LlamaCppProvider = require("./providers/LlamaCppProvider");
const OllamaProvider = require("./providers/OllamaProvider");
const GroqProvider = require("./providers/GroqProvider");
const OpenAIProvider = require("./providers/OpenAIProvider");
const GeminiProvider = require("./providers/GeminiProvider");
const CustomProvider = require("./providers/CustomProvider");

const DEFAULTS = {
    activeProvider: "llama.cpp",
    providers: {
        "llama.cpp": {
            endpoint: "http://127.0.0.1:8080/v1/chat/completions",
            model: "local-model"
        },
        ollama: {
            endpoint: "http://127.0.0.1:11434/v1/chat/completions",
            model: "llama3.2"
        },
        groq: {
            endpoint: "https://api.groq.com/openai/v1/chat/completions",
            model: "llama-3.3-70b-versatile"
        },
        openai: {
            endpoint: "https://api.openai.com/v1/chat/completions",
            model: "gpt-4o-mini"
        },
        gemini: {
            model: "gemini-2.5-flash"
        },
        custom: {
            endpoint: "https://example.com/v1/chat/completions",
            model: "custom-model"
        }
    }
};

class AIManager {
    constructor() {
        this.configDir = path.join(app.getPath("userData"), "ai");
        this.configPath = path.join(this.configDir, "config.json");
        this.config = this.loadConfig();
        this.activeRequests = new Set();
    }

    loadConfig() {
        fs.mkdirSync(this.configDir, { recursive: true });
        try {
            const saved = JSON.parse(fs.readFileSync(this.configPath, "utf8"));
            return this.mergeConfig(saved);
        } catch {
            return this.mergeConfig({});
        }
    }

    mergeConfig(saved) {
        const merged = {
            activeProvider: saved.activeProvider || DEFAULTS.activeProvider,
            providers: {}
        };
        for (const [id, defaults] of Object.entries(DEFAULTS.providers)) {
            merged.providers[id] = {
                ...defaults,
                ...(saved.providers && saved.providers[id] ? saved.providers[id] : {})
            };
        }
        return merged;
    }

    persist() {
        fs.mkdirSync(this.configDir, { recursive: true });
        fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), "utf8");
    }

    encryptKey(key) {
        if (!key) return "";
        if (!safeStorage.isEncryptionAvailable()) {
            throw new Error("ENCRYPTION_UNAVAILABLE");
        }
        return safeStorage.encryptString(key).toString("base64");
    }

    decryptKey(value) {
        if (!value) return "";
        if (!safeStorage.isEncryptionAvailable()) {
            throw new Error("ENCRYPTION_UNAVAILABLE");
        }
        return safeStorage.decryptString(Buffer.from(value, "base64"));
    }

    publicConfig() {
        const providers = {};
        for (const [id, cfg] of Object.entries(this.config.providers)) {
            providers[id] = {
                endpoint: cfg.endpoint || "",
                model: cfg.model || "",
                hasApiKey: !!cfg.apiKey
            };
        }
        return {
            activeProvider: this.config.activeProvider,
            providers
        };
    }

    saveConfig(input) {
        if (!input || typeof input !== "object") throw new Error("INVALID_CONFIG");
        const active = String(input.activeProvider || "").trim();
        if (!DEFAULTS.providers[active]) throw new Error("UNKNOWN_PROVIDER");

        const incoming = input.providers || {};
        for (const id of Object.keys(DEFAULTS.providers)) {
            const current = this.config.providers[id] || {};
            const next = incoming[id] || {};
            const cfg = {
                endpoint: typeof next.endpoint === "string" ? next.endpoint.trim() : (current.endpoint || ""),
                model: typeof next.model === "string" ? next.model.trim() : (current.model || "")
            };
            if (typeof next.apiKey === "string") {
                const key = next.apiKey.trim();
                if (key) cfg.apiKey = this.encryptKey(key);
                else if (current.apiKey) cfg.apiKey = current.apiKey;
            } else if (current.apiKey) {
                cfg.apiKey = current.apiKey;
            }
            this.validateEndpoint(id, cfg.endpoint);
            this.config.providers[id] = cfg;
        }

        this.config.activeProvider = active;
        this.persist();
        return this.publicConfig();
    }

    validateEndpoint(provider, endpoint) {
        if (["gemini"].includes(provider)) return;
        if (!endpoint) throw new Error("ENDPOINT_REQUIRED");
        let url;
        try { url = new URL(endpoint); } catch { throw new Error("INVALID_ENDPOINT"); }
        const host = (url.hostname || "").toLowerCase();
        const local = host === "localhost" || host === "127.0.0.1" || host === "::1";
        if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
            throw new Error("INSECURE_ENDPOINT");
        }
    }

    getProviderConfig(id) {
        const cfg = this.config.providers[id];
        if (!cfg) throw new Error("UNKNOWN_PROVIDER");
        return {
            ...cfg,
            apiKey: cfg.apiKey ? this.decryptKey(cfg.apiKey) : ""
        };
    }

    createProvider(id) {
        const cfg = this.getProviderConfig(id);
        switch (id) {
            case "llama.cpp": return new LlamaCppProvider(cfg, net);
            case "ollama": return new OllamaProvider(cfg, net);
            case "groq": return new GroqProvider(cfg, net);
            case "openai": return new OpenAIProvider(cfg, net);
            case "gemini": return new GeminiProvider(cfg, net);
            case "custom": return new CustomProvider(cfg, net);
            default: throw new Error("UNKNOWN_PROVIDER");
        }
    }

    validateMessages(messages) {
        if (!Array.isArray(messages) || messages.length < 1 || messages.length > 40) {
            throw new Error("INVALID_MESSAGES");
        }
        return messages.map(message => {
            if (!message || !["system", "user", "assistant"].includes(message.role)) {
                throw new Error("INVALID_MESSAGE_ROLE");
            }
            const content = String(message.content || "").trim();
            if (!content || content.length > 12000) throw new Error("INVALID_MESSAGE_CONTENT");
            return { role: message.role, content };
        });
    }

    async chat(messages, options = {}) {
        const cleanMessages = this.validateMessages(messages);
        const providerId = String(options.provider || this.config.activeProvider);
        if (!DEFAULTS.providers[providerId]) throw new Error("UNKNOWN_PROVIDER");
        const provider = this.createProvider(providerId);
        const controller = new AbortController();
        this.activeRequests.add(controller);
        try {
            return await provider.chat(cleanMessages, {
                model: options.model || this.config.providers[providerId].model,
                temperature: Number.isFinite(options.temperature) ? Math.max(0, Math.min(1, options.temperature)) : 0.3,
                maxTokens: Number.isInteger(options.maxTokens) ? Math.max(100, Math.min(4000, options.maxTokens)) : 1200,
                signal: controller.signal
            });
        } finally {
            this.activeRequests.delete(controller);
        }
    }

    async testConnection(providerId) {
        const id = String(providerId || this.config.activeProvider);
        const provider = this.createProvider(id);
        return provider.testConnection({ model: this.config.providers[id].model });
    }

    stopAll() {
        for (const controller of this.activeRequests) controller.abort();
        this.activeRequests.clear();
    }
}

module.exports = AIManager;
