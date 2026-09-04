const { autoUpdater } =
    require("electron-updater");


class UpdateManager {

    constructor(window) {

        this.window = window;

        autoUpdater.autoDownload = true;

        autoUpdater.autoInstallEvent = "manual";

        this.setupEvents();

    }


    // =====================================
    // EVENTOS
    // =====================================

    setupEvents() {

        autoUpdater.on(
            "checking-for-update",
            () => {

                console.log(
                    "[Updater] Verificando atualizações..."
                );

                this.send(
                    "update-checking"
                );

            }
        );


        autoUpdater.on(
            "update-available",
            (info) => {

                console.log(
                    "[Updater] Atualização disponível:",
                    info.version
                );

                this.send(
                    "update-available",
                    {
                        version:
                            info.version
                    }
                );

            }
        );


        autoUpdater.on(
            "update-not-available",
            (info) => {

                console.log(
                    "[Updater] VoidBrowser já está atualizado."
                );

                this.send(
                    "update-not-available",
                    {
                        version:
                            info.version
                    }
                );

            }
        );


        autoUpdater.on(
            "download-progress",
            (progress) => {

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

                console.log(
                    "[Updater] Atualização baixada:",
                    info.version
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

                console.error(
                    "[Updater] Erro:",
                    error
                );

                this.send(
                    "update-error",
                    {
                        message:
                            error.message
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

        this.window.webContents.send(
            channel,
            data
        );

    }


    // =====================================
    // VERIFICAR ATUALIZAÇÃO
    // =====================================

    checkForUpdates() {

        if (!this.isPackaged()) {

            console.log(
                "[Updater] Aplicativo não empacotado. Verificação ignorada."
            );

            return;

        }

        autoUpdater.checkForUpdates();

    }


    // =====================================
    // INSTALAR
    // =====================================

    installUpdate() {

        autoUpdater.quitAndInstall();

    }


    // =====================================
    // VERIFICAR SE ESTÁ EMPACOTADO
    // =====================================

    isPackaged() {

        const {
            app
        } = require("electron");

        return app.isPackaged;

    }

}


module.exports =
    UpdateManager;