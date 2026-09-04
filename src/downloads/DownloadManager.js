const fs = require("fs");
const path = require("path");
const { shell } = require("electron");


class DownloadManager {

    constructor(callbacks = {}) {

        this.onNewDownload =
            callbacks.onNewDownload || (() => {});

        this.onChange =
            callbacks.onChange || (() => {});


        this.dataDirectory = path.join(
            process.env.APPDATA || process.cwd(),
            "VoidBrowser"
        );

        this.downloadsFile = path.join(
            this.dataDirectory,
            "downloads.json"
        );


        this.downloads = [];

        // Guarda as referências vivas dos
        // DownloadItem (não são serializáveis,
        // por isso ficam fora do array salvo).
        this.liveItems = new Map();

        this.nextId = 1;


        this.load();

    }


    // ==========================================
    // CARREGAR DO DISCO
    // ==========================================

    load() {

        try {

            if (!fs.existsSync(this.dataDirectory)) {

                fs.mkdirSync(
                    this.dataDirectory,
                    { recursive: true }
                );

            }


            if (!fs.existsSync(this.downloadsFile)) {

                this.downloads = [];

                this.save();

                return;
            }


            const data =
                fs.readFileSync(
                    this.downloadsFile,
                    "utf8"
                );


            this.downloads =
                JSON.parse(data);


            if (!Array.isArray(this.downloads)) {

                this.downloads = [];

            }


            // =============================
            // DOWNLOADS QUE FICARAM "EM ANDAMENTO"
            // (o app foi fechado no meio) agora
            // são marcados como interrompidos.
            // =============================

            for (const entry of this.downloads) {

                if (entry.state === "progressing") {

                    entry.state = "interrupted";

                }

                if (
                    entry.id &&
                    entry.id >= this.nextId
                ) {

                    this.nextId =
                        entry.id + 1;

                }

            }

        } catch (error) {

            console.error(
                "[DownloadManager] Erro ao carregar downloads:",
                error
            );

            this.downloads = [];

        }

    }


    // ==========================================
    // SALVAR NO DISCO
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
                this.downloadsFile,
                JSON.stringify(
                    this.downloads,
                    null,
                    4
                ),
                "utf8"
            );

        } catch (error) {

            console.error(
                "[DownloadManager] Erro ao salvar downloads:",
                error
            );

        }

    }


    // ==========================================
    // NOVO DOWNLOAD INICIADO
    // ==========================================

    handleWillDownload(item) {

        const id = this.nextId++;


        const entry = {

            id,

            filename:
                item.getFilename(),

            url:
                item.getURL(),

            savePath: null,

            totalBytes:
                item.getTotalBytes(),

            receivedBytes: 0,

            state: "progressing",

            startedAt: Date.now()

        };


        this.downloads.unshift(entry);

        this.liveItems.set(id, item);


        this.save();

        this.onNewDownload(entry);

        this.emitChange();


        item.on(
            "updated",
            (event, state) => {

                entry.receivedBytes =
                    item.getReceivedBytes();

                entry.totalBytes =
                    item.getTotalBytes();

                // "progressing" ou "interrupted"
                entry.state = state;

                this.save();

                this.emitChange();

            }
        );


        item.once(
            "done",
            (event, state) => {

                // "completed", "cancelled"
                // ou "interrupted"
                entry.state = state;

                entry.savePath =
                    item.getSavePath();

                entry.receivedBytes =
                    item.getReceivedBytes();

                this.liveItems.delete(id);

                this.save();

                this.emitChange();

            }
        );

    }


    // ==========================================
    // AÇÕES
    // ==========================================

    cancel(id) {

        const item =
            this.liveItems.get(id);

        if (item) {

            item.cancel();

        }

    }


    openFile(id) {

        const entry =
            this.downloads.find(
                d => d.id === id
            );

        if (entry && entry.savePath) {

            shell.openPath(
                entry.savePath
            );

        }

    }


    showInFolder(id) {

        const entry =
            this.downloads.find(
                d => d.id === id
            );

        if (entry && entry.savePath) {

            shell.showItemInFolder(
                entry.savePath
            );

        }

    }


    // ==========================================
    // OBTER / LIMPAR
    // ==========================================

    getAll() {

        return [...this.downloads];

    }


    clear() {

        // Não cancela downloads em andamento,
        // só limpa os que já terminaram.
        this.downloads =
            this.downloads.filter(
                entry =>
                    entry.state === "progressing"
            );

        this.save();

        this.emitChange();

    }


    emitChange() {

        this.onChange(
            this.getAll()
        );

    }

}


module.exports = DownloadManager;
