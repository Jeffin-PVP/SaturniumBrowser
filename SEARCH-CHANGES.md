# SaturniumBrowser 1.1.3 — SearchManager

## O que mudou

- Removida a dependência do endpoint HTML `html.duckduckgo.com/html/`.
- O SearchManager agora usa o feed RSS de busca do Bing.
- A requisição usa `electron.net.fetch`, aproveitando a camada de rede do Electron.
- O parser foi refeito para RSS/XML e normaliza os resultados para `{ title, url, snippet }`.
- Erros de rede, HTTP e resposta vazia recebem códigos internos (`SEARCH_NETWORK_ERROR`, `SEARCH_HTTP_ERROR`, `SEARCH_EMPTY`).
- Limite de 10 resultados para manter compatibilidade com a interface da 1.1.2.

## Fluxo

NewTab → `saturnium://search?q=...` → TabManager → BrowserManager → SearchManager → Bing RSS → resultados Saturnium.

A navegação direta de URLs não foi alterada.

---

# Abas de busca (Tudo, Modo IA, Imagens, Vídeos, Notícias, Maps)

URL: `saturnium://search?q=...&tab=all|ai|images|videos|news|maps` (sem `tab` = Tudo).

| Aba | Fonte | Observação |
| --- | --- | --- |
| Tudo | Bing RSS | como antes |
| Modo IA | Bing RSS + provedor configurado no SaturniumAI | resposta em pt-BR com citações [1], [2] e lista de fontes |
| Imagens | Bing `images/async` (HTML parcial) | grade em colunas, link para página e imagem original |
| Vídeos | Bing `videos/asyncv2`; fallback: busca em YouTube/Vimeo/etc. | miniatura do YouTube no fallback |
| Notícias | Bing News RSS | fonte, data relativa e imagem |
| Maps | OpenStreetMap Nominatim + embed do OSM | lista de lugares + mapa |

## Arquivos alterados
- `src/search/SearchManager.js`: `searchByType`, `searchImages`, `searchVideos`, `searchNews`, `searchMaps`.
- `src/browser/BrowserManager.js`: `runSearchTab`, `answerWithAI`.
- `src/browser/TabManager.js`: parâmetro `tab`, callback `performSearchTab`.
- `main.js`: BrowserManager passa a usar o mesmo AIManager do SaturniumAI.
- `search.html`: barra de abas e renderizadores.

## Limitações
- Imagens e vídeos dependem do HTML parcial do Bing, que pode mudar.
- O Modo IA é uma pergunta por vez (sem chat de continuação); perguntas novas na barra geram nova resposta.
