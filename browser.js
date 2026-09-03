const urlInput =
    document.getElementById("url");

const backButton =
    document.getElementById("back");

const forwardButton =
    document.getElementById("forward");

const reloadButton =
    document.getElementById("reload");

const newTabButton =
    document.getElementById("new-tab");

const tabsContainer =
    document.getElementById("tabs");

const minimizeButton =
    document.getElementById("minimize-window");

const maximizeButton =
    document.getElementById("maximize-window");

const closeButton =
    document.getElementById("close-window");

const menuButton =
    document.getElementById("menu");

const menuDropdown =
    document.getElementById("menu-dropdown");

const menuHistoryItem =
    document.getElementById("menu-history");


// =====================================
// MENU (TRÊS PONTINHOS)
// =====================================

menuButton.addEventListener(
    "click",
    (event) => {

        event.stopPropagation();

        menuDropdown.classList.toggle(
            "open"
        );

    }
);


menuHistoryItem.addEventListener(
    "click",
    () => {

        window.browserAPI.openHistory();

        menuDropdown.classList.remove(
            "open"
        );

    }
);


// Fecha o menu ao clicar fora dele
document.addEventListener(
    "click",
    () => {

        menuDropdown.classList.remove(
            "open"
        );

    }
);


// =====================================
// BOTÕES SUPERIORES
// =====================================

minimizeButton.addEventListener("click", () => {
    window.browserAPI.minimizeWindow();
});


maximizeButton.addEventListener("click", () => {
    window.browserAPI.maximizeWindow();
});


closeButton.addEventListener("click", () => {
    window.browserAPI.closeWindow();
});


// =====================================
// NAVEGAÇÃO
// =====================================

function navigate() {

    const url =
        urlInput.value.trim();

    if (!url) {
        return;
    }

    window.browserAPI.navigate(url);
}


// =====================================
// BARRA DE ENDEREÇO
// =====================================

urlInput.addEventListener(
    "keydown",
    (event) => {

        if (event.key === "Enter") {

            navigate();

            // Tira o foco da barra
            urlInput.blur();
        }

    }
);


// =====================================
// CTRL + L
// =====================================

window.browserAPI.onFocusAddressBar(
    () => {

        urlInput.focus();

        urlInput.select();

    }
);


// =====================================
// BOTÃO VOLTAR
// =====================================

backButton.addEventListener(
    "click",
    () => {

        window.browserAPI.back();

    }
);


// =====================================
// BOTÃO AVANÇAR
// =====================================

forwardButton.addEventListener(
    "click",
    () => {

        window.browserAPI.forward();

    }
);


// =====================================
// RECARREGAR / PARAR
// =====================================

reloadButton.addEventListener(
    "click",
    () => {

        if (
            reloadButton.dataset.loading ===
            "true"
        ) {

            window.browserAPI.stop();

        } else {

            window.browserAPI.reload();

        }

    }
);


// =====================================
// NOVA ABA
// =====================================

newTabButton.addEventListener(
    "click",
    () => {

        window.browserAPI.newTab();

    }
);


// =====================================
// ABAS
// =====================================

let activeTabId = null;


function renderTabs(data) {

    tabsContainer.innerHTML = "";

    activeTabId =
        data.activeTabId;

    const tabs =
        data.tabs || [];

    for (const tab of tabs) {

        const tabElement =
            document.createElement("div");

        tabElement.className = "tab";

        tabElement.dataset.id =
            tab.id;


        if (
            tab.id ===
            activeTabId
        ) {

            tabElement.classList.add(
                "active"
            );

        }


        // =================================
        // FAVICON
        // =================================

        const favicon =
            document.createElement("img");

        favicon.className =
            "tab-favicon";

        favicon.src =
            tab.favicon ||
            "assets/voidbrowser-icon.png";

        favicon.onerror = () => {

            favicon.src =
                "assets/voidbrowser-icon.png";

        };


        if (tab.loading) {

            favicon.classList.add(
                "loading"
            );

        }


        // =================================
        // TÍTULO
        // =================================

        const title =
            document.createElement("span");

        title.className =
            "tab-title";

        title.textContent =
            tab.title ||
            "Nova aba";


        // =================================
        // BOTÃO FECHAR
        // =================================

        const closeButton =
            document.createElement("button");

        closeButton.className =
            "tab-close";

        closeButton.textContent =
            "×";

        closeButton.title =
            "Fechar aba";


        // =================================
        // CLICAR NA ABA
        // =================================

        tabElement.addEventListener(
            "click",
            () => {

                window.browserAPI
                    .activateTab(tab.id);

            }
        );


        // =================================
        // FECHAR ABA
        // =================================

        closeButton.addEventListener(
            "click",
            (event) => {

                event.stopPropagation();

                window.browserAPI
                    .closeTab(tab.id);

            }
        );


        tabElement.appendChild(
            favicon
        );

        tabElement.appendChild(
            title
        );

        tabElement.appendChild(
            closeButton
        );

        tabsContainer.appendChild(
            tabElement
        );

    }

}


// =====================================
// ABA ATIVA
// =====================================

function updateActiveTab(tab) {

    const allTabs =
        document.querySelectorAll(
            ".tab"
        );


    allTabs.forEach(
        element => {

            element.classList.remove(
                "active"
            );

        }
    );


    const active =
        document.querySelector(
            `.tab[data-id="${tab.id}"]`
        );


    if (active) {

        active.classList.add(
            "active"
        );

    }


    urlInput.value =
        tab.url || "";

}


// =====================================
// ESTADO DA NAVEGAÇÃO
// =====================================

function updateNavigationState(
    state
) {

    backButton.disabled =
        !state.canGoBack;

    forwardButton.disabled =
        !state.canGoForward;

}


// =====================================
// CARREGAMENTO
// =====================================

function updateLoading(
    loading
) {

    reloadButton.dataset.loading =
        loading
            ? "true"
            : "false";


    if (loading) {

        reloadButton.textContent =
            "×";

        reloadButton.title =
            "Parar carregamento";

    } else {

        reloadButton.textContent =
            "⟳";

        reloadButton.title =
            "Recarregar";

    }

}


// =====================================
// EVENTOS DO BROWSER
// =====================================

window.browserAPI.onTabsUpdated(
    (data) => {

        renderTabs(data);

    }
);


window.browserAPI.onActiveTabUpdated(
    (tab) => {

        updateActiveTab(tab);

    }
);


window.browserAPI.onNavigationState(
    (state) => {

        updateNavigationState(
            state
        );

    }
);


window.browserAPI.onLoading(
    (loading) => {

        updateLoading(
            loading
        );

    }
);