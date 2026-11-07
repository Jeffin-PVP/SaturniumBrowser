const MAX_NOTES = 200;
const MAX_TITLE = 120;
const MAX_BODY = 50000;

module.exports = {
    activate(api) {
        const store = api.storageAPI;
        let notes = Array.isArray(store.get().notes) ? store.get().notes : [];
        notes = notes
            .filter(n => n && typeof n.id === "string" && typeof n.body === "string")
            .map(n => ({ id: n.id, title: String(n.title || "").slice(0, MAX_TITLE), body: n.body.slice(0, MAX_BODY), updated: Number(n.updated) || Date.now() }))
            .slice(0, MAX_NOTES);

        const save = () => store.set({ notes });
        const list = () => [...notes].sort((a, b) => b.updated - a.updated);
        const find = id => {
            const n = notes.find(x => x.id === id);
            if (!n) throw new Error("Nota não encontrada.");
            return n;
        };

        return {
            methods: {
                list: () => list(),
                create: () => {
                    if (notes.length >= MAX_NOTES) throw new Error(`Limite de ${MAX_NOTES} notas atingido.`);
                    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
                    notes.push({ id, title: "", body: "", updated: Date.now() });
                    save();
                    return { id, notes: list() };
                },
                update: ({ id, title, body } = {}) => {
                    const n = find(id);
                    if (typeof title === "string") n.title = title.slice(0, MAX_TITLE);
                    if (typeof body === "string") n.body = body.slice(0, MAX_BODY);
                    n.updated = Date.now();
                    save();
                    return n.updated;
                },
                remove: id => {
                    find(id);
                    notes = notes.filter(n => n.id !== id);
                    save();
                    return list();
                }
            }
        };
    }
};
