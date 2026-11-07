const PRESETS = {
    dark: "Escuro",
    dim: "Reduzir brilho",
    sepia: "Sépia (leitura)",
    grayscale: "Tons de cinza",
    contrast: "Mais contraste"
};
const HOST_RE = /^[a-z0-9.-]{1,253}$/;
const DEFAULT_STATE = { preset: null, exclude: [] };

function normHost(h) {
    const v = String(h || "").trim().toLowerCase().replace(/^www\./, "");
    if (!HOST_RE.test(v)) throw new Error("Domínio inválido.");
    return v;
}

module.exports = {
    activate(api) {
        const store = api.storageAPI;
        const saved = store.get();
        let state = {
            preset: PRESETS[saved.preset] ? saved.preset : null,
            exclude: Array.isArray(saved.exclude) ? saved.exclude.filter(h => HOST_RE.test(h)).slice(0, 200) : []
        };

        const apply = () => state.preset
            ? api.pages.setStyle({ preset: state.preset, excludeHosts: state.exclude })
            : api.pages.clearStyle();
        const save = () => store.set(state);
        const view = () => ({
            preset: state.preset,
            exclude: [...state.exclude],
            currentHost: api.tabs.activeHost(),
            presets: Object.entries(PRESETS).map(([id, name]) => ({ id, name }))
        });

        apply();

        return {
            methods: {
                getState: () => view(),
                setPreset: id => {
                    if (id !== null && !PRESETS[id]) throw new Error("Filtro inválido.");
                    state.preset = id; apply(); save(); return view();
                },
                exclude: host => {
                    const h = normHost(host);
                    if (!state.exclude.includes(h)) state.exclude.push(h);
                    apply(); save(); return view();
                },
                include: host => {
                    const h = normHost(host);
                    state.exclude = state.exclude.filter(x => x !== h);
                    apply(); save(); return view();
                },
                reset: () => { state = { ...DEFAULT_STATE, exclude: [] }; apply(); save(); return view(); }
            },
            deactivate() { /* o host remove os estilos ao desativar */ }
        };
    }
};
