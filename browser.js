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

const downloadsBar =
    document.getElementById("downloads-bar");

const downloadsBarList =
    document.getElementById("downloads-bar-list");

const downloadsBarCloseButton =
    document.getElementById("downloads-bar-close");

const downloadsBarOpenAllButton =
    document.getElementById("downloads-bar-open-all");


// =====================================
// MENU (TRÊS PONTINHOS)
// Usa o menu nativo do sistema operacional,
// para não ficar cortado pela área da aba.
// =====================================

menuButton.addEventListener(
    "click",
    () => {

        window.browserAPI.showMainMenu();

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


        if (tab.pinned) {

            tabElement.classList.add(
                "pinned"
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
            "assets/saturniumbrowser-icon.png";

        favicon.onerror = () => {

            favicon.src =
                "assets/saturniumbrowser-icon.png";

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
        // MENU DE CONTEXTO (CLIQUE DIREITO)
        // =================================

        tabElement.addEventListener(
            "contextmenu",
            (event) => {

                event.preventDefault();

                window.browserAPI
                    .showTabContextMenu({

                        id: tab.id,

                        pinned:
                            !!tab.pinned

                    });

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


    updateSecurityIndicator(
        tab.url || ""
    );

}


// =====================================
// INDICADOR DE SEGURANÇA (HTTPS/HTTP)
// =====================================

const securityIndicator =
    document.getElementById("security-indicator");


function updateSecurityIndicator(url) {

    securityIndicator.classList.remove(
        "secure",
        "insecure"
    );


    if (url.startsWith("https://")) {

        securityIndicator.textContent = "🔒";

        securityIndicator.title =
            "Conexão segura (HTTPS)";

        securityIndicator.classList.add(
            "secure"
        );

        return;
    }


    if (url.startsWith("http://")) {

        securityIndicator.textContent = "⚠";

        securityIndicator.title =
            "Conexão não segura (HTTP) — evite inserir senhas ou dados sensíveis";

        securityIndicator.classList.add(
            "insecure"
        );

        return;
    }

    // Páginas internas (saturnium://) e
    // outros casos: sem indicador.
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
// BARRA DE DOWNLOADS
// =====================================

function formatBytes(bytes) {

    if (!bytes || bytes <= 0) {
        return "0 KB";
    }

    const units = ["B", "KB", "MB", "GB"];

    let value = bytes;

    let i = 0;

    while (
        value >= 1024 &&
        i < units.length - 1
    ) {

        value /= 1024;

        i++;

    }

    return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;

}


function downloadStatusText(entry) {

    if (entry.state === "progressing") {

        const percent =
            entry.totalBytes > 0
                ? Math.round(
                    (entry.receivedBytes / entry.totalBytes) * 100
                )
                : null;

        return percent !== null
            ? `${percent}% de ${formatBytes(entry.totalBytes)}`
            : formatBytes(entry.receivedBytes);

    }

    if (entry.state === "completed") {

        return `Concluído • ${formatBytes(entry.totalBytes)}`;

    }

    if (entry.state === "cancelled") {

        return "Cancelado";

    }

    return "Interrompido";

}


function downloadIcon(entry) {

    if (entry.state === "progressing") {
        return "⬇";
    }

    if (entry.state === "completed") {
        return "✓";
    }

    return "✕";

}


function renderDownloadsBar(data) {

    const downloads =
        data.downloads || [];

    downloadsBarList.innerHTML = "";


    // Mostra só os mais recentes na barrinha
    const recent =
        downloads.slice(0, 6);

    for (const entry of recent) {

        const chip =
            document.createElement("div");

        chip.className =
            "download-chip";


        const icon =
            document.createElement("span");

        icon.className =
            "download-chip-icon";

        icon.textContent =
            downloadIcon(entry);


        const info =
            document.createElement("div");

        info.className =
            "download-chip-info";


        const name =
            document.createElement("div");

        name.className =
            "download-chip-name";

        name.textContent =
            entry.filename || "arquivo";

        name.title =
            entry.filename || "";


        const sub =
            document.createElement("div");

        sub.className =
            "download-chip-sub";

        sub.textContent =
            downloadStatusText(entry);


        info.appendChild(name);
        info.appendChild(sub);

        chip.appendChild(icon);
        chip.appendChild(info);


        if (entry.state === "progressing") {

            const cancel =
                document.createElement("button");

            cancel.className =
                "download-chip-cancel";

            cancel.type = "button";

            cancel.textContent = "×";

            cancel.title = "Cancelar";

            cancel.addEventListener(
                "click",
                (event) => {

                    event.stopPropagation();

                    window.browserAPI
                        .cancelDownload(entry.id);

                }
            );

            chip.appendChild(cancel);

        }


        chip.addEventListener(
            "click",
            () => {

                if (entry.state === "completed") {

                    window.browserAPI
                        .openDownloadFile(entry.id);

                }

            }
        );


        downloadsBarList.appendChild(
            chip
        );

    }


    if (data.barVisible) {

        downloadsBar.classList.add(
            "visible"
        );

    } else {

        downloadsBar.classList.remove(
            "visible"
        );

    }

}


downloadsBarCloseButton.addEventListener(
    "click",
    () => {

        window.browserAPI.closeDownloadsBar();

    }
);


downloadsBarOpenAllButton.addEventListener(
    "click",
    () => {

        window.browserAPI.openDownloads();

    }
);


window.browserAPI.onDownloadsUpdated(
    (data) => {

        renderDownloadsBar(data);

    }
);


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

// =====================================
// ATUALIZAÇÕES DO SATURNIUMBROWSER
// =====================================

let updateToast = null;
let updateTitle = null;
let updateMessage = null;
let updateProgress = null;
let updateButton = null;
let updateCloseButton = null;


function createUpdateToast() {

    if (updateToast) {
        return;
    }

    updateToast = document.createElement("div");
    updateToast.id = "update-toast";
    updateToast.className = "update-toast";

    const header = document.createElement("div");
    header.className = "update-toast-header";

    updateTitle = document.createElement("div");
    updateTitle.className = "update-toast-title";

    updateCloseButton = document.createElement("button");
    updateCloseButton.className = "update-toast-close";
    updateCloseButton.type = "button";
    updateCloseButton.textContent = "×";
    updateCloseButton.title = "Fechar";

    updateCloseButton.addEventListener("click", () => {
        hideUpdateToast();
    });

    header.appendChild(updateTitle);
    header.appendChild(updateCloseButton);

    updateMessage = document.createElement("div");
    updateMessage.className = "update-toast-message";

    updateProgress = document.createElement("div");
    updateProgress.className = "update-progress";

    const progressBar = document.createElement("div");
    progressBar.className = "update-progress-bar";
    updateProgress.appendChild(progressBar);
    updateProgress._bar = progressBar;

    updateButton = document.createElement("button");
    updateButton.className = "update-install-button";
    updateButton.type = "button";
    updateButton.textContent = "Reiniciar e atualizar";
    updateButton.style.display = "none";

    updateButton.addEventListener("click", () => {
        updateButton.disabled = true;
        updateButton.textContent = "Reiniciando...";
        window.browserAPI.update.install();
    });

    updateToast.appendChild(header);
    updateToast.appendChild(updateMessage);
    updateToast.appendChild(updateProgress);
    updateToast.appendChild(updateButton);

    document.body.appendChild(updateToast);
}


function showUpdateToast(title, message, options = {}) {

    createUpdateToast();

    updateTitle.textContent = title;

    updateMessage.textContent = message;
    updateMessage.title = message;

    updateProgress.style.display =
        options.progress === undefined ? "none" : "block";

    if (options.progress !== undefined) {
        updateProgress._bar.style.width =
            `${Math.max(0, Math.min(100, options.progress))}%`;
    }

    updateButton.style.display =
        options.install ? "block" : "none";

    updateButton.disabled = false;
    updateButton.textContent = "Reiniciar e atualizar";

    updateToast.classList.add("visible");
}


function hideUpdateToast() {

    if (!updateToast) {
        return;
    }

    updateToast.classList.remove("visible");
}


window.browserAPI.update.onChecking(() => {

    // O início da verificação não precisa interromper o usuário.

});


window.browserAPI.update.onAvailable((data) => {

    const version =
        data && data.version
            ? data.version
            : "nova versão";

    showUpdateToast(
        "Atualização disponível",
        `SaturniumBrowser ${version} está sendo baixado...`,
        {
            progress: 0
        }
    );

});


window.browserAPI.update.onNotAvailable((data) => {

    if (!data || !data.manual) {

        return;
    }


    showUpdateToast(
        "Tudo certo",
        `Você já está usando a versão mais recente${
            data.version ? " (" + data.version + ")" : ""
        }.`,
        {}
    );

    setTimeout(() => {

        hideUpdateToast();

    }, 4000);

});


window.browserAPI.update.onProgress((data) => {

    const percent =
        data && Number.isFinite(data.percent)
            ? data.percent
            : 0;

    showUpdateToast(
        "Baixando atualização",
        `SaturniumBrowser ${percent.toFixed(0)}% concluído.`,
        {
            progress: percent
        }
    );

});


window.browserAPI.update.onDownloaded((data) => {

    const version =
        data && data.version
            ? data.version
            : "nova versão";

    showUpdateToast(
        "Atualização pronta",
        `A versão ${version} foi baixada e está pronta para instalação.`,
        {
            install: true
        }
    );

});


window.browserAPI.update.onError((data) => {

    const message =
        data && data.message
            ? data.message
            : "Não foi possível verificar a atualização.";

    showUpdateToast(
        "Falha na atualização",
        message,
        {}
    );

    setTimeout(() => {

        hideUpdateToast();

    }, 10000);

});
