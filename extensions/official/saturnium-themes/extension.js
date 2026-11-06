const HEX = /^#[0-9a-f]{6}$/i;

const THEMES = {
    saturnium: {
        name: "Saturnium",
        vars: {}  // padrão: usa as cores originais do style.css
    },
    midnight: {
        name: "Meia-noite",
        vars: {
            "chrome-bg": "#0b1220", "toolbar-bg": "#101a2e", "surface": "#1b2a47",
            "button": "#16233d", "button-hover": "#22345a", "content-bg": "#070c17",
            "tabs-bg": "#060a14", "tab-bg": "#0a1220", "tab-hover": "#101c33",
            "tab-active": "#14233f", "accent": "#4da3ff", "text-muted": "#8ea2c4"
        }
    },
    nebula: {
        name: "Nebulosa",
        vars: {
            "chrome-bg": "#1a1028", "toolbar-bg": "#22143a", "surface": "#35205a",
            "button": "#2b1a49", "button-hover": "#3d2768", "content-bg": "#120a1f",
            "tabs-bg": "#0e0818", "tab-bg": "#160d27", "tab-hover": "#201238",
            "tab-active": "#2a1850", "accent": "#d45cff", "text-muted": "#b6a3d6"
        }
    },
    saturn: {
        name: "Saturno",
        vars: {
            "chrome-bg": "#1c1710", "toolbar-bg": "#251d12", "surface": "#3a2d1a",
            "button": "#30251a", "button-hover": "#463621", "content-bg": "#130f09",
            "tabs-bg": "#0f0b07", "tab-bg": "#17120b", "tab-hover": "#21190f",
            "tab-active": "#2c2112", "accent": "#ffb347", "text-muted": "#c4b08a"
        }
    },
    forest: {
        name: "Floresta",
        vars: {
            "chrome-bg": "#0f1a16", "toolbar-bg": "#14231d", "surface": "#1f3a2f",
            "button": "#1a2f26", "button-hover": "#264a3b", "content-bg": "#09120f",
            "tabs-bg": "#070e0b", "tab-bg": "#0c1612", "tab-hover": "#12221b",
            "tab-active": "#183026", "accent": "#4ade80", "text-muted": "#8fb5a2"
        }
    }
};

const WALLPAPERS = {
    aurora: { name: "Aurora", type: "gradient", angle: 135, colors: ["#0f2027", "#203a43", "#2c5364"] },
    cosmos: { name: "Cosmos", type: "gradient", angle: 160, colors: ["#0f0c29", "#302b63", "#24243e"] },
    sunset: { name: "Pôr do sol", type: "gradient", angle: 150, colors: ["#2b1055", "#7597de"] },
    ember: { name: "Brasa", type: "gradient", angle: 135, colors: ["#1f1c18", "#8e2c0f"] }
};

const DEFAULT_STATE = { themeId: "saturnium", accent: null, wallpaperId: null, wallpaperImage: null };

module.exports = {
    activate(api) {
        const store = api.storageAPI;
        let state = { ...DEFAULT_STATE, ...store.get() };
        if (!THEMES[state.themeId]) state.themeId = "saturnium";
        if (state.wallpaperId && !WALLPAPERS[state.wallpaperId]) state.wallpaperId = null;

        function apply() {
            const vars = { ...THEMES[state.themeId].vars };
            if (state.accent && HEX.test(state.accent)) vars.accent = state.accent;
            api.theme.apply(vars);

            if (state.wallpaperImage) {
                api.newtab.setWallpaper({ type: "image", dataUrl: state.wallpaperImage });
            } else if (state.wallpaperId) {
                const { type, angle, colors } = WALLPAPERS[state.wallpaperId];
                api.newtab.setWallpaper({ type, angle, colors });
            } else {
                api.newtab.clearWallpaper();
            }
        }

        function save() { store.set(state); }

        function publicState() {
            return {
                themeId: state.themeId,
                accent: state.accent,
                wallpaperId: state.wallpaperId,
                hasCustomImage: !!state.wallpaperImage,
                themes: Object.entries(THEMES).map(([id, t]) => ({
                    id, name: t.name,
                    colors: [t.vars["chrome-bg"] || "#181818", t.vars["tab-active"] || "#171b29", t.vars.accent || "#7c5cff"]
                })),
                wallpapers: Object.entries(WALLPAPERS).map(([id, w]) => ({ id, name: w.name, colors: w.colors, angle: w.angle }))
            };
        }

        apply();

        return {
            methods: {
                getState: () => publicState(),
                setTheme: id => {
                    if (!THEMES[id]) throw new Error("Tema inválido.");
                    state.themeId = id; apply(); save(); return publicState();
                },
                setAccent: color => {
                    if (color !== null && !HEX.test(color)) throw new Error("Cor inválida.");
                    state.accent = color; apply(); save(); return publicState();
                },
                setWallpaper: id => {
                    if (id !== null && !WALLPAPERS[id]) throw new Error("Wallpaper inválido.");
                    state.wallpaperId = id; state.wallpaperImage = null; apply(); save(); return publicState();
                },
                pickWallpaper: async () => {
                    const dataUrl = await api.newtab.pickImage();
                    if (dataUrl) { state.wallpaperImage = dataUrl; state.wallpaperId = null; apply(); save(); }
                    return publicState();
                },
                reset: () => {
                    state = { ...DEFAULT_STATE }; apply(); save(); return publicState();
                }
            },
            deactivate() { /* o host remove tema e wallpaper ao desativar */ }
        };
    }
};
