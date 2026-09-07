const { WebContentsView } = require("electron");
const path = require("path");


// =====================================
// PÁGINA INTERNA
// =====================================

// TabManager.js está em:
// src/browser/TabManager.js
//
// newtab.html está em:
// newtab.html
//
// Por isso precisamos voltar duas pastas.
const NEW_TAB_PAGE = path.join(
    __dirname,
    "..",
    "..",
    "newtab.html"
);

const HISTORY_PAGE = path.join(
    __dirname,
    "..",
    "..",
    "history.html"
);

const DOWNLOADS_PAGE = path.join(
    __dirname,
    "..",
    "..",
    "downloads.html"
);

const SEARCH_PAGE = path.join(
    __dirname,
    "..",
    "..",
    "search.html"
);

const BLOCKED_PAGE = path.join(
    __dirname,
    "..",
    "..",
    "blocked.html"
);


class TabManager {

    constructor(window, callbacks = {}) {

        this.window = window;

        // =================================
        // CALLBACKS (compatibilidade: aceita
        // também uma função solta como antes)
        // =================================

        if (typeof callbacks === "function") {

            callbacks = {
                onNavigate: callbacks
            };

        }

        this.onNavigate =
            callbacks.onNavigate || null;

        this.getHistory =
            callbacks.getHistory || null;

        this.clearHistory =
            callbacks.clearHistory || null;

        this.onFaviconUpdate =
            callbacks.onFaviconUpdate || null;

        this.getDownloads =
            callbacks.getDownloads || null;

        this.clearDownloads =
            callbacks.clearDownloads || null;

        this.cancelDownload =
            callbacks.cancelDownload || null;

        this.openDownloadFile =
            callbacks.openDownloadFile || null;

        this.showDownloadInFolder =
            callbacks.showDownloadInFolder || null;

        this.performSearch =
            callbacks.performSearch || null;

        this.checkUrlSafety =
            callbacks.checkUrlSafety || null;

        this.allowUrlOnce =
            callbacks.allowUrlOnce || null;

        this.tabs = [];

        this.activeTabId = null;

        this.nextTabId = 1;

        // =================================
        // ABAS FECHADAS RECENTEMENTE
        // (para "reabrir aba fechada")
        // =================================

        this.closedTabs = [];

        this.maxClosedTabs = 15;

        // =================================
        // BARRA DE DOWNLOADS
        // (afeta a altura da área de conteúdo)
        // =================================

        this.downloadsBarHeight = 0;
    }


    // =====================================
    // CRIAR ABA
    // =====================================

    createTab(url = null) {

        const id = this.nextTabId++;


        const view = new WebContentsView({

            webPreferences: {

                contextIsolation: true,

                nodeIntegration: false,

                sandbox: true

            }

        });


        const tab = {

            id,

            view,

            title: "Nova aba - SaturniumBrowser",

            url: url || "saturnium://newtab",

            internal: !url,

            favicon: null,

            loading: false,

            pinned: false

        };


        this.tabs.push(tab);


        this.window.contentView.addChildView(
            view
        );


        view.setVisible(true);


        this.setupEvents(tab);


        // =================================
        // CARREGAR PÁGINA
        // =================================

        if (url) {

            view.webContents.loadURL(url);

        } else {

            view.webContents.loadFile(
                NEW_TAB_PAGE
            );

        }


        this.activateTab(id);


        return tab;
    }


    // =====================================
    // EVENTOS DA ABA
    // =====================================

    setupEvents(tab) {

        const webContents =
            tab.view.webContents;

        // =================================
        // ATALHOS DO NAVEGADOR
        // =================================

        webContents.on(
            "before-input-event",
            (event, input) => {

                if (input.type !== "keyDown") {
                    return;
                }

                // =================================
                // CTRL + L — FOCAR BARRA DE ENDEREÇO
                // =================================

                if (
                    input.control &&
                    !input.shift &&
                    input.key.toLowerCase() === "l"
                ) {

                    event.preventDefault();

                    this.window.webContents.send("focus-address-bar");

                    return;
                }

                // =================================
                // CTRL + T — NOVA ABA
                // =================================

                if (
                    input.control &&
                    !input.shift &&
                    input.key.toLowerCase() === "t"
                ) {

                    event.preventDefault();

                    this.createTab();

                    return;
                }


                // =================================
                // CTRL + W — FECHAR ABA
                // =================================

                if (
                    input.control &&
                    !input.shift &&
                    input.key.toLowerCase() === "w"
                ) {

                    event.preventDefault();

                    this.closeTab(tab.id);

                    return;
                }


                // =================================
                // CTRL + SHIFT + T
                // REABRIR ABA FECHADA
                // =================================

                if (
                    input.control &&
                    input.shift &&
                    input.key.toLowerCase() === "t"
                ) {

                    event.preventDefault();

                    this.reopenClosedTab();

                    return;
                }


                // =================================
                // CTRL + TAB — PRÓXIMA ABA
                // =================================

                if (
                    input.control &&
                    !input.shift &&
                    input.key === "Tab"
                ) {

                    event.preventDefault();

                    this.switchTab(1);

                    return;
                }


                // =================================
                // CTRL + SHIFT + TAB
                // ABA ANTERIOR
                // =================================

                if (
                    input.control &&
                    input.shift &&
                    input.key === "Tab"
                ) {

                    event.preventDefault();

                    this.switchTab(-1);

                    return;
                }


                // =================================
                // CTRL + H — HISTÓRICO
                // =================================

                if (
                    input.control &&
                    !input.shift &&
                    input.key.toLowerCase() === "h"
                ) {

                    event.preventDefault();

                    this.openHistory();

                    return;
                }


                // =================================
                // CTRL + J — DOWNLOADS
                // =================================

                if (
                    input.control &&
                    !input.shift &&
                    input.key.toLowerCase() === "j"
                ) {

                    event.preventDefault();

                    this.openDownloads();

                    return;
                }

            }
        );


        // =================================
        // LINKS INTERNOS (saturnium://...)
        // CLICADOS DENTRO DA PRÓPRIA PÁGINA
        // =================================

        webContents.on(
            "will-navigate",
            (event, url) => {

                if (
                    /^saturnium:\/\//i.test(url)
                ) {

                    event.preventDefault();

                    this.navigate(url);

                    return;
                }


                // =============================
                // CHECAGEM DE SEGURANÇA
                // (links clicados dentro de
                // páginas, redirecionamentos
                // via JS, etc.)
                // =============================

                const safety =
                    typeof this.checkUrlSafety === "function"
                        ? this.checkUrlSafety(url)
                        : { blocked: false };


                if (safety && safety.blocked) {

                    event.preventDefault();

                    this.openInternalPage(
                        "blocked",
                        {
                            url,
                            reason: safety.reason,
                            category: safety.category
                        }
                    );

                }

            }
        );


        // =================================
        // REDIRECIONAMENTOS DE SERVIDOR
        // (ex: um site "limpo" redirecionando
        // pra uma página de phishing)
        // =================================

        webContents.on(
            "will-redirect",
            (event, url) => {

                const safety =
                    typeof this.checkUrlSafety === "function"
                        ? this.checkUrlSafety(url)
                        : { blocked: false };


                if (safety && safety.blocked) {

                    event.preventDefault();

                    this.openInternalPage(
                        "blocked",
                        {
                            url,
                            reason: safety.reason,
                            category: safety.category
                        }
                    );

                }

            }
        );


        // =================================
        // URL ALTERADA
        // =================================

        webContents.on(
            "did-navigate",
            (event, url) => {

                // Se for a página interna,
                // mantemos a URL virtual.
                if (
                    tab.internal &&
                    url.startsWith("file://")
                ) {

                    return;
                }


                // Se saiu da página interna,
                // agora é uma página normal.
                tab.internal = false;

                tab.url = url;


                if (
                    tab.id ===
                    this.activeTabId
                ) {

                    this.sendTabUpdate(tab);

                    this.sendNavigationState(tab);

                }

            }
        );


        // =================================
        // NAVEGAÇÃO INTERNA DA PÁGINA
        // =================================

        webContents.on(
            "did-navigate-in-page",
            (event, url) => {

                if (
                    tab.internal &&
                    url.startsWith("file://")
                ) {

                    return;
                }


                tab.internal = false;

                tab.url = url;


                if (
                    tab.id ===
                    this.activeTabId
                ) {

                    this.sendTabUpdate(tab);

                    this.sendNavigationState(tab);

                }

            }
        );


        // =================================
        // TÍTULO
        // =================================

        webContents.on(
            "page-title-updated",
            (event, title) => {

                tab.title =
                    title ||
                    "Nova aba - SaturniumBrowser";


                if (
                    tab.id ===
                    this.activeTabId
                ) {

                    this.sendTabUpdate(tab);

                }


                this.sendTabs();


                // =============================
                // REGISTRAR NO HISTÓRICO
                // =============================

                if (
                    !tab.internal &&
                    typeof this.onNavigate === "function"
                ) {

                    this.onNavigate(
                        tab.url,
                        tab.title,
                        tab.favicon
                    );

                }

            }
        );


        // =================================
        // FAVICON
        // =================================

        webContents.on(
            "page-favicon-updated",
            (event, favicons) => {

                if (
                    favicons &&
                    favicons.length > 0
                ) {

                    tab.favicon = favicons[0];

                } else {

                    tab.favicon = null;

                }


                this.sendTabs();


                // =============================
                // ATUALIZAR FAVICON NO HISTÓRICO
                // (o favicon geralmente chega um
                // pouco depois do título da página)
                // =============================

                if (
                    !tab.internal &&
                    tab.favicon &&
                    typeof this.onFaviconUpdate === "function"
                ) {

                    this.onFaviconUpdate(
                        tab.url,
                        tab.favicon
                    );

                }

            }
        );

        // =================================
        // COMEÇOU A CARREGAR
        // =================================

        webContents.on(
            "did-start-loading",
            () => {

                tab.loading = true;

                this.sendTabs();


                if (
                    tab.id ===
                    this.activeTabId
                ) {

                    this.window.webContents.send(
                        "browser-loading",
                        true
                    );

                }

            }
        );


        // =================================
        // TERMINOU DE CARREGAR
        // =================================

        webContents.on(
            "did-stop-loading",
            () => {

                tab.loading = false;

                this.sendTabs();


                if (
                    tab.id ===
                    this.activeTabId
                ) {

                    this.window.webContents.send(
                        "browser-loading",
                        false
                    );

                    this.sendTabUpdate(tab);

                    this.sendNavigationState(tab);

                }

            }
        );

    }


    // =====================================
    // ATIVAR ABA
    // =====================================

    activateTab(id) {

        const tab =
            this.tabs.find(
                tab => tab.id === id
            );


        if (!tab) {

            return;
        }


        this.activeTabId = id;


        for (
            const currentTab of this.tabs
        ) {

            currentTab.view.setVisible(
                currentTab.id === id
            );

        }


        this.updateBounds();


        this.sendTabUpdate(tab);

        this.sendTabs();

        this.sendNavigationState(tab);

    }


    // =====================================
    // FECHAR ABA
    // =====================================

    closeTab(id) {

        const index =
            this.tabs.findIndex(
                tab => tab.id === id
            );


        if (index === -1) {

            return;
        }


        const tab =
            this.tabs[index];


        // =================================
        // GUARDAR PARA "REABRIR ABA FECHADA"
        // (só páginas reais, não internas)
        // =================================

        if (!tab.internal) {

            this.closedTabs.push({

                url: tab.url,

                pinned: tab.pinned

            });


            if (
                this.closedTabs.length >
                this.maxClosedTabs
            ) {

                this.closedTabs.shift();

            }

        }


        this.window.contentView.removeChildView(
            tab.view
        );


        tab.view.webContents.close();


        this.tabs.splice(index, 1);


        // =================================
        // SE NÃO EXISTIR MAIS NENHUMA ABA
        // =================================

        if (this.tabs.length === 0) {

            this.createTab();

            return;
        }


        // =================================
        // SE FECHAMOS A ABA ATIVA
        // =================================

        if (
            this.activeTabId === id
        ) {

            const newIndex =
                Math.max(
                    0,
                    index - 1
                );


            this.activateTab(
                this.tabs[newIndex].id
            );

        } else {

            this.sendTabs();

        }

    }


    // =====================================
    // TROCAR ABA
    // =====================================

    switchTab(direction) {

        if (this.tabs.length <= 1) {
            return;
        }


        const currentIndex =
            this.tabs.findIndex(
                tab =>
                    tab.id ===
                    this.activeTabId
            );


        if (currentIndex === -1) {
            return;
        }


        let newIndex =
            currentIndex + direction;


        // =================================
        // VOLTAR PARA O FINAL
        // =================================

        if (newIndex < 0) {

            newIndex =
                this.tabs.length - 1;

        }


        // =================================
        // VOLTAR PARA O COMEÇO
        // =================================

        if (
            newIndex >=
            this.tabs.length
        ) {

            newIndex = 0;

        }


        this.activateTab(
            this.tabs[newIndex].id
        );

    }


    // =====================================
    // FIXAR / DESAFIXAR ABA
    // =====================================

    togglePin(id) {

        const tab =
            this.tabs.find(
                tab => tab.id === id
            );


        if (!tab) {

            return;
        }


        tab.pinned = !tab.pinned;


        // =================================
        // REPOSICIONAR: abas fixadas sempre
        // ficam no início, nessa ordem.
        // =================================

        const index =
            this.tabs.indexOf(tab);

        this.tabs.splice(index, 1);


        let insertAt = 0;

        while (
            insertAt < this.tabs.length &&
            this.tabs[insertAt].pinned
        ) {

            insertAt++;

        }


        this.tabs.splice(
            insertAt,
            0,
            tab
        );


        this.sendTabs();

    }


    // =====================================
    // REABRIR ÚLTIMA ABA FECHADA
    // =====================================

    reopenClosedTab() {

        if (this.closedTabs.length === 0) {

            return;
        }


        const entry =
            this.closedTabs.pop();


        const tab =
            this.createTab(entry.url);


        if (entry.pinned) {

            this.togglePin(tab.id);

        }

    }


    // =====================================
    // ABA ATIVA
    // =====================================

    getActiveTab() {

        return this.tabs.find(
            tab =>
                tab.id ===
                this.activeTabId
        );

    }


    // =====================================
    // PÁGINAS INTERNAS
    // =====================================

    openInternalPage(page, options = {}) {

        const tab =
            this.getActiveTab();


        if (!tab) {

            return;
        }


        if (page === "newtab") {

            tab.internal = true;

            tab.url = "saturnium://newtab";

            tab.title =
                "Nova aba - SaturniumBrowser";


            tab.view.webContents.loadFile(
                NEW_TAB_PAGE
            );


            this.sendTabUpdate(tab);

            this.sendTabs();

            return;
        }


        if (page === "history") {

            tab.internal = true;

            tab.url = "saturnium://history";

            tab.title =
                "Histórico - SaturniumBrowser";


            tab.view.webContents.loadFile(
                HISTORY_PAGE
            );


            // =============================
            // INJETAR OS DADOS DO HISTÓRICO
            // =============================

            tab.view.webContents.once(
                "did-finish-load",
                () => {

                    const entries =
                        typeof this.getHistory === "function"
                            ? this.getHistory()
                            : [];

                    tab.view.webContents.executeJavaScript(
                        `window.renderHistory(${JSON.stringify(entries)})`
                    ).catch(() => {});

                }
            );


            this.sendTabUpdate(tab);

            this.sendTabs();

            return;
        }

        if (page === "downloads") {

            tab.internal = true;

            tab.url = "saturnium://downloads";

            tab.title =
                "Downloads - SaturniumBrowser";


            tab.view.webContents.loadFile(
                DOWNLOADS_PAGE
            );


            tab.view.webContents.once(
                "did-finish-load",
                () => {

                    const entries =
                        typeof this.getDownloads === "function"
                            ? this.getDownloads()
                            : [];

                    tab.view.webContents.executeJavaScript(
                        `window.renderDownloads(${JSON.stringify(entries)})`
                    ).catch(() => {});

                }
            );


            this.sendTabUpdate(tab);

            this.sendTabs();

            return;
        }


        if (page === "search") {

            const query =
                options.query || "";


            tab.internal = true;

            tab.url =
                "saturnium://search?q=" +
                encodeURIComponent(query);

            tab.title =
                query
                    ? `${query} - Busca SaturniumBrowser`
                    : "Busca - SaturniumBrowser";


            tab.view.webContents.loadFile(
                SEARCH_PAGE
            );


            tab.view.webContents.once(
                "did-finish-load",
                async () => {

                    // Mostra o estado de
                    // carregamento imediatamente
                    tab.view.webContents.executeJavaScript(
                        `window.renderSearchLoading(${JSON.stringify(query)})`
                    ).catch(() => {});


                    let results = [];

                    let error = null;


                    try {

                        results =
                            typeof this.performSearch === "function"
                                ? await this.performSearch(query)
                                : [];

                    } catch (searchError) {

                        error =
                            "Não foi possível buscar agora. Verifique sua conexão e tente novamente.";

                    }


                    // A aba pode ter navegado
                    // para outro lugar enquanto
                    // a busca acontecia.
                    if (
                        tab.url !==
                        "saturnium://search?q=" + encodeURIComponent(query)
                    ) {

                        return;
                    }


                    tab.view.webContents.executeJavaScript(
                        `window.renderSearchResults(${JSON.stringify({ query, results, error })})`
                    ).catch(() => {});

                }
            );


            this.sendTabUpdate(tab);

            this.sendTabs();

            return;
        }


        if (page === "blocked") {

            const blockedUrl =
                options.url || "";


            tab.internal = true;

            tab.url =
                "saturnium://blocked?url=" +
                encodeURIComponent(blockedUrl);

            tab.title =
                "Aviso de segurança - SaturniumBrowser";


            tab.view.webContents.loadFile(
                BLOCKED_PAGE
            );


            tab.view.webContents.once(
                "did-finish-load",
                () => {

                    tab.view.webContents.executeJavaScript(
                        `window.renderSecurityWarning(${JSON.stringify({
                            url: blockedUrl,
                            reason: options.reason || "",
                            category: options.category || ""
                        })})`
                    ).catch(() => {});

                }
            );


            this.sendTabUpdate(tab);

            this.sendTabs();

            return;
        }

    }


    // =====================================
    // ABRIR HISTÓRICO EM NOVA ABA
    // =====================================

    openHistory() {

        this.createTab();

        this.openInternalPage(
            "history"
        );

    }


    // =====================================
    // ABRIR DOWNLOADS EM NOVA ABA
    // =====================================

    openDownloads() {

        this.createTab();

        this.openInternalPage(
            "downloads"
        );

    }


    // =====================================
    // CARREGAR URL REAL (com checagem
    // de segurança antes de navegar)
    // =====================================

    loadRealUrl(tab, url) {

        const safety =
            typeof this.checkUrlSafety === "function"
                ? this.checkUrlSafety(url)
                : { blocked: false };


        if (safety && safety.blocked) {

            this.openInternalPage(
                "blocked",
                {
                    url,
                    reason: safety.reason,
                    category: safety.category
                }
            );

            return;
        }


        tab.url = url;

        tab.view.webContents.loadURL(
            url
        );

    }


    // =====================================
    // NAVEGAR
    // =====================================

    navigate(input) {

        const tab =
            this.getActiveTab();


        if (!tab) {

            return;
        }


        let value =
            input.trim();


        if (!value) {

            return;
        }


        // =================================
        // PÁGINA INTERNA DO SATURNIUMBROWSER
        // =================================

        if (
            /^saturnium:\/\//i.test(value)
        ) {

            // =============================
            // BUSCA (usa query string, ex:
            // saturnium://search?q=algo)
            // =============================

            if (
                /^saturnium:\/\/search/i.test(value)
            ) {

                let query = "";

                try {

                    const parsedSearch =
                        new URL(value);

                    query =
                        parsedSearch.searchParams.get("q") ||
                        "";

                } catch (error) {

                    query = "";

                }


                this.openInternalPage(
                    "search",
                    { query }
                );

                return;
            }


            // =============================
            // CONTINUAR MESMO ASSIM APÓS
            // AVISO DE SEGURANÇA
            // (saturnium://blocked/continue?url=...)
            // =============================

            if (
                /^saturnium:\/\/blocked\/continue/i.test(value)
            ) {

                let targetUrl = "";

                try {

                    const parsedBlocked =
                        new URL(value);

                    targetUrl =
                        parsedBlocked.searchParams.get("url") ||
                        "";

                } catch (error) {

                    targetUrl = "";

                }


                if (!targetUrl) {

                    this.openInternalPage(
                        "newtab"
                    );

                    return;
                }


                try {

                    const hostname =
                        new URL(targetUrl).hostname;

                    if (
                        typeof this.allowUrlOnce === "function"
                    ) {

                        this.allowUrlOnce(
                            hostname
                        );

                    }

                } catch (error) {}


                this.loadRealUrl(
                    tab,
                    targetUrl
                );

                return;
            }


            const parts =
                value
                    .replace(
                        /^saturnium:\/\//i,
                        ""
                    )
                    .split("/");

            const page =
                (parts[0] || "")
                    .toLowerCase();

            const action =
                (parts[1] || "")
                    .toLowerCase();


            if (page === "newtab") {

                this.openInternalPage(
                    "newtab"
                );

                return;
            }


            if (page === "history") {

                // =============================
                // LIMPAR HISTÓRICO
                // =============================

                if (
                    action === "clear" &&
                    typeof this.clearHistory === "function"
                ) {

                    this.clearHistory();

                }


                this.openInternalPage(
                    "history"
                );

                return;
            }


            if (page === "downloads") {

                const downloadId =
                    Number(parts[2]);


                if (
                    action === "clear" &&
                    typeof this.clearDownloads === "function"
                ) {

                    this.clearDownloads();

                } else if (
                    action === "cancel" &&
                    typeof this.cancelDownload === "function"
                ) {

                    this.cancelDownload(
                        downloadId
                    );

                } else if (
                    action === "open" &&
                    typeof this.openDownloadFile === "function"
                ) {

                    this.openDownloadFile(
                        downloadId
                    );

                } else if (
                    action === "folder" &&
                    typeof this.showDownloadInFolder === "function"
                ) {

                    this.showDownloadInFolder(
                        downloadId
                    );

                }


                this.openInternalPage(
                    "downloads"
                );

                return;
            }


            // Página interna desconhecida
            // por enquanto volta para a nova aba.
            this.openInternalPage(
                "newtab"
            );

            return;
        }


        // A partir daqui é uma página normal.
        tab.internal = false;


        // =================================
        // URL COMPLETA
        // =================================

        if (
            /^https?:\/\//i.test(value)
        ) {

            this.loadRealUrl(tab, value);

            return;
        }


        // =================================
        // LOCALHOST
        // =================================

        if (
            /^localhost(?::\d+)?(?:\/.*)?$/i.test(value)
        ) {

            const url =
                "http://" + value;


            this.loadRealUrl(tab, url);

            return;
        }


        // =================================
        // ENDEREÇO IP
        // =================================

        if (
            /^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?(?:\/.*)?$/i.test(value)
        ) {

            const url =
                "http://" + value;


            this.loadRealUrl(tab, url);

            return;
        }


        // =================================
        // DOMÍNIO
        // =================================

        if (
            /^[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[/:?#].*)?$/i.test(value)
        ) {

            const url =
                "https://" + value;


            this.loadRealUrl(tab, url);

            return;
        }


        // =================================
        // PESQUISA (mecanismo próprio do
        // SaturniumBrowser — não depende do Google)
        // =================================

        this.openInternalPage(
            "search",
            { query: value }
        );

    }


    // =====================================
    // VOLTAR
    // =====================================

    back() {

        const tab =
            this.getActiveTab();


        if (
            tab &&
            tab.view.webContents.navigationHistory.canGoBack()
        ) {

            tab.view.webContents.goBack();

        }

    }


    // =====================================
    // AVANÇAR
    // =====================================

    forward() {

        const tab =
            this.getActiveTab();


        if (
            tab &&
            tab.view.webContents.navigationHistory.canGoForward()
        ) {

            tab.view.webContents.goForward();

        }

    }


    // =====================================
    // RECARREGAR
    // =====================================

    reload() {

        const tab =
            this.getActiveTab();


        if (!tab) {

            return;
        }


        tab.view.webContents.reload();

    }


    // =====================================
    // TAMANHO
    // =====================================

    updateBounds() {

        const bounds =
            this.window.getContentBounds();


        // Topbar: 45px
        // Abas:    42px
        // Toolbar: 55px
        //
        // Total: 142px

        const top = 142;

        const bottom =
            this.downloadsBarHeight || 0;


        for (
            const tab of this.tabs
        ) {

            tab.view.setBounds({

                x: 0,

                y: top,

                width: bounds.width,

                height:
                    Math.max(
                        0,
                        bounds.height - top - bottom
                    )

            });

        }

    }


    // =====================================
    // MOSTRAR/ESCONDER BARRA DE DOWNLOADS
    // =====================================

    setDownloadsBarVisible(visible) {

        // Precisa bater com a altura definida
        // em style.css (.downloads-bar)
        this.downloadsBarHeight =
            visible ? 52 : 0;

        this.updateBounds();

    }


    // =====================================
    // ATUALIZAR ABA ATIVA
    // =====================================

    sendTabUpdate(tab) {

        this.window.webContents.send(
            "active-tab-updated",
            {

                id: tab.id,

                title:
                    tab.title,

                url:
                    tab.url

            }
        );

    }


    // =====================================
    // LISTA DE ABAS
    // =====================================

    sendTabs() {

        this.window.webContents.send(
            "tabs-updated",
            {
                activeTabId: this.activeTabId,

                tabs: this.tabs.map(tab => ({

                    id: tab.id,

                    title: tab.title,

                    favicon: tab.favicon,

                    loading: tab.loading,

                    pinned: tab.pinned

                }))

            }
        );

    }


    // =====================================
    // ESTADO DA NAVEGAÇÃO
    // =====================================

    sendNavigationState(tab) {

        this.window.webContents.send(
            "navigation-state",
            {

                canGoBack:
                    tab.view.webContents.navigationHistory.canGoBack(),

                canGoForward:
                    tab.view.webContents.navigationHistory.canGoForward()

            }
        );

    }

}


module.exports = TabManager;