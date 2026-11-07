// Normaliza as respostas das fontes (dictionaryapi.dev e Wiktionary) para um formato único.
const MAX_MEANINGS = 6;
const MAX_DEFS = 6;

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " " };

function strip(html) {
    return String(html == null ? "" : html)
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]*>/g, "")
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Math.min(Number(n), 0x10ffff)))
        .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, m => ENTITIES[m])
        .replace(/\s+/g, " ")
        .trim();
}

// dictionaryapi.dev -> [{ word, phonetic, meanings:[{partOfSpeech, definitions:[{definition, example}], synonyms}] }]
function parseDictionaryApi(data) {
    if (!Array.isArray(data) || !data.length) return null;
    const first = data[0];
    const meanings = [];
    for (const entry of data) {
        for (const m of entry.meanings || []) {
            const defs = (m.definitions || []).slice(0, MAX_DEFS).map(d => ({
                text: strip(d.definition), example: d.example ? strip(d.example) : ""
            })).filter(d => d.text);
            if (!defs.length) continue;
            const synonyms = [...new Set([...(m.synonyms || []), ...((m.definitions || [])[0] || {}).synonyms || []])]
                .map(strip).filter(Boolean).slice(0, 8);
            meanings.push({ pos: strip(m.partOfSpeech), definitions: defs, synonyms });
            if (meanings.length >= MAX_MEANINGS) break;
        }
    }
    if (!meanings.length) return null;
    const phonetic = strip(first.phonetic || ((first.phonetics || []).find(p => p.text) || {}).text || "");
    return { word: strip(first.word), phonetic, meanings };
}

// Wiktionary REST: { "<lang>": [{ partOfSpeech, definitions:[{definition, parsedExamples:[{example}]}] }] }
function parseWiktionary(data, lang) {
    if (!data || typeof data !== "object") return null;
    const sections = data[lang];
    if (!Array.isArray(sections) || !sections.length) return null;
    const meanings = [];
    for (const s of sections.slice(0, MAX_MEANINGS)) {
        const defs = (s.definitions || []).slice(0, MAX_DEFS).map(d => {
            const ex = (d.parsedExamples && d.parsedExamples[0] && d.parsedExamples[0].example) || (d.examples && d.examples[0]) || "";
            return { text: strip(d.definition), example: strip(ex) };
        }).filter(d => d.text);
        if (defs.length) meanings.push({ pos: strip(s.partOfSpeech), definitions: defs, synonyms: [] });
    }
    return meanings.length ? { word: "", phonetic: "", meanings } : null;
}

// MediaWiki extracts (fallback): { query: { pages: { id: { title, extract } } } }
function parseExtract(data) {
    const pages = data && data.query && data.query.pages;
    if (!pages) return null;
    const page = Object.values(pages)[0];
    if (!page || page.missing !== undefined || !page.extract) return null;
    const text = String(page.extract).replace(/\n{3,}/g, "\n\n").trim().slice(0, 2500);
    return text ? { title: strip(page.title), extract: text } : null;
}

module.exports = { strip, parseDictionaryApi, parseWiktionary, parseExtract };
