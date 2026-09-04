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


class BrowserManager {

    constructor(window) {

        this.window = window;

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
        // GERENCIADOR DE ABAS
        // =====================================

        this.tabManager =
            new TabManager(
                window,
                {

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
                        this.search.search(query)

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

                }

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