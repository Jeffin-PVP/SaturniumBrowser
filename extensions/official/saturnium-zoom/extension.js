const HOST_RE = /^[a-z0-9.-]{1,253}$/;

function normHost(h) {
    const v = String(h || "").trim().toLowerCase().replace(/^www\./, "");
    if (!HOST_RE.test(v)) throw new Error("Domínio inválido.");
    return v;
}
function normFactor(f) {
    const n = Number(f);
    if (!Number.isFinite(n) || n < 0.5 || n > 3) throw new Error("Zoom deve ficar entre 50% e 300%.");
    return Math.round(n * 100) / 100;
}

module.exports = {
    activate(api) {
        const store = api.storageAPI;
        const saved = store.get();
        const sites = {};
        if (saved.sites && typeof saved.sites === "object") {
            for (const [h, f] of Object.entries(saved.sites).slice(0, 500)) {
                try { sites[normHost(h)] = normFactor(f); } catch { /* ignora entrada inválida */ }
            }
        }

        const apply = () => api.zoom.set(sites);
        const save = () => store.set({ sites });
        const view = () => ({
            currentHost: api.tabs.activeHost(),
            sites: Object.entries(sites).map(([host, factor]) => ({ host, factor })).sort((a, b) => a.host.localeCompare(b.host))
        });

        apply();

        return {
            methods: {
                getState: () => view(),
                setSite: ({ host, factor } = {}) => {
                    sites[normHost(host)] = normFactor(factor); apply(); save(); return view();
                },
                removeSite: host => { delete sites[normHost(host)]; apply(); save(); return view(); },
                reset: () => { for (const h of Object.keys(sites)) delete sites[h]; apply(); save(); return view(); }
            },
            deactivate() { /* o host devolve o zoom das abas ao normal */ }
        };
    }
};
