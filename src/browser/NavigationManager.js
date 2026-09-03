class NavigationManager {

    constructor(tabManager) {

        this.tabManager =
            tabManager;

    }


    // =====================================
    // ABA ATIVA
    // =====================================

    getActiveTab() {

        return this.tabManager.getActiveTab();

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


        this.tabManager.navigate(
            input
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
            tab.view.webContents.canGoBack()
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
            tab.view.webContents.canGoForward()
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
    // PODE VOLTAR?
    // =====================================

    canGoBack() {

        const tab =
            this.getActiveTab();


        return !!(
            tab &&
            tab.view.webContents.canGoBack()
        );

    }


    // =====================================
    // PODE AVANÇAR?
    // =====================================

    canGoForward() {

        const tab =
            this.getActiveTab();


        return !!(
            tab &&
            tab.view.webContents.canGoForward()
        );

    }

}


module.exports =
    NavigationManager;