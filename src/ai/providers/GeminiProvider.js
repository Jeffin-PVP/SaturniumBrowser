class GeminiProvider {
    constructor(config, net) { this.config = config; this.net = net; }

    async chat(messages, options = {}) {
        if (!this.config.apiKey) throw new Error("API_KEY_REQUIRED");
        const model = options.model || this.config.model;
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(this.config.apiKey)}`;
        const system = messages.find(m => m.role === "system");
        const contents = messages.filter(m => m.role !== "system").map(m => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }]
        }));
        if (system) contents.unshift({ role: "user", parts: [{ text: `System instructions:\n${system.content}` }] });
        let response;
        try {
            response = await this.net.fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify({ contents, generationConfig: { temperature: options.temperature ?? 0.3, maxOutputTokens: options.maxTokens ?? 1200 } }),
                signal: options.signal
            });
        } catch (error) {
            if (error.name === "AbortError") throw new Error("AI_REQUEST_CANCELLED");
            throw new Error(`AI_NETWORK_ERROR: ${error.message}`);
        }
        const text = await response.text();
        if (!response.ok) throw new Error(`AI_HTTP_${response.status}: ${text.slice(0, 500)}`);
        let data;
        try { data = JSON.parse(text); } catch { throw new Error("AI_INVALID_JSON"); }
        const content = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("").trim();
        if (!content) throw new Error("AI_EMPTY_RESPONSE");
        return { content, provider: "gemini", model };
    }

    async testConnection(options = {}) {
        const result = await this.chat([{ role: "user", content: "Responda apenas: OK" }], { ...options, maxTokens: 10, temperature: 0 });
        return { ok: true, ...result };
    }
}
GeminiProvider.id = "gemini";
module.exports = GeminiProvider;
