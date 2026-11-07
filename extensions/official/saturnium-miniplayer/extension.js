const HOST_RE = /^[a-z0-9.-]{3,253}$/;
const POSITIONS = {
    "top-right": "Canto superior direito",
    "top-left": "Canto superior esquerdo",
    "bottom-right": "Canto inferior direito",
    "bottom-left": "Canto inferior esquerdo"
};
const SUGGESTED = ["twitch.tv", "vimeo.com", "dailymotion.com"];
const DEFAULT_STATE = { hosts: ["youtube.com"], position: "top-right" };

function normHost(h) {
    const v = String(h || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
    if (!HOST_RE.test(v) || !v.includes(".")) throw new Error("Domínio inválido.");
    return v;
}

module.exports = {
    activate(api) {
        const store = api.storageAPI;
        const saved = store.get();
        const state = {
            hosts: Array.isArray(saved.hosts) ? saved.hosts.filter(h => HOST_RE.test(h)).slice(0, 50) : [...DEFAULT_STATE.hosts],
            position: POSITIONS[saved.position] ? saved.position : DEFAULT_STATE.position
        };

        const apply = () => state.hosts.length
            ? api.pip.enable({ hosts: state.hosts, position: state.position })
            : api.pip.disable();
        const save = () => store.set(state);
        const view = () => ({
            hosts: [...state.hosts],
            position: state.position,
            currentHost: api.tabs.activeHost(),
            positions: Object.entries(POSITIONS).map(([id, name]) => ({ id, name })),
            suggested: SUGGESTED.filter(h => !state.hosts.includes(h))
        });

        apply();

        return {
            methods: {
                getState: () => view(),
                addSite: host => {
                    const h = normHost(host);
                    if (!state.hosts.includes(h)) state.hosts.push(h);
                    apply(); save(); return view();
                },
                removeSite: host => {
                    const h = normHost(host);
                    state.hosts = state.hosts.filter(x => x !== h);
                    apply(); save(); return view();
                },
                setPosition: pos => {
                    if (!POSITIONS[pos]) throw new Error("Posição inválida.");
                    state.position = pos; apply(); save(); return view();
                },
                reset: () => { state.hosts = [...DEFAULT_STATE.hosts]; state.position = DEFAULT_STATE.position; apply(); save(); return view(); }
            },
            deactivate() { /* o host remove o botão das páginas ao desativar */ }
        };
    }
};
