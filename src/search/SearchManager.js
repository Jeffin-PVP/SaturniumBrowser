// =====================================================
// SearchManager
//
// Busca resultados por trás dos panos (via o endpoint
// HTML público do DuckDuckGo, sem chave de API) e devolve
// uma lista simples de { title, url, snippet }.
//
// O SaturniumBrowser desenha esses resultados com sua própria
// interface (saturnium://search) — o usuário nunca visita o
// site de busca de terceiros diretamente.
// =====================================================

const ENDPOINT =
    "https://html.duckduckgo.com/html/";

const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/124.0.0.0 Safari/537.36";


class SearchManager {

    // ==========================================
    // BUSCAR
    // ==========================================

    async search(query) {

        const trimmed =
            (query || "").trim();


        if (!trimmed) {

            return [];
        }


        const url =
            `${ENDPOINT}?q=${encodeURIComponent(trimmed)}`;


        const response =
            await fetch(url, {

                method: "GET",

                headers: {

                    "User-Agent": USER_AGENT,

                    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8"

                }

            });


        if (!response.ok) {

            throw new Error(
                `Busca falhou com status ${response.status}`
            );

        }


        const html =
            await response.text();


        return this.parseResults(html);

    }


    // ==========================================
    // EXTRAIR OS RESULTADOS DO HTML
    // ==========================================

    parseResults(html) {

        const results = [];


        const resultRegex =
            /<a rel="nofollow" class="result__a" href="([^"]+)">([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;


        let match;

        while (
            (match = resultRegex.exec(html)) !== null
        ) {

            const realUrl =
                this.extractRealUrl(
                    match[1]
                );


            if (!realUrl) {

                continue;
            }


            const title =
                this.stripTags(
                    match[2]
                );

            const snippet =
                this.stripTags(
                    match[3]
                );


            results.push({

                title:
                    title || realUrl,

                url: realUrl,

                snippet

            });

        }


        return results;

    }


    // ==========================================
    // DECODIFICAR A URL REAL
    // (o DuckDuckGo envolve os links num
    // redirecionador próprio: /l/?uddg=...)
    // ==========================================

    extractRealUrl(href) {

        try {

            const full =
                href.startsWith("//")
                    ? "https:" + href
                    : href;

            const parsed =
                new URL(full);

            const wrapped =
                parsed.searchParams.get("uddg");


            if (wrapped) {

                return decodeURIComponent(
                    wrapped
                );

            }


            return full;

        } catch (error) {

            return null;

        }

    }


    // ==========================================
    // LIMPAR TAGS HTML E DECODIFICAR ENTIDADES
    // ==========================================

    stripTags(html) {

        const withoutTags =
            html.replace(
                /<[^>]*>/g,
                ""
            );


        return this.decodeEntities(
            withoutTags
        ).trim();

    }


    decodeEntities(text) {

        return text

            .replace(/&amp;/g, "&")

            .replace(/&lt;/g, "<")

            .replace(/&gt;/g, ">")

            .replace(/&quot;/g, "\"")

            .replace(/&#0?39;/g, "'")

            .replace(/&#x27;/g, "'")

            .replace(/&#x2f;/gi, "/")

            .replace(/&nbsp;/g, " ");

    }

}


module.exports = SearchManager;
