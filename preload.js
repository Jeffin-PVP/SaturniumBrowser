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
        // HISTÓRICO
        // ==========================================

        openHistory: () =>
            ipcRenderer.send(
                "history-open"
            ),


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

        }


    }

);