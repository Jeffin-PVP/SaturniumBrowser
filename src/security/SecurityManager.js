// =====================================================
// SecurityManager
//
// Verifica URLs contra listas públicas e gratuitas de
// phishing/malware conhecidos (URLhaus e OpenPhish, sem
// necessidade de chave de API) e aplica heurísticas
// próprias (punycode, imitação de marca, IP + login etc).
//
// Filosofia: "fail open" — se as listas não puderem ser
// baixadas (sem internet, serviço fora do ar), o navegador
// continua funcionando normalmente em vez de travar a
// navegação por causa de uma checagem de segurança.
// =====================================================

const fs = require("fs");
const path = require("path");
const { app } = require("electron");


const BLOCKLIST_SOURCES = [

    {
        name: "urlhaus",
        url: "https://urlhaus.abuse.ch/downloads/text_online/",
        category: "malware"
    },

    {
        name: "openphish",
        url: "https://openphish.com/feed.txt",
        category: "phishing"
    }

];


const DANGEROUS_EXTENSIONS = new Set([

    "exe", "scr", "bat", "cmd", "msi", "vbs", "js",
    "jar", "ps1", "com", "pif", "hta", "reg", "vbe",
    "wsf", "wsh", "msc", "apk", "jse", "lnk", "gadget"

]);


const KNOWN_BRANDS = [

    "paypal", "google", "microsoft", "apple", "amazon",
    "facebook", "instagram", "netflix", "whatsapp",
    "bancodobrasil", "caixa", "itau", "bradesco",
    "nubank", "mercadolivre", "outlook", "gov.br",
    "receita", "serasa"

];


const CACHE_TTL_MS =
    6 * 60 * 60 * 1000; // 6 horas


class SecurityManager {

    constructor() {

        this.dataDirectory =
            app.getPath("userData");

        this.cacheFile = path.join(
            this.dataDirectory,
            "security-blocklists.json"
        );


        this.maliciousHosts = new Set();

        this.maliciousUrls = new Set();

        this.lastUpdated = 0;


        // Bypass temporário ("continuar mesmo
        // assim"), válido só durante esta sessão.
        this.allowedHosts = new Set();


        this.loadCache();

        // Atualiza em segundo plano, sem bloquear
        // a inicialização do navegador.
        this.refreshBlocklists().catch(() => {});

    }


    // ==========================================
    // CACHE EM DISCO
    // ==========================================

    loadCache() {

        try {

            if (!fs.existsSync(this.cacheFile)) {

                return;
            }


            const raw =
                fs.readFileSync(
                    this.cacheFile,
                    "utf8"
                );

            const data =
                JSON.parse(raw);


            this.maliciousHosts =
                new Set(data.hosts || []);

            this.maliciousUrls =
                new Set(data.urls || []);

            this.lastUpdated =
                data.updatedAt || 0;

        } catch (error) {

            console.error(
                "[SecurityManager] Erro ao carregar cache de segurança:",
                error
            );

        }

    }


    saveCache() {

        try {

            if (!fs.existsSync(this.dataDirectory)) {

                fs.mkdirSync(
                    this.dataDirectory,
                    { recursive: true }
                );

            }


            fs.writeFileSync(
                this.cacheFile,
                JSON.stringify({

                    hosts: [...this.maliciousHosts],

                    urls: [...this.maliciousUrls],

                    updatedAt: this.lastUpdated

                }),
                "utf8"
            );

        } catch (error) {

            console.error(
                "[SecurityManager] Erro ao salvar cache de segurança:",
                error
            );

        }

    }


    // ==========================================
    // ATUALIZAR LISTAS PÚBLICAS
    // ==========================================

    async refreshBlocklists(force = false) {

        if (
            !force &&
            Date.now() - this.lastUpdated < CACHE_TTL_MS
        ) {

            return;
        }


        let anySuccess = false;


        for (const source of BLOCKLIST_SOURCES) {

            try {

                const response =
                    await fetch(source.url, {

                        headers: {
                            "User-Agent":
                                "SaturniumBrowser-Security/1.0"
                        }

                    });


                if (!response.ok) {

                    continue;
                }


                const text =
                    await response.text();

                this.parseList(text);

                anySuccess = true;

            } catch (error) {

                // Fail open: mantém a lista antiga
                // em cache e segue em frente.
                console.error(
                    `[SecurityManager] Falha ao baixar lista "${source.name}":`,
                    error.message
                );

            }

        }


        if (anySuccess) {

            this.lastUpdated = Date.now();

            this.saveCache();

        }

    }


    parseList(text) {

        const lines =
            text.split("\n");


        for (let line of lines) {

            line = line.trim();


            if (
                !line ||
                line.startsWith("#")
            ) {

                continue;
            }


            try {

                const withScheme =
                    line.includes("://")
                        ? line
                        : `http://${line}`;

                const parsed =
                    new URL(withScheme);


                this.maliciousUrls.add(line);

                this.maliciousHosts.add(
                    parsed.hostname.toLowerCase()
                );

            } catch (error) {

                continue;
            }

        }

    }


    // ==========================================
    // CHECAGEM PRINCIPAL DE UMA URL
    // ==========================================

    check(targetUrl) {

        let parsed;

        try {

            parsed = new URL(targetUrl);

        } catch (error) {

            return { blocked: false };
        }


        if (
            parsed.protocol !== "http:" &&
            parsed.protocol !== "https:"
        ) {

            return { blocked: false };
        }


        const host =
            parsed.hostname.toLowerCase();


        if (this.allowedHosts.has(host)) {

            return { blocked: false };
        }


        if (
            this.maliciousHosts.has(host) ||
            this.maliciousUrls.has(targetUrl)
        ) {

            return {

                blocked: true,

                category: "lista pública",

                reason:
                    "Este endereço está numa lista pública de sites de phishing/malware conhecidos (URLhaus / OpenPhish)."

            };

        }


        const heuristic =
            this.checkHeuristics(parsed);


        if (heuristic) {

            return heuristic;
        }


        return { blocked: false };

    }


    // ==========================================
    // HEURÍSTICAS PRÓPRIAS
    // ==========================================

    checkHeuristics(parsed) {

        const host =
            parsed.hostname.toLowerCase();


        // 1. Punycode / homógrafo (domínio com
        // caracteres disfarçados imitando outro)
        if (host.includes("xn--")) {

            return {

                blocked: true,

                category: "heurística",

                reason:
                    "Este endereço usa caracteres internacionais disfarçados (punycode), uma técnica comum para imitar sites conhecidos."

            };

        }


        // 2. IP puro como host + caminho de login
        const isIpHost =
            /^\d{1,3}(\.\d{1,3}){3}$/.test(host);

        const looksLikeLogin =
            /login|signin|verify|secure|account|senha|banco/i.test(
                parsed.pathname
            );

        if (isIpHost && looksLikeLogin) {

            return {

                blocked: true,

                category: "heurística",

                reason:
                    "Este site usa um endereço IP em vez de um domínio normal e parece imitar uma página de login — um padrão comum de phishing."

            };

        }


        // 3. Marca conhecida usada como parte de
        // um domínio diferente
        // (ex: paypal.com.login-verifica.ru)
        const labels =
            host.split(".");

        if (labels.length > 2) {

            const realDomain =
                labels[labels.length - 2];

            const otherLabels =
                labels.slice(0, -2).join(".");

            for (const brand of KNOWN_BRANDS) {

                if (
                    otherLabels.includes(brand) &&
                    !realDomain.includes(brand)
                ) {

                    return {

                        blocked: true,

                        category: "heurística",

                        reason:
                            `Este endereço tenta imitar "${brand}" como parte de um domínio diferente — um padrão comum de phishing.`

                    };

                }

            }

        }


        return null;

    }


    // ==========================================
    // CHECAGEM RÁPIDA DE HOST
    // (usada para bloquear recursos individuais,
    // como scripts/iframes/anúncios de domínios
    // maliciosos — só a lista, sem heurísticas,
    // pra não bloquear recursos legítimos à toa)
    // ==========================================

    isKnownMaliciousHost(host) {

        const normalized =
            (host || "").toLowerCase();


        if (!normalized) {

            return false;
        }


        if (this.allowedHosts.has(normalized)) {

            return false;
        }


        return this.maliciousHosts.has(normalized);

    }


    // ==========================================
    // CONTINUAR MESMO ASSIM (bypass temporário)
    // ==========================================

    allowOnce(hostname) {

        this.allowedHosts.add(
            (hostname || "").toLowerCase()
        );

    }


    // ==========================================
    // CHECAGEM DE DOWNLOADS
    // ==========================================

    checkDownload(sourceUrl, filename) {

        const extension =
            (filename.split(".").pop() || "")
                .toLowerCase();


        const dangerousExtension =
            DANGEROUS_EXTENSIONS.has(extension);


        let sourceFlagged = false;

        try {

            const parsed =
                new URL(sourceUrl);

            const host =
                parsed.hostname.toLowerCase();

            sourceFlagged =
                this.maliciousHosts.has(host) ||
                this.maliciousUrls.has(sourceUrl);

        } catch (error) {

            sourceFlagged = false;

        }


        if (sourceFlagged) {

            return {

                risk: "dangerous",

                reason:
                    "O site de origem deste download está numa lista pública de sites maliciosos conhecidos."

            };

        }


        if (dangerousExtension) {

            return {

                risk: "caution",

                reason:
                    `Arquivos ".${extension}" podem executar código no seu computador. Só abra se você confia na origem.`

            };

        }


        return { risk: "safe" };

    }

}


module.exports = SecurityManager;
