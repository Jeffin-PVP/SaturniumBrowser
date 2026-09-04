const {
    app,
    BrowserWindow,
    ipcMain,
    Menu
} = require("electron");

const path =
    require("path");

const BrowserManager =
    require("./src/browser/BrowserManager");


let win;

let browserManager;


// ==========================================
// CRIAR JANELA
// ==========================================

function createWindow() {

    win = new BrowserWindow({

        width: 1280,
        height: 800,

        minWidth: 900,
        minHeight: 600,

        frame: false,

        icon: path.join(
            __dirname,
            "assets",
            "voidbrowser.ico"
        ),

        webPreferences: {

            preload: path.join(
                __dirname,
                "preload.js"
            ),

            contextIsolation: true,

            nodeIntegration: false

        }

    });


    // ======================================
    // REMOVER MENU PADRÃO DO ELECTRON
    // ======================================

    win.setMenu(null);


    // ======================================
    // CARREGAR INTERFACE
    // ======================================

    win.loadFile(
        "index.html"
    );


    // ======================================
    // INICIALIZAR BROWSER MANAGER
    // ======================================

    win.webContents.once(
        "did-finish-load",
        () => {

            browserManager =
                new BrowserManager(win);


            browserManager.initialize();

        }
    );


    // ======================================
    // REDIMENSIONAMENTO
    // ======================================

    win.on(
        "resize",
        () => {

            if (browserManager) {

                browserManager.updateBounds();

            }

        }
    );


    // ======================================
    // ATALHOS
    // ======================================

    win.webContents.on(
        "before-input-event",
        handleKeyboardInput
    );

}


// ==========================================
// TECLADO
// ==========================================

function handleKeyboardInput(
    event,
    input
) {

    if (
        input.type !== "keyDown"
    ) {

        return;

    }


    if (!browserManager) {

        return;

    }


    // ======================================
    // CTRL + L
    // FOCAR BARRA DE ENDEREÇO
    // ======================================

    if (
        input.control &&
        !input.shift &&
        input.key.toLowerCase() === "l"
    ) {

        event.preventDefault();


        win.webContents.send(
            "focus-address-bar"
        );


        return;

    }


    // ======================================
    // CTRL + T
    // NOVA ABA
    // ======================================

    if (
        input.control &&
        !input.shift &&
        input.key.toLowerCase() === "t"
    ) {

        event.preventDefault();


        browserManager.createTab();


        return;

    }


    // ======================================
    // CTRL + W
    // FECHAR ABA
    // ======================================

    if (
        input.control &&
        !input.shift &&
        input.key.toLowerCase() === "w"
    ) {

        event.preventDefault();


        const active =
            browserManager.getActiveTab();


        if (active) {

            browserManager.closeTab(
                active.id
            );

        }


        return;

    }


    // ======================================
    // CTRL + SHIFT + T
    // REABRIR ABA FECHADA
    // ======================================

    if (
        input.control &&
        input.shift &&
        input.key.toLowerCase() === "t"
    ) {

        event.preventDefault();


        browserManager.reopenClosedTab();


        return;

    }


    // ======================================
    // CTRL + SHIFT + TAB
    // ABA ANTERIOR
    // ======================================

    if (
        input.control &&
        input.shift &&
        input.key === "Tab"
    ) {

        event.preventDefault();


        browserManager.switchTab(
            -1
        );


        return;

    }


    // ======================================
    // CTRL + TAB
    // PRÓXIMA ABA
    // ======================================

    if (
        input.control &&
        !input.shift &&
        input.key === "Tab"
    ) {

        event.preventDefault();


        browserManager.switchTab(
            1
        );


        return;

    }


    // ======================================
    // CTRL + H
    // HISTÓRICO
    // ======================================

    if (
        input.control &&
        !input.shift &&
        input.key.toLowerCase() === "h"
    ) {

        event.preventDefault();


        browserManager.openHistory();


        return;

    }


    // ======================================
    // CTRL + J
    // DOWNLOADS
    // ======================================

    if (
        input.control &&
        !input.shift &&
        input.key.toLowerCase() === "j"
    ) {

        event.preventDefault();


        browserManager.openDownloads();


        return;

    }

}


// ==========================================
// NAVEGAÇÃO
// ==========================================


// ==========================================
// NAVEGAR
// ==========================================

ipcMain.on(
    "browser-navigate",
    (event, url) => {

        if (!browserManager) {

            return;

        }


        browserManager.navigate(
            url
        );

    }
);


// ==========================================
// VOLTAR
// ==========================================

ipcMain.on(
    "browser-back",
    () => {

        if (!browserManager) {

            return;

        }


        browserManager.back();

    }
);


// ==========================================
// AVANÇAR
// ==========================================

ipcMain.on(
    "browser-forward",
    () => {

        if (!browserManager) {

            return;

        }


        browserManager.forward();

    }
);


// ==========================================
// RECARREGAR
// ==========================================

ipcMain.on(
    "browser-reload",
    () => {

        if (!browserManager) {

            return;

        }


        browserManager.reload();

    }
);


// ==========================================
// PARAR CARREGAMENTO
// ==========================================

ipcMain.on(
    "browser-stop",
    () => {

        if (!browserManager) {

            return;

        }


        browserManager.stop();

    }
);


// ==========================================
// ABAS
// ==========================================


// ==========================================
// NOVA ABA
// ==========================================

ipcMain.on(
    "tab-new",
    () => {

        if (!browserManager) {

            return;

        }


        browserManager.createTab();

    }
);


// ==========================================
// FECHAR ABA
// ==========================================

ipcMain.on(
    "tab-close",
    (event, id) => {

        if (!browserManager) {

            return;

        }


        browserManager.closeTab(
            id
        );

    }
);


// ==========================================
// ATIVAR ABA
// ==========================================

ipcMain.on(
    "tab-activate",
    (event, id) => {

        if (!browserManager) {

            return;

        }


        browserManager.activateTab(
            id
        );

    }
);


// ==========================================
// ABRIR HISTÓRICO (via menu)
// ==========================================

ipcMain.on(
    "history-open",
    () => {

        if (!browserManager) {

            return;

        }


        browserManager.openHistory();

    }
);


// ==========================================
// FIXAR / DESAFIXAR ABA
// ==========================================

ipcMain.on(
    "tab-toggle-pin",
    (event, id) => {

        if (!browserManager) {

            return;

        }


        browserManager.togglePinTab(
            id
        );

    }
);


// ==========================================
// REABRIR ÚLTIMA ABA FECHADA
// ==========================================

ipcMain.on(
    "tab-reopen-closed",
    () => {

        if (!browserManager) {

            return;

        }


        browserManager.reopenClosedTab();

    }
);


// ==========================================
// DOWNLOADS
// ==========================================

ipcMain.on(
    "downloads-open",
    () => {

        if (!browserManager) {

            return;

        }


        browserManager.openDownloads();

    }
);


ipcMain.on(
    "downloads-bar-close",
    () => {

        if (!browserManager) {

            return;

        }


        browserManager.closeDownloadsBar();

    }
);


ipcMain.on(
    "downloads-cancel",
    (event, id) => {

        if (!browserManager) {

            return;

        }


        browserManager.cancelDownload(
            id
        );

    }
);


ipcMain.on(
    "downloads-open-file",
    (event, id) => {

        if (!browserManager) {

            return;

        }


        browserManager.openDownloadFile(
            id
        );

    }
);


ipcMain.on(
    "downloads-show-in-folder",
    (event, id) => {

        if (!browserManager) {

            return;

        }


        browserManager.showDownloadInFolder(
            id
        );

    }
);


// ==========================================
// MENU PRINCIPAL (TRÊS PONTINHOS)
// ==========================================

ipcMain.on(
    "main-menu-open",
    () => {

        if (
            !browserManager ||
            !win
        ) {

            return;

        }


        const template = [

            {
                label: "Histórico",

                accelerator: "Ctrl+H",

                click: () => {

                    browserManager.openHistory();

                }
            },

            {
                label: "Reabrir aba fechada",

                accelerator: "Ctrl+Shift+T",

                click: () => {

                    browserManager.reopenClosedTab();

                }
            },

            {
                label: "Downloads",

                accelerator: "Ctrl+J",

                click: () => {

                    browserManager.openDownloads();

                }
            }

        ];


        Menu.buildFromTemplate(
            template
        ).popup({
            window: win
        });

    }
);


// ==========================================
// MENU DE CONTEXTO DA ABA (CLIQUE DIREITO)
// ==========================================

ipcMain.on(
    "tab-context-menu",
    (event, payload) => {

        if (
            !browserManager ||
            !win
        ) {

            return;

        }


        const { id, pinned } =
            payload;


        const template = [

            {
                label:
                    pinned
                        ? "Desafixar aba"
                        : "Fixar aba",

                click: () => {

                    browserManager.togglePinTab(
                        id
                    );

                }
            },

            {
                type: "separator"
            },

            {
                label:
                    "Fechar aba",

                click: () => {

                    browserManager.closeTab(
                        id
                    );

                }
            }

        ];


        Menu.buildFromTemplate(
            template
        ).popup({
            window: win
        });

    }
);


// ==========================================
// CONTROLES DA JANELA
// ==========================================


// ==========================================
// MINIMIZAR
// ==========================================

ipcMain.on(
    "window-minimize",
    () => {

        if (!win) return;

        win.minimize();

    }
);


// ==========================================
// MAXIMIZAR / RESTAURAR
// ==========================================

ipcMain.on(
    "window-maximize",
    () => {

        if (!win) return;


        if (win.isMaximized()) {

            win.unmaximize();

        } else {

            win.maximize();

        }

    }
);


// ==========================================
// FECHAR JANELA
// ==========================================

ipcMain.on(
    "window-close",
    () => {

        if (!win) return;

        win.close();

    }
);


// ==========================================
// ELECTRON READY
// ==========================================

app.whenReady().then(
    createWindow
);


// ==========================================
// MACOS
// ==========================================

app.on(
    "activate",
    () => {

        if (
            BrowserWindow.getAllWindows()
                .length === 0
        ) {

            createWindow();

        }

    }
);


// ==========================================
// FECHAR
// ==========================================

app.on(
    "window-all-closed",
    () => {

        if (
            process.platform !== "darwin"
        ) {

            app.quit();

        }

    }
);