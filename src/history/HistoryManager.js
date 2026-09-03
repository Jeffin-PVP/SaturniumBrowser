const fs = require("fs");
const path = require("path");

class HistoryManager {

    constructor() {

        this.dataDirectory = path.join(
            process.env.APPDATA || process.cwd(),
            "VoidBrowser"
        );

        this.historyFile = path.join(
            this.dataDirectory,
            "history.json"
        );

        this.history = [];

        this.load();
    }


    // ==========================================
    // CARREGAR HISTÓRICO
    // ==========================================

    load() {

        try {

            if (!fs.existsSync(this.dataDirectory)) {

                fs.mkdirSync(
                    this.dataDirectory,
                    { recursive: true }
                );

            }


            if (!fs.existsSync(this.historyFile)) {

                this.history = [];

                this.save();

                return;
            }


            const data =
                fs.readFileSync(
                    this.historyFile,
                    "utf8"
                );


            this.history =
                JSON.parse(data);


            if (!Array.isArray(this.history)) {

                this.history = [];

            }

        } catch (error) {

            console.error(
                "[HistoryManager] Erro ao carregar histórico:",
                error
            );

            this.history = [];

        }

    }


    // ==========================================
    // SALVAR HISTÓRICO
    // ==========================================

    save() {

        try {

            if (!fs.existsSync(this.dataDirectory)) {

                fs.mkdirSync(
                    this.dataDirectory,
                    { recursive: true }
                );

            }


            fs.writeFileSync(
                this.historyFile,
                JSON.stringify(
                    this.history,
                    null,
                    4
                ),
                "utf8"
            );

        } catch (error) {

            console.error(
                "[HistoryManager] Erro ao salvar histórico:",
                error
            );

        }

    }


    // ==========================================
    // ADICIONAR VISITA
    // ==========================================

    add(url, title = "", favicon = null) {

        if (!url) {
            return;
        }


        // Não registrar páginas internas
        if (url.startsWith("void://")) {
            return;
        }


        // =============================
        // ATUALIZAR VISITA EM ANDAMENTO
        // Se a última entrada já é da mesma
        // URL (ex: o título mudou de novo
        // enquanto a página ainda carrega),
        // atualizamos em vez de duplicar.
        // =============================

        const lastEntry =
            this.history[0];

        if (
            lastEntry &&
            lastEntry.url === url
        ) {

            lastEntry.title =
                title ||
                lastEntry.title ||
                url;

            if (favicon) {

                lastEntry.favicon =
                    favicon;

            }

            this.save();

            return;

        }


        const entry = {

            url,

            title:
                title ||
                url,

            favicon:
                favicon || null,

            visitedAt:
                Date.now()

        };


        this.history.unshift(entry);


        this.save();

    }


    // ==========================================
    // ATUALIZAR FAVICON DE UMA VISITA JÁ SALVA
    // (o favicon costuma carregar um pouco depois
    // do título da página)
    // ==========================================

    updateFavicon(url, favicon) {

        if (!url || !favicon) {
            return;
        }


        let changed = false;

        for (const entry of this.history) {

            if (
                entry.url === url &&
                !entry.favicon
            ) {

                entry.favicon = favicon;

                changed = true;

            }

        }


        if (changed) {

            this.save();

        }

    }


    // ==========================================
    // OBTER HISTÓRICO
    // ==========================================

    getAll() {

        return [...this.history];

    }


    // ==========================================
    // LIMPAR HISTÓRICO
    // ==========================================

    clear() {

        this.history = [];

        this.save();

    }

}


module.exports = HistoryManager;