const { session } = require("electron");

const TabManager =
    require("./TabManager");

const NavigationManager =
    require("./NavigationManager");

const HistoryManager =
    require("../history/HistoryManager");

const DownloadManager =
    require("../downloads/DownloadManager");

const SearchManager =
    require("../search/SearchManager");

const SecurityManager =
    require("../security/SecurityManager");

const AIManager =
    require("../ai/AIManager");


const ExtensionManager = require("../extensions/ExtensionManager");

class BrowserManager {

    constructor(window) {

        this.window = window;

        this.extensions = new ExtensionManager({
            getWindow: () => this.window,
            getInternalContents: () =>
                this.tabManager
                    ? this.tabManager.tabs
                        .filter(tab => tab.internal)
                        .map(tab => tab.view.webContents)
                    : []
        });

        // =====================================
        // GERENCIADOR DE HISTÓRICO
        // =====================================

        this.history =
            new HistoryManager();

        // =====================================
        // MECANISMO DE BUSCA
        // =====================================

        this.search = new SearchManager();

        // =====================================
        // SATURNIUM AI
        // =====================================

        this.ai = new AIManager();

        // =====================================
        // SEGURANÇA
        // =====================================

        this.security = new SecurityManager();

        // =====================================
        // GERENCIADOR DE ABAS
        // =====================================

        this.tabManager =
            new TabManager(
                window,
                {

                    onInternalPageLoaded: (webContents) => {
                        this.extensions.host.applyTo(webContents);
                    },

                    onNavigate: (url, title, favicon) => {
                        this.history.add(url, title, favicon);
                    },

                    onFaviconUpdate: (url, favicon) => {
                        this.history.updateFavicon(url, favicon);
                    },

                    getHistory: () =>
                        this.history.getAll(),

                    clearHistory: () =>
                        this.history.clear(),

                    getDownloads: () =>
                        this.downloads.getAll(),

                    clearDownloads: () =>
                        this.downloads.clear(),

                    cancelDownload: (id) =>
                        this.downloads.cancel(id),

                    openDownloadFile: (id) =>
                        this.downloads.openFile(id),

                    showDownloadInFolder: (id) =>
                        this.downloads.showInFolder(id),

                    performSearch: (query) =>
                        this.search.search(query),

                    performSearchTab: (type, query) =>
                        this.runSearchTab(type, query),

                    checkUrlSafety: (url) =>
                        this.security.check(url),

                    allowUrlOnce: (hostname) =>
                        this.security.allowOnce(hostname)

                }
            );

        // =====================================
        // GERENCIADOR DE DOWNLOADS
        // =====================================

        this.downloadsBarVisible = false;

        this.downloads =
            new DownloadManager({

                onNewDownload: () => {

                    this.downloadsBarVisible = true;

                    this.tabManager.setDownloadsBarVisible(
                        true
                    );

                    this.sendDownloadsUpdate();

                },

                onChange: () => {

                    this.sendDownloadsUpdate();

                },

                checkDownloadRisk: (url, filename) =>
                    this.security.checkDownload(url, filename)

            });


        session.defaultSession.on(
            "will-download",
            (event, item) => {

                this.downloads.handleWillDownload(
                    item
                );

            }
        );

        // =====================================
        // GERENCIADOR DE NAVEGAÇÃO
        // =====================================

        this.navigation =
            new NavigationManager(
                this.tabManager
            );
    }


    // =====================================
    // INICIALIZAÇÃO
    // =====================================

    initialize() {

        this.extensions.initialize();

        this.tabManager.createTab();

    }


    // =====================================
    // ABAS
    // =====================================

    createTab(url = null) {

        return this.tabManager.createTab(
            url
        );

    }


    closeTab(id) {

        this.tabManager.closeTab(id);

    }


    activateTab(id) {

        this.tabManager.activateTab(id);

    }


    getActiveTab() {

        return this.tabManager.getActiveTab();

    }


    // =====================================
    // NAVEGAÇÃO
    // =====================================

    navigate(url) {

        this.navigation.navigate(url);

    }


    back() {

        this.navigation.back();

    }


    forward() {

        this.navigation.forward();

    }


    reload() {

        this.navigation.reload();

    }


    // =====================================
    // PARAR CARREGAMENTO
    // =====================================

    stop() {

        const tab =
            this.tabManager.getActiveTab();

        if (!tab) {

            return;

        }

        tab.view.webContents.stop();

    }


    // =====================================
    // ESTADO DA NAVEGAÇÃO
    // =====================================

    getNavigationState() {

        return {

            canGoBack:
                this.navigation.canGoBack(),

            canGoForward:
                this.navigation.canGoForward()

        };

    }


    // =====================================
    // TROCAR DE ABA
    // =====================================

    switchTab(direction) {

        const tabs =
            this.tabManager.tabs;


        if (tabs.length <= 1) {

            return;

        }


        const currentIndex =
            tabs.findIndex(
                tab =>
                    tab.id ===
                    this.tabManager.activeTabId
            );


        let newIndex =
            currentIndex + direction;


        if (newIndex >= tabs.length) {

            newIndex = 0;

        }


        if (newIndex < 0) {

            newIndex =
                tabs.length - 1;

        }


        this.activateTab(
            tabs[newIndex].id
        );

    }


    // =====================================
    // HISTÓRICO
    // =====================================

    getHistory() {

        return this.history.getAll();

    }


    clearHistory() {

        this.history.clear();

    }


    openHistory() {

        this.tabManager.openHistory();

    }


    // =====================================
    // FIXAR ABA / REABRIR ABA FECHADA
    // =====================================

    togglePinTab(id) {

        this.tabManager.togglePin(id);

    }


    reopenClosedTab() {

        this.tabManager.reopenClosedTab();

    }


    // =====================================
    // DOWNLOADS
    // =====================================

    sendDownloadsUpdate() {

        this.window.webContents.send(
            "downloads-updated",
            {

                downloads:
                    this.downloads.getAll(),

                barVisible:
                    this.downloadsBarVisible

            }
        );

    }


    openDownloads() {

        this.tabManager.openDownloads();

    }


    openExtensions() {

        this.tabManager.openExtensions();

    }

    openAI() {

        return this.tabManager.openAI();

    }

    // =====================================
    // BUSCA POR ABA (Tudo / Modo IA /
    // Imagens / Vídeos / Notícias / Maps)
    // =====================================

    async runSearchTab(type, query) {

        if (type === "ai") {

            return this.answerWithAI(query);
        }

        return this.search.searchByType(type, query);

    }

    // Modo IA: busca na web, entrega as melhores fontes ao
    // modelo configurado e devolve resposta + fontes numeradas.
    async answerWithAI(query) {

        const sources =
            (await this.search.search(query)).slice(0, 6);

        const context =
            sources
                .map((s, i) =>
                    `[${i + 1}] ${s.title}\n${s.url}\n${(s.snippet || "").slice(0, 400)}`
                )
                .join("\n\n");

        const messages = [
            {
                role: "system",
                content:
                    "Você é o Modo IA do SaturniumBrowser. Responda em português do Brasil, " +
                    "de forma direta e organizada, usando APENAS as fontes fornecidas. " +
                    "Cite as fontes no texto como [1], [2]. Se as fontes não bastarem, " +
                    "diga isso claramente em vez de inventar. Sem enrolação."
            },
            {
                role: "user",
                content:
                    `Pergunta: ${String(query).slice(0, 500)}\n\nFontes:\n${context}`.slice(0, 11500)
            }
        ];

        let reply;

        try {

            reply =
                await this.ai.chat(
                    messages,
                    { temperature: 0.3, maxTokens: 900 }
                );

        } catch (error) {

            const wrapped =
                new Error(error?.message || "AI_ERROR");

            wrapped.code = "AI_ERROR";
            wrapped.sources = sources;

            throw wrapped;
        }

        return {
            answer: reply.content,
            provider: reply.provider,
            model: reply.model,
            sources
        };

    }


    isAIWebContents(webContents) {

        return this.tabManager.isAIWebContents(webContents);

    }

    isExtensionsWebContents(webContents) {

        return this.tabManager.isExtensionsWebContents(webContents);

    }

    openExtensionSettings(id) {

        const file = this.extensions.settingsFile(id);

        if (!file) {
            return false;
        }

        this.tabManager.openExtensionPage(id, file);

        return true;

    }


    closeDownloadsBar() {

        this.downloadsBarVisible = false;

        this.tabManager.setDownloadsBarVisible(
            false
        );

        this.sendDownloadsUpdate();

    }


    cancelDownload(id) {

        this.downloads.cancel(id);

    }


    openDownloadFile(id) {

        this.downloads.openFile(id);

    }


    showDownloadInFolder(id) {

        this.downloads.showInFolder(id);

    }


    // =====================================
    // REDIMENSIONAMENTO
    // =====================================

    updateBounds() {

        this.tabManager.updateBounds();

    }

}


module.exports = BrowserManager;