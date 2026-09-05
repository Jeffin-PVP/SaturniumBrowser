const {
    contextBridge,
    ipcRenderer
} = require("electron");


contextBridge.exposeInMainWorld(
    "browserAPI",
    {

        // ==========================================
        // NAVEGAÇÃO
        // ==========================================

        navigate: (url) =>
            ipcRenderer.send(
                "browser-navigate",
                url
            ),


        back: () =>
            ipcRenderer.send(
                "browser-back"
            ),


        forward: () =>
            ipcRenderer.send(
                "browser-forward"
            ),


        reload: () =>
            ipcRenderer.send(
                "browser-reload"
            ),


        stop: () =>
            ipcRenderer.send(
                "browser-stop"
            ),


        minimizeWindow: () =>
            ipcRenderer.send(
                "window-minimize"
            ),


        maximizeWindow: () =>
            ipcRenderer.send(
                "window-maximize"
            ),


        closeWindow: () =>
            ipcRenderer.send(
                "window-close"
            ),


        // ==========================================
        // BARRA DE ENDEREÇO
        // ==========================================

        onFocusAddressBar: (callback) => {

            ipcRenderer.on(
                "focus-address-bar",
                () => {

                    callback();

                }
            );

        },


        // ==========================================
        // ABAS
        // ==========================================

        newTab: () =>
            ipcRenderer.send(
                "tab-new"
            ),


        closeTab: (id) =>
            ipcRenderer.send(
                "tab-close",
                id
            ),


        activateTab: (id) =>
            ipcRenderer.send(
                "tab-activate",
                id
            ),


        // ==========================================
        // MENU PRINCIPAL (TRÊS PONTINHOS)
        // ==========================================

        showMainMenu: () =>
            ipcRenderer.send(
                "main-menu-open"
            ),


        // ==========================================
        // HISTÓRICO
        // ==========================================

        openHistory: () =>
            ipcRenderer.send(
                "history-open"
            ),


        // ==========================================
        // FIXAR ABA / REABRIR ABA FECHADA
        // ==========================================

        togglePinTab: (id) =>
            ipcRenderer.send(
                "tab-toggle-pin",
                id
            ),


        reopenClosedTab: () =>
            ipcRenderer.send(
                "tab-reopen-closed"
            ),


        showTabContextMenu: (payload) =>
            ipcRenderer.send(
                "tab-context-menu",
                payload
            ),


        // ==========================================
        // DOWNLOADS
        // ==========================================

        openDownloads: () =>
            ipcRenderer.send(
                "downloads-open"
            ),


        closeDownloadsBar: () =>
            ipcRenderer.send(
                "downloads-bar-close"
            ),


        cancelDownload: (id) =>
            ipcRenderer.send(
                "downloads-cancel",
                id
            ),


        openDownloadFile: (id) =>
            ipcRenderer.send(
                "downloads-open-file",
                id
            ),


        showDownloadInFolder: (id) =>
            ipcRenderer.send(
                "downloads-show-in-folder",
                id
            ),


        onDownloadsUpdated: (callback) => {

            ipcRenderer.on(
                "downloads-updated",
                (event, data) => {

                    callback(data);

                }
            );

        },


        // ==========================================
        // ATUALIZAÇÃO DAS ABAS
        // ==========================================

        onTabsUpdated: (callback) => {

            ipcRenderer.on(
                "tabs-updated",
                (event, data) => {

                    callback(data);

                }
            );

        },


        // ==========================================
        // ABA ATIVA
        // ==========================================

        onActiveTabUpdated: (callback) => {

            ipcRenderer.on(
                "active-tab-updated",
                (event, tab) => {

                    callback(tab);

                }
            );

        },


        // ==========================================
        // ESTADO DA NAVEGAÇÃO
        // ==========================================

        onNavigationState: (callback) => {

            ipcRenderer.on(
                "navigation-state",
                (event, state) => {

                    callback(state);

                }
            );

        },


        // ==========================================
        // LOADING
        // ==========================================

        onLoading: (callback) => {

            ipcRenderer.on(
                "browser-loading",
                (event, loading) => {

                    callback(loading);

                }
            );

        },


        // ==========================================
        // ATUALIZAÇÕES
        // ==========================================

        update: {

            onChecking: (callback) =>
                ipcRenderer.on(
                    "update-checking",
                    () => {

                        callback();

                    }
                ),


            onAvailable: (callback) =>
                ipcRenderer.on(
                    "update-available",
                    (event, data) => {

                        callback(data);

                    }
                ),


            onNotAvailable: (callback) =>
                ipcRenderer.on(
                    "update-not-available",
                    (event, data) => {

                        callback(data);

                    }
                ),


            onProgress: (callback) =>
                ipcRenderer.on(
                    "update-progress",
                    (event, data) => {

                        callback(data);

                    }
                ),


            onDownloaded: (callback) =>
                ipcRenderer.on(
                    "update-downloaded",
                    (event, data) => {

                        callback(data);

                    }
                ),


            onError: (callback) =>
                ipcRenderer.on(
                    "update-error",
                    (event, data) => {

                        callback(data);

                    }
                ),


            check: () =>
                ipcRenderer.send(
                    "update-check"
                ),


            install: () =>
                ipcRenderer.send(
                    "update-install"
                )

        }

    }

);