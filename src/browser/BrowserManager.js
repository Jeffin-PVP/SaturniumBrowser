const TabManager =
    require("./TabManager");

const NavigationManager =
    require("./NavigationManager");

const HistoryManager =
    require("../history/HistoryManager");


class BrowserManager {

    constructor(window) {

        this.window = window;

        // =====================================
        // GERENCIADOR DE HISTÓRICO
        // =====================================

        this.history =
            new HistoryManager();

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
                        this.history.clear()

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
    // REDIMENSIONAMENTO
    // =====================================

    updateBounds() {

        this.tabManager.updateBounds();

    }

}


module.exports = BrowserManager;