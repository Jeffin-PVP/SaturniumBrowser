// =====================================================
// SearchManager - SaturniumBrowser 1.1.3
//
// Provedor principal: Bing Search RSS.
//
// O mecanismo antigo dependia do HTML público do
// DuckDuckGo (html.duckduckgo.com). Esse endpoint pode
// responder com desafios anti-bot em vez dos resultados.
//
// Aqui consumimos um feed RSS de busca, sem depender do
// HTML da página de resultados do DuckDuckGo.
//
// Retorno padronizado:
//   { title, url, snippet }
// =====================================================

const { net } = require("electron");

const SEARCH_ENDPOINT =
    "https://www.bing.com/search";

const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/124.0.0.0 Safari/537.36 " +
    "SaturniumBrowser/1.1.3";


class SearchManager {

    // ==========================================
    // BUSCAR
    // ==========================================

    async search(query) {

        const trimmed =
            String(query || "").trim();


        if (!trimmed) {

            return [];
        }


        // Provedores em ordem. Cada um só é aceito se os
        // resultados tiverem relação com o que foi buscado.
        const providers = [
            ["Bing RSS",  () => this.searchBingRss(trimmed)],
            ["Mojeek",    () => this.searchMojeek(trimmed)],
            ["Bing HTML", () => this.searchBingHtml(trimmed)]
        ];

        let networkError = null;

        for (const [name, run] of providers) {

            try {

                const results = await run();

                if (!results.length) {

                    console.warn(`[Search] ${name}: sem resultados reconhecíveis.`);

                    continue;
                }

                if (!this.looksRelevant(trimmed, results)) {

                    console.warn(
                        `[Search] ${name}: resultados sem relação com "${trimmed}" (ex.: ${results[0].url}). Descartado.`
                    );

                    continue;
                }

                return results;

            } catch (error) {

                console.warn(`[Search] ${name} falhou:`, error?.message || error);

                if (
                    !networkError &&
                    (error?.code === "SEARCH_NETWORK_ERROR" ||
                     error?.code === "SEARCH_HTTP_ERROR")
                ) {
                    networkError = error;
                }
            }
        }

        if (networkError) {

            throw networkError;
        }

        const error =
            new Error(
                "O provedor de busca não retornou resultados reconhecíveis."
            );

        error.code = "SEARCH_EMPTY";

        throw error;

    }


    // ==========================================
    // PROVEDORES
    // ==========================================

    async searchBingRss(query) {

        const params =
            new URLSearchParams({
                format: "rss",
                q: query
            });

        const xml =
            await this.fetchText(
                `${SEARCH_ENDPOINT}?${params.toString()}`,
                "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8"
            );

        return this.parseRSS(xml);

    }

    async searchBingHtml(query) {

        const params =
            new URLSearchParams({
                q: query,
                setlang: "pt-BR"
            });

        const html =
            await this.fetchText(
                `${SEARCH_ENDPOINT}?${params.toString()}`,
                "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8"
            );

        return this.parseBingHtml(html);

    }

    async searchMojeek(query) {

        const params =
            new URLSearchParams({
                q: query,
                lb: "pt"
            });

        const html =
            await this.fetchText(
                `https://www.mojeek.com/search?${params.toString()}`,
                "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8"
            );

        return this.parseMojeek(html);

    }

    parseMojeek(html) {

        const results = [];

        if (!html || typeof html !== "string") return results;

        const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;

        let m;

        while ((m = liRegex.exec(html)) !== null) {

            const block = m[1];

            const link =
                /<a[^>]*class="[^"]*\btitle\b[^"]*"[^>]*\shref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(block) ||
                /<a[^>]*\shref="([^"]+)"[^>]*class="[^"]*\btitle\b[^"]*"[^>]*>([\s\S]*?)<\/a>/i.exec(block);

            if (!link) continue;

            const url = this.decodeEntities(link[1]);

            if (!this.isHttp(url)) continue;

            const snip =
                /<p[^>]*class="[^"]*\bs\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i.exec(block);

            results.push({
                title: this.stripTagsAndDecode(link[2]) || url,
                url,
                snippet: snip ? this.stripTagsAndDecode(snip[1]) : ""
            });

            if (results.length >= 20) break;
        }

        return results;

    }


    // ==========================================
    // RELEVÂNCIA: pelo menos um termo da busca
    // aparece em algum resultado (sem acento).
    // Evita mostrar resultados aleatórios.
    // ==========================================

    looksRelevant(query, results) {

        const fold = (t) =>
            String(t || "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase();

        const terms =
            fold(query)
                .split(/[^a-z0-9]+/)
                .filter((t) => t.length >= 3);

        if (!terms.length) return true;

        return results.some((r) => {

            const hay = fold(`${r.title} ${r.snippet} ${r.url}`);

            return terms.some((t) => hay.includes(t));
        });

    }


    // ==========================================
    // PLANO B: HTML do Bing (li.b_algo)
    // ==========================================

    parseBingHtml(html) {

        const results = [];

        if (!html || typeof html !== "string") return results;

        const blockRegex =
            /<li\s+class="b_algo[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;

        let m;

        while ((m = blockRegex.exec(html)) !== null) {

            const block = m[1];

            const link =
                /<h2[^>]*>\s*<a[^>]*\shref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(block);

            if (!link) continue;

            const url =
                this.unwrapBingUrl(this.decodeEntities(link[1]));

            if (!this.isHttp(url)) continue;

            const snip =
                /<p[^>]*>([\s\S]*?)<\/p>/i.exec(block);

            results.push({
                title: this.stripTagsAndDecode(link[2]) || url,
                url,
                snippet: snip ? this.stripTagsAndDecode(snip[1]) : ""
            });

            if (results.length >= 20) break;
        }

        return results;

    }

    // Links do Bing às vezes vêm como bing.com/ck/a?...&u=a1<base64>
    unwrapBingUrl(url) {

        try {

            const parsed = new URL(url);

            if (/(^|\.)bing\.com$/i.test(parsed.hostname) && parsed.pathname.startsWith("/ck/")) {

                const u = parsed.searchParams.get("u") || "";

                if (u.startsWith("a1")) {

                    const decoded =
                        Buffer.from(
                            u.slice(2).replace(/-/g, "+").replace(/_/g, "/"),
                            "base64"
                        ).toString("utf8");

                    if (this.isHttp(decoded)) return decoded;
                }
            }

        } catch (e) {}

        return url;

    }


    // ==========================================
    // PARSER RSS
    // ==========================================

    parseRSS(xml) {

        const results = [];


        if (!xml || typeof xml !== "string") {

            return results;
        }


        const itemRegex =
            /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi;


        let itemMatch;


        while (
            (itemMatch = itemRegex.exec(xml)) !== null
        ) {

            const item =
                itemMatch[1];


            const title =
                this.getTagValue(item, "title");

            const link =
                this.getTagValue(item, "link");

            const description =
                this.getTagValue(item, "description");


            if (!link) {

                continue;
            }


            let realUrl =
                this.decodeEntities(link).trim();


            // RSS pode retornar CDATA ou caracteres escapados.
            realUrl =
                realUrl
                    .replace(/^<!\[CDATA\[/i, "")
                    .replace(/\]\]>$/i, "")
                    .trim();


            try {

                realUrl =
                    new URL(realUrl).toString();

            } catch {

                continue;
            }


            const cleanTitle =
                this.stripTagsAndDecode(
                    title
                );

            const cleanSnippet =
                this.stripTagsAndDecode(
                    description
                );


            results.push({

                title:
                    cleanTitle || realUrl,

                url:
                    realUrl,

                snippet:
                    cleanSnippet

            });


            // Mantém a interface original simples e rápida.
            if (results.length >= 10) {

                break;
            }

        }


        return results;

    }


    // ==========================================
    // HTTP GENÉRICO (texto)
    // ==========================================

    async fetchText(url, accept, extraHeaders = {}) {

        let response;

        try {

            response =
                await net.fetch(url, {

                    method: "GET",

                    credentials: "omit",

                    headers: {
                        "User-Agent": USER_AGENT,
                        "Accept": accept || "*/*",
                        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
                        "Cache-Control": "no-cache",
                        ...extraHeaders
                    }

                });

        } catch (error) {

            const wrapped =
                new Error(
                    `Não foi possível acessar o provedor de busca: ${error?.message || "erro de rede"}`
                );

            wrapped.code = "SEARCH_NETWORK_ERROR";

            throw wrapped;

        }

        if (!response.ok) {

            const error =
                new Error(
                    `O provedor de busca respondeu HTTP ${response.status}.`
                );

            error.code = "SEARCH_HTTP_ERROR";
            error.status = response.status;

            throw error;

        }

        return response.text();

    }


    // ==========================================
    // DISPATCH POR ABA (tudo, imagens, vídeos...)
    // ==========================================

    async searchByType(type, query) {

        switch (type) {

            case "images":
                return this.searchImages(query);

            case "videos":
                return this.searchVideos(query);

            case "news":
                return this.searchNews(query);

            case "maps":
                return this.searchMaps(query);

            default:
                return this.search(query);
        }

    }


    // ==========================================
    // IMAGENS (Bing images async — HTML parcial)
    // ==========================================

    async searchImages(query) {

        const trimmed = String(query || "").trim();

        if (!trimmed) return [];

        const params =
            new URLSearchParams({
                q: trimmed,
                first: "0",
                count: "42",
                mmasync: "1",
                setlang: "pt-BR"
            });

        const html =
            await this.fetchText(
                `https://www.bing.com/images/async?${params.toString()}`,
                "text/html,*/*"
            );

        const items = [];
        const seen = new Set();

        for (const data of this.extractJsonAttributes(html, ["m"])) {

            const full = data.murl;
            const thumb = data.turl || data.murl;
            const page = data.purl;

            if (!this.isHttp(thumb) || !this.isHttp(page)) continue;

            if (seen.has(thumb)) continue;
            seen.add(thumb);

            items.push({
                title: this.stripTagsAndDecode(data.t || data.desc || ""),
                thumb,
                full: this.isHttp(full) ? full : thumb,
                url: page
            });

            if (items.length >= 40) break;
        }

        if (!items.length) {

            const error =
                new Error("Nenhuma imagem reconhecida na resposta.");

            error.code = "SEARCH_EMPTY";

            throw error;
        }

        return items;

    }


    // ==========================================
    // VÍDEOS
    // 1) Bing videos async (HTML parcial)
    // 2) Fallback: busca web restrita a sites de
    //    vídeo (RSS, mais estável) + miniatura do
    //    YouTube quando o link é do YouTube.
    // ==========================================

    async searchVideos(query) {

        const trimmed = String(query || "").trim();

        if (!trimmed) return [];

        let items = [];

        try {

            const params =
                new URLSearchParams({
                    q: trimmed,
                    async: "content",
                    first: "0",
                    count: "30",
                    setlang: "pt-BR"
                });

            const html =
                await this.fetchText(
                    `https://www.bing.com/videos/asyncv2?${params.toString()}`,
                    "text/html,*/*"
                );

            const seen = new Set();

            for (const data of this.extractJsonAttributes(html, ["vrhm", "m"])) {

                const page = data.pgurl || data.purl || data.murl;
                const thumb = data.turl || "";

                if (!this.isHttp(page) || seen.has(page)) continue;
                seen.add(page);

                items.push({
                    title: this.stripTagsAndDecode(data.vt || data.t || data.name || ""),
                    thumb: this.isHttp(thumb) ? thumb : this.youtubeThumb(page),
                    url: page,
                    duration: data.du || data.dur || "",
                    source: this.hostOf(page)
                });

                if (items.length >= 24) break;
            }

        } catch (error) {

            items = [];
        }

        if (items.length) return items;


        const fallback =
            await this.search(
                `${trimmed} (site:youtube.com OR site:vimeo.com OR site:dailymotion.com OR site:tiktok.com)`
            );

        return fallback.map((r) => ({
            title: r.title,
            thumb: this.youtubeThumb(r.url),
            url: r.url,
            duration: "",
            source: this.hostOf(r.url),
            snippet: r.snippet
        }));

    }


    // ==========================================
    // NOTÍCIAS (Bing News RSS)
    // ==========================================

    async searchNews(query) {

        const trimmed = String(query || "").trim();

        if (!trimmed) return [];

        const params =
            new URLSearchParams({
                q: trimmed,
                format: "rss",
                setlang: "pt-BR",
                cc: "BR"
            });

        const xml =
            await this.fetchText(
                `https://www.bing.com/news/search?${params.toString()}`,
                "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8"
            );

        const items = [];

        const itemRegex =
            /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi;

        let m;

        while ((m = itemRegex.exec(xml)) !== null) {

            const block = m[1];

            let link =
                this.decodeEntities(this.getTagValue(block, "link")).trim();

            // Os links do Bing News passam por apiclick.aspx?...&url=REAL
            try {

                const parsed = new URL(link);

                const real = parsed.searchParams.get("url");

                if (real) link = real;

            } catch (e) {}

            if (!this.isHttp(link)) continue;

            const image =
                this.decodeEntities(this.getTagValue(block, "News:Image")).trim();

            items.push({
                title: this.stripTagsAndDecode(this.getTagValue(block, "title")) || link,
                url: link,
                snippet: this.stripTagsAndDecode(this.getTagValue(block, "description")),
                source: this.stripTagsAndDecode(this.getTagValue(block, "News:Source")) || this.hostOf(link),
                date: this.getTagValue(block, "pubDate"),
                image: this.isHttp(image) ? image : ""
            });

            if (items.length >= 20) break;
        }

        if (!items.length) {

            const error =
                new Error("O provedor de notícias não retornou resultados.");

            error.code = "SEARCH_EMPTY";

            throw error;
        }

        return items;

    }


    // ==========================================
    // MAPS (OpenStreetMap / Nominatim)
    // ==========================================

    async searchMaps(query) {

        const trimmed = String(query || "").trim();

        if (!trimmed) return [];

        const params =
            new URLSearchParams({
                q: trimmed,
                format: "jsonv2",
                limit: "8",
                addressdetails: "1",
                "accept-language": "pt-BR"
            });

        const text =
            await this.fetchText(
                `https://nominatim.openstreetmap.org/search?${params.toString()}`,
                "application/json"
            );

        let data;

        try {
            data = JSON.parse(text);
        } catch (e) {
            data = [];
        }

        const places = [];

        for (const p of Array.isArray(data) ? data : []) {

            const lat = Number(p.lat);
            const lon = Number(p.lon);

            if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

            const bb = Array.isArray(p.boundingbox) ? p.boundingbox.map(Number) : [];

            places.push({
                name: p.name || String(p.display_name || "").split(",")[0] || trimmed,
                address: p.display_name || "",
                category: p.type || p.category || "",
                lat,
                lon,
                // [sul, norte, oeste, leste] -> bbox do OSM: oeste,sul,leste,norte
                bbox: bb.length === 4 && bb.every(Number.isFinite)
                    ? [bb[2], bb[0], bb[3], bb[1]]
                    : null
            });
        }

        if (!places.length) {

            const error =
                new Error("Nenhum lugar encontrado.");

            error.code = "SEARCH_EMPTY";

            throw error;
        }

        return places;

    }


    // ==========================================
    // AUXILIARES
    // ==========================================

    isHttp(value) {

        try {

            const u = new URL(String(value || ""));

            return u.protocol === "http:" || u.protocol === "https:";

        } catch (e) {

            return false;
        }

    }

    hostOf(value) {

        try {

            return new URL(value).hostname.replace(/^www\./, "");

        } catch (e) {

            return "";
        }

    }

    youtubeThumb(url) {

        try {

            const u = new URL(url);

            let id = "";

            if (/(^|\.)youtube\.com$/i.test(u.hostname)) {

                id = u.searchParams.get("v") || "";

                if (!id) {
                    const m = /^\/(?:shorts|embed|live)\/([\w-]{6,})/.exec(u.pathname);
                    if (m) id = m[1];
                }

            } else if (/(^|\.)youtu\.be$/i.test(u.hostname)) {

                id = u.pathname.replace(/^\//, "").split("/")[0];
            }

            return /^[\w-]{6,}$/.test(id)
                ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
                : "";

        } catch (e) {

            return "";
        }

    }

    // Lê atributos HTML com JSON (ex.: m="{&quot;murl&quot;:...}")
    extractJsonAttributes(html, names) {

        const out = [];

        if (!html || typeof html !== "string") return out;

        const re =
            new RegExp(
                `\\s(?:${names.join("|")})\\s*=\\s*(?:"(\\{[^"]*\\})"|'(\\{[^']*\\})')`,
                "g"
            );

        let m;

        while ((m = re.exec(html)) !== null) {

            const raw = this.decodeEntities(m[1] || m[2] || "");

            try {

                const data = JSON.parse(raw);

                if (data && typeof data === "object") out.push(data);

            } catch (e) {}
        }

        return out;

    }


    // ==========================================
    // LER TAG XML SIMPLES
    // ==========================================

    getTagValue(xml, tagName) {

        const regex =
            new RegExp(
                `<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`,
                "i"
            );


        const match =
            regex.exec(xml);


        if (!match) {

            return "";
        }


        return match[1]
            .trim()
            .replace(/^<!\[CDATA\[/i, "")
            .replace(/\]\]>$/i, "")
            .trim();

    }


    // ==========================================
    // LIMPAR HTML + ENTIDADES XML/HTML
    // ==========================================

    stripTagsAndDecode(value) {

        return this.decodeEntities(
            String(value || "")
                .replace(/<[^>]*>/g, " ")
                .replace(/\s+/g, " ")
                .trim()
        );

    }


    decodeEntities(text) {

        return String(text || "")

            .replace(/&nbsp;/gi, " ")
            .replace(/&ndash;/gi, "–")
            .replace(/&mdash;/gi, "—")
            .replace(/&hellip;/gi, "…")
            .replace(/&middot;/gi, "·")
            .replace(/&amp;/gi, "&")
            .replace(/&lt;/gi, "<")
            .replace(/&gt;/gi, ">")
            .replace(/&quot;/gi, '"')
            .replace(/&apos;/gi, "'")
            .replace(/&#0?39;/gi, "'")
            .replace(/&#x27;/gi, "'")
            .replace(/&#x2f;/gi, "/")
            .replace(/&#x2F;/g, "/")
            .replace(/&#(\d+);/g, (full, value) => {

                const code =
                    Number(value);

                if (!Number.isFinite(code)) {
                    return full;
                }

                try {
                    return String.fromCodePoint(code);
                } catch {
                    return full;
                }

            })
            .replace(/&#x([0-9a-f]+);/gi, (full, hex) => {

                const code =
                    parseInt(hex, 16);

                if (!Number.isFinite(code)) {
                    return full;
                }

                try {
                    return String.fromCodePoint(code);
                } catch {
                    return full;
                }

            })
            .replace(/&nbsp;/gi, " ");

    }

}


module.exports = SearchManager;
