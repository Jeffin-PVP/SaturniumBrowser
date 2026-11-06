# Extensões funcionais + Saturnium Themes

## Núcleo
- `ExtensionManager`: estado ativado/desativado persistido em `userData/extensions/state.json`; ativar chama `activate(api)`, desativar chama `deactivate()` e remove o que a extensão aplicou.
- `ExtensionAPI`: novas APIs `theme` (permissão `theme.apply`) e `newtab` (permissão `newtab.wallpaper`), além do `storage`.
- `ExtensionHost` (novo): única camada que injeta CSS. Extensões passam só valores validados (cores, gradientes, data URL de imagem até 4 MB); nunca CSS cru.
- Extensões podem expor `methods` para a própria tela de configurações, chamados via `saturniumExtensions.call(id, método, args)`.

## Interface
- `style.css` e `newtab.html` usam variáveis `--sb-*` (valores originais como padrão).
- Páginas internas de extensões rodam com preload seguro (`src/extensions/extensions-preload.js`), e o IPC valida o remetente.
- Configurações da extensão abrem em `saturnium://ext/<id>/<arquivo>`.

## Correções
- `extensions.html` usava `window.browserAPI.extensions`, que não existe em abas internas; agora usa `saturniumExtensions`.
- Adicionado `TabManager.isAIWebContents` (era chamado mas não existia, quebrando o IPC da IA).

## Saturnium Themes 1.1.0
5 temas, cor de destaque personalizada, wallpapers em gradiente e imagem própria na nova aba.

## Página de busca (search.html)
- Layout alinhado à esquerda, cabeçalho fixo com a barra de busca, cards com hover, favicon com fallback de letra, caminho do site (breadcrumb) e animação de entrada.
- Skeleton enquanto carrega; atalho "/" para focar a busca; respeita `--sb-accent` e `--sb-content-bg` dos temas.
- Resultados agora são montados via DOM (antes via innerHTML com aspas não escapadas) e só links http(s) são aceitos.
- Links `duckduckgo.com/y.js` aparecem com o selo "Patrocinado".
