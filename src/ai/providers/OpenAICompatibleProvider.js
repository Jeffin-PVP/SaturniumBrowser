class OpenAICompatibleProvider {
    constructor(config, net) {
        this.config = config;
        this.net = net;
    }

    async request(body, signal) {
        const headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        };
        if (this.config.apiKey) headers.Authorization = `Bearer ${this.config.apiKey}`;

        let response;
        try {
            response = await this.net.fetch(this.config.endpoint, {
                method: "POST",
                headers,
                body: JSON.stringify(body),
                signal
            });
        } catch (error) {
            if (error.name === "AbortError") throw new Error("AI_REQUEST_CANCELLED");
            throw new Error(`AI_NETWORK_ERROR: ${error.message}`);
        }

        const text = await response.text();
        if (!response.ok) throw new Error(`AI_HTTP_${response.status}: ${text.slice(0, 500)}`);
        let data;
        try { data = JSON.parse(text); } catch { throw new Error("AI_INVALID_JSON"); }
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content !== "string" || !content.trim()) throw new Error("AI_EMPTY_RESPONSE");
        return { content: content.trim(), provider: this.constructor.id || "openai-compatible", model: body.model || "" };
    }

    async chat(messages, options = {}) {
        return this.request({
            model: options.model || this.config.model,
            messages,
            temperature: options.temperature ?? 0.3,
            max_tokens: options.maxTokens ?? 1200
        }, options.signal);
    }

    async testConnection(options = {}) {
        const result = await this.chat([
            { role: "user", content: "Responda apenas: OK" }
        ], { ...options, maxTokens: 10, temperature: 0 });
        return { ok: true, ...result };
    }
}
module.exports = OpenAICompatibleProvider;
