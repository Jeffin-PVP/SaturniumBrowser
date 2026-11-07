const { parseDictionaryApi, parseWiktionary, parseExtract } = require("./parse");

const LANGS = { pt: "Português", en: "English", es: "Español" };
const MAX_HISTORY = 30;
const MAX_SAVED = 300;
const WORD_RE = /^[\p{L}\p{M}'’ -]{1,60}$/u;

function cleanWord(w) {
    const v = String(w == null ? "" : w).trim().replace(/\s+/g, " ").replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
    if (!WORD_RE.test(v)) throw new Error("Digite uma palavra válida (apenas letras).");
    return v;
}

module.exports = {
    activate(api) {
        const store = api.storageAPI;
        const saved0 = store.get();
        const state = {
            lang: LANGS[saved0.lang] ? saved0.lang : "pt",
            history: Array.isArray(saved0.history) ? saved0.history.filter(w => typeof w === "string").slice(0, MAX_HISTORY) : [],
            saved: Array.isArray(saved0.saved) ? saved0.saved.filter(w => typeof w === "string").slice(0, MAX_SAVED) : []
        };
        const persist = () => store.set(state);
        const view = () => ({
            lang: state.lang, history: [...state.history], saved: [...state.saved],
            langs: Object.entries(LANGS).map(([id, name]) => ({ id, name }))
        });

        async function fromDictionaryApi(word) {
            const r = await api.network.getJSON(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
            return r.ok ? parseDictionaryApi(r.data) : null;
        }

        async function fromWiktionary(lang, word) {
            const base = `https://${lang}.wiktionary.org`;
            const tries = word === word.toLowerCase() ? [word] : [word.toLowerCase(), word];
            for (const w of tries) {
                try {
                    const r = await api.network.getJSON(`${base}/api/rest_v1/page/definition/${encodeURIComponent(w)}`);
                    const parsed = r.ok ? parseWiktionary(r.data, lang) : null;
                    if (parsed) return { ...parsed, word: w };
                } catch { /* tenta o próximo caminho */ }
            }
            // Fallback: texto do verbete
            for (const w of tries) {
                try {
                    const url = `${base}/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&titles=${encodeURIComponent(w)}`;
                    const r = await api.network.getJSON(url);
                    const ex = r.ok ? parseExtract(r.data) : null;
                    if (ex) return { word: ex.title || w, phonetic: "", meanings: [], extract: ex.extract };
                } catch { /* sem resultado */ }
            }
            return null;
        }

        api.contextMenu.addSelectionItem({
            label: "Definir",
            maxWords: 2,
            handler: text => api.ui.openPage(text)
        });

        return {
            methods: {
                getState: () => view(),

                setLang: lang => {
                    if (!LANGS[lang]) throw new Error("Idioma inválido.");
                    state.lang = lang; persist(); return view();
                },

                lookup: async ({ word, lang } = {}) => {
                    const w = cleanWord(word);
                    const l = LANGS[lang] ? lang : state.lang;
                    let result;
                    try {
                        result = l === "en" ? await fromDictionaryApi(w) : await fromWiktionary(l, w);
                    } catch (error) {
                        throw new Error("Não consegui consultar o dicionário agora. Verifique sua conexão.");
                    }
                    if (!result) return { found: false, word: w, lang: l, state: view() };
                    state.lang = l;
                    state.history = [w, ...state.history.filter(x => x.toLowerCase() !== w.toLowerCase())].slice(0, MAX_HISTORY);
                    persist();
                    return {
                        found: true, lang: l, word: result.word || w, phonetic: result.phonetic || "",
                        meanings: result.meanings || [], extract: result.extract || "",
                        isSaved: state.saved.some(x => x.toLowerCase() === w.toLowerCase()),
                        state: view()
                    };
                },

                toggleSaved: word => {
                    const w = cleanWord(word);
                    const has = state.saved.some(x => x.toLowerCase() === w.toLowerCase());
                    if (has) state.saved = state.saved.filter(x => x.toLowerCase() !== w.toLowerCase());
                    else {
                        if (state.saved.length >= MAX_SAVED) throw new Error("Limite de palavras salvas atingido.");
                        state.saved.unshift(w);
                    }
                    persist(); return view();
                },

                clearHistory: () => { state.history = []; persist(); return view(); }
            },
            deactivate() { /* o host remove o item de menu ao desativar */ }
        };
    }
};
