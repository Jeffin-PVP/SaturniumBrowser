const {
    app,
    BrowserWindow,
    ipcMain,
    Menu,
    protocol,
    net,
    session
} = require("electron");

const path =
    require("path");

const { pathToFileURL } = require("url");

const BrowserManager =
    require("./src/browser/BrowserManager");

const UpdateManager =
    require("./src/updater/UpdateManager");

let win;

let browserManager;

let updateManager;

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
            "saturniumbrowser-ico.ico"
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

    if (!updateManager) {

        updateManager = new UpdateManager(win);

        setTimeout(() => {
            updateManager.checkForUpdates();
        }, 5000);

    } else {

        updateManager.window = win;

    }

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
// ATUALIZAÇÕES
// ==========================================

ipcMain.on("update-check", () => {

    if (!updateManager) return;

    updateManager.checkForUpdates(true);

});


ipcMain.on("update-install", () => {

    if (!updateManager) return;

    updateManager.installUpdate();

});

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
            },

            {
                type: "separator"
            },

            {
                label: "Verificar atualizações",

                click: () => {

                    if (!updateManager) {

                        return;

                    }


                    updateManager.checkForUpdates(true);

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
// SATURNIUM PROTOCOL
// ==========================================

protocol.registerSchemesAsPrivileged([
    {
        scheme: "saturnium",
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true
        }
    }
]);

// ==========================================
// ELECTRON READY
// ==========================================

app.whenReady().then(async () => {

    // ==========================================
    // PERMISSÕES SENSÍVEIS — NEGADAS POR PADRÃO
    // (câmera, microfone, localização, notificações,
    // captura de tela, USB/Bluetooth/HID/serial etc.)
    // Só o essencial pra navegação normal é permitido.
    // ==========================================

    const ALLOWED_PERMISSIONS = new Set([
        "fullscreen",
        "pointerLock",
        "clipboard-sanitized-write"
    ]);

    session.defaultSession.setPermissionRequestHandler(
        (webContents, permission, callback) => {

            callback(
                ALLOWED_PERMISSIONS.has(permission)
            );

        }
    );

    session.defaultSession.setPermissionCheckHandler(
        (webContents, permission) => {

            return ALLOWED_PERMISSIONS.has(permission);

        }
    );

    // ==========================================
    // BLOQUEIO DE REDE
    // Barra qualquer requisição (script, iframe,
    // imagem, anúncio etc) vinda de um domínio já
    // confirmado como malicioso — não só a
    // navegação principal, mas tudo que a página
    // tentar carregar por baixo dos panos.
    // ==========================================

    session.defaultSession.webRequest.onBeforeRequest(
        (details, callback) => {

            if (!browserManager) {

                callback({ cancel: false });

                return;
            }


            let host = "";

            try {

                host = new URL(details.url).hostname.toLowerCase();

            } catch (error) {

                callback({ cancel: false });

                return;
            }


            const isMalicious =
                browserManager.security.isKnownMaliciousHost(
                    host
                );


            callback({ cancel: isMalicious });

        }
    );

    // Registrar protocolo interno Saturnium
    protocol.handle("saturnium", async (request) => {

        const url = new URL(request.url);

        let file;

        switch (url.hostname) {

            case "newtab":
                file = "newtab.html";
                break;

            case "history":
                file = "history.html";
                break;

            case "downloads":
                file = "downloads.html";
                break;

            case "search":
                file = "search.html";
                break;

            default:
                return new Response(
                    "Página Saturnium desconhecida",
                    {
                        status: 404
                    }
                );
        }

        const filePath = path.join(
            __dirname,
            file
        );

        return net.fetch(
            pathToFileURL(filePath).toString()
        );
    });

    // Criar janela principal
    createWindow();

});

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