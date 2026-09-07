const { app } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("fs");
const path = require("path");


class UpdateManager {

    constructor(window) {

        this.window = window;

        this.isChecking = false;
        this.updateAvailable = false;
        this.updateDownloaded = false;
        this.availableVersion = null;
        this.lastError = null;
        this.lastCheckWasManual = false;

        this.logDirectory = app.getPath("userData");
        this.logFile = path.join(
            this.logDirectory,
            "updater.log"
        );

        // Baixa automaticamente quando uma nova versão é encontrada.
        autoUpdater.autoDownload = true;

        // A instalação será iniciada somente quando o usuário clicar
        // em "Reiniciar e atualizar".
        autoUpdater.autoInstallEvent = "manual";

        this.setupLogger();
        this.setupEvents();

        this.log(
            "INFO",
            `UpdateManager iniciado. Versão atual: ${app.getVersion()}`
        );

    }


    // =====================================
    // LOG
    // =====================================

    setupLogger() {

        try {

            if (!fs.existsSync(this.logDirectory)) {
                fs.mkdirSync(
                    this.logDirectory,
                    { recursive: true }
                );
            }

        } catch (error) {

            console.error(
                "[Updater] Não foi possível preparar o diretório de log:",
                error
            );

        }

    }


    log(level, message, error = null) {

        const timestamp =
            new Date().toISOString();

        let line =
            `[${timestamp}] [${level}] ${message}`;

        if (error) {

            line +=
                ` | ${error.message || error}`;

        }

        console.log(line);

        try {

            fs.appendFileSync(
                this.logFile,
                line + "\n",
                "utf8"
            );

        } catch (logError) {

            console.error(
                "[Updater] Falha ao gravar updater.log:",
                logError
            );

        }

    }


    // =====================================
    // EVENTOS
    // =====================================

    setupEvents() {

        autoUpdater.on(
            "checking-for-update",
            () => {

                this.isChecking = true;
                this.lastError = null;

                this.log(
                    "INFO",
                    "Verificando atualizações..."
                );

                this.send(
                    "update-checking"
                );

            }
        );


        autoUpdater.on(
            "update-available",
            (info) => {

                this.isChecking = false;
                this.updateAvailable = true;
                this.updateDownloaded = false;
                this.availableVersion =
                    info.version || null;
                this.lastError = null;

                this.log(
                    "INFO",
                    `Atualização disponível: ${info.version}`
                );

                this.send(
                    "update-available",
                    {
                        version: info.version,
                        releaseName: info.releaseName || null
                    }
                );

            }
        );


        autoUpdater.on(
            "update-not-available",
            (info) => {

                this.isChecking = false;
                this.updateAvailable = false;
                this.updateDownloaded = false;
                this.availableVersion = null;
                this.lastError = null;

                this.log(
                    "INFO",
                    `SaturniumBrowser já está atualizado. Versão: ${info.version || app.getVersion()}`
                );

                this.send(
                    "update-not-available",
                    {
                        version:
                            info.version || app.getVersion(),

                        manual:
                            this.lastCheckWasManual
                    }
                );

            }
        );


        autoUpdater.on(
            "download-progress",
            (progress) => {

                this.log(
                    "INFO",
                    `Baixando atualização: ${progress.percent.toFixed(1)}%`
                );

                this.send(
                    "update-progress",
                    {
                        percent:
                            progress.percent,

                        transferred:
                            progress.transferred,

                        total:
                            progress.total,

                        bytesPerSecond:
                            progress.bytesPerSecond
                    }
                );

            }
        );


        autoUpdater.on(
            "update-downloaded",
            (info) => {

                this.isChecking = false;
                this.updateAvailable = true;
                this.updateDownloaded = true;
                this.availableVersion =
                    info.version || this.availableVersion;
                this.lastError = null;

                this.log(
                    "INFO",
                    `Atualização baixada: ${info.version}`
                );

                this.send(
                    "update-downloaded",
                    {
                        version:
                            info.version
                    }
                );

            }
        );


        autoUpdater.on(
            "error",
            (error) => {

                this.isChecking = false;
                this.lastError =
                    error && error.message
                        ? error.message
                        : String(error);

                this.log(
                    "ERROR",
                    "Erro durante a atualização",
                    error
                );

                this.send(
                    "update-error",
                    {
                        message:
                            this.lastError
                    }
                );

            }
        );

    }


    // =====================================
    // ENVIAR PARA INTERFACE
    // =====================================

    send(channel, data = {}) {

        if (!this.window) {
            return;
        }

        if (this.window.isDestroyed()) {
            return;
        }

        this.window.webContents.send(
            channel,
            data
        );

    }


    // =====================================
    // VERIFICAR ATUALIZAÇÃO
    // =====================================

    async checkForUpdates(manual = false) {

        this.lastCheckWasManual = manual;


        if (!this.isPackaged()) {

            this.log(
                "INFO",
                "Aplicativo não empacotado. Verificação ignorada."
            );


            if (manual) {

                this.send(
                    "update-error",
                    {
                        message:
                            "Verificação de atualizações não está disponível em modo de desenvolvimento."
                    }
                );

            }


            return null;

        }

        if (this.isChecking) {

            this.log(
                "INFO",
                "Uma verificação já está em andamento."
            );

            return null;

        }

        try {

            this.isChecking = true;

            this.log(
                "INFO",
                `Iniciando verificação. Plataforma: ${process.platform}, arquitetura: ${process.arch}`
            );

            return await autoUpdater.checkForUpdates();

        } catch (error) {

            this.isChecking = false;
            this.lastError =
                error && error.message
                    ? error.message
                    : String(error);

            this.log(
                "ERROR",
                "checkForUpdates() falhou",
                error
            );

            this.send(
                "update-error",
                {
                    message:
                        this.lastError
                }
            );

            return null;

        }

    }


    // =====================================
    // INSTALAR
    // =====================================

    installUpdate() {

        if (!this.updateDownloaded) {

            this.log(
                "WARN",
                "Tentativa de instalar atualização antes do download terminar."
            );

            return false;

        }

        this.log(
            "INFO",
            `Instalando atualização ${this.availableVersion || "desconhecida"}...`
        );

        autoUpdater.quitAndInstall();

        return true;

    }


    // =====================================
    // STATUS
    // =====================================

    getStatus() {

        return {
            currentVersion:
                app.getVersion(),

            isPackaged:
                this.isPackaged(),

            isChecking:
                this.isChecking,

            updateAvailable:
                this.updateAvailable,

            updateDownloaded:
                this.updateDownloaded,

            availableVersion:
                this.availableVersion,

            lastError:
                this.lastError
        };

    }


    // =====================================
    // VERIFICAR SE ESTÁ EMPACOTADO
    // =====================================

    isPackaged() {

        return app.isPackaged;

    }

}


module.exports =
    UpdateManager;
