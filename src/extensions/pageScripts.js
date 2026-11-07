// Scripts de página com conteúdo FIXO. Extensões nunca enviam código:
// só valores (usuário/senha, posição do botão) que são serializados com JSON.stringify.

// Preenche login. Roda no mundo principal da página, disparado pelo host
// depois de conferir que o domínio da aba bate com o do cadastro.
function fillLoginScript(username, password) {
    const body = function (u, p) {
        function visible(el) {
            const r = el.getBoundingClientRect();
            const s = getComputedStyle(el);
            return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
        }
        function setValue(el, v) {
            const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
            desc.set.call(el, v);
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
        }
        const inputs = Array.from(document.querySelectorAll("input")).filter(visible);
        const pass = inputs.find(i => i.type === "password");
        const isUserField = i => /^(text|email|tel|)$/i.test(i.type) && !i.readOnly && !i.disabled;
        let user = null;
        if (pass) {
            const before = inputs.filter(i => isUserField(i) &&
                (i.compareDocumentPosition(pass) & Node.DOCUMENT_POSITION_FOLLOWING));
            user = before.length ? before[before.length - 1] : null;
        } else {
            user = inputs.find(i => isUserField(i) &&
                /user|login|email|mail|account|conta/i.test((i.name || "") + (i.id || "") + (i.autocomplete || ""))) ||
                inputs.find(isUserField) || null;
        }
        if (user && u) setValue(user, u);
        if (pass && p) setValue(pass, p);
        return { user: !!user, password: !!pass };
    };
    return `(${body.toString()})(${JSON.stringify(String(username || ""))}, ${JSON.stringify(String(password || ""))})`;
}

const PIP_POSITIONS = new Set(["top-right", "top-left", "bottom-right", "bottom-left"]);

// Botão flutuante "Miniplayer" (Picture-in-Picture) nas páginas configuradas.
function pipInstallScript(position) {
    const pos = PIP_POSITIONS.has(position) ? position : "top-right";
    const body = function (position) {
        function bestVideo() {
            const vids = Array.from(document.querySelectorAll("video")).filter(v => v.readyState > 0 && v.videoWidth > 0);
            vids.sort((a, b) => (b.videoWidth * b.videoHeight) - (a.videoWidth * a.videoHeight));
            return vids[0] || null;
        }
        async function toggle() {
            if (document.pictureInPictureElement) { await document.exitPictureInPicture(); return "exit"; }
            const v = bestVideo();
            if (!v) return "none";
            v.disablePictureInPicture = false;
            await v.requestPictureInPicture();
            return "enter";
        }
        function place(host, p) {
            const parts = p.split("-");
            host.style.top = host.style.bottom = host.style.left = host.style.right = "auto";
            host.style[parts[0]] = parts[0] === "top" ? "72px" : "96px";
            host.style[parts[1]] = "16px";
        }
        if (window.__sbPip) { place(window.__sbPip.host, position); return; }

        const host = document.createElement("div");
        host.id = "__sb-pip-host";
        host.style.cssText = "position:fixed;z-index:2147483647;display:none;";
        const root = host.attachShadow({ mode: "closed" });
        const style = document.createElement("style");
        style.textContent =
            "button{all:unset;display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;" +
            "background:rgba(18,22,36,.88);color:#fff;font:600 13px system-ui,sans-serif;cursor:pointer;" +
            "border:1px solid rgba(124,92,255,.7);box-shadow:0 4px 14px rgba(0,0,0,.4)}" +
            "button:hover{background:rgba(48,40,110,.95)}svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2}";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.title = "Miniplayer (Alt+P)";
        const ns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(ns, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        const outer = document.createElementNS(ns, "rect");
        outer.setAttribute("x", "2"); outer.setAttribute("y", "4"); outer.setAttribute("width", "20");
        outer.setAttribute("height", "14"); outer.setAttribute("rx", "2");
        const inner = document.createElementNS(ns, "rect");
        inner.setAttribute("x", "12"); inner.setAttribute("y", "10"); inner.setAttribute("width", "8");
        inner.setAttribute("height", "6"); inner.setAttribute("rx", "1");
        svg.append(outer, inner);
        const label = document.createElement("span");
        label.textContent = "Miniplayer";
        btn.append(svg, label);
        btn.addEventListener("click", () => { toggle().catch(() => {}); });
        root.append(style, btn);
        place(host, position);
        document.documentElement.appendChild(host);

        const timer = setInterval(() => {
            host.style.display = (bestVideo() || document.pictureInPictureElement) ? "block" : "none";
        }, 1200);
        window.__sbPip = { host, timer, toggle };
    };
    return `(${body.toString()})(${JSON.stringify(pos)})`;
}

const PIP_REMOVE_SCRIPT = `(function(){var s=window.__sbPip;if(s){clearInterval(s.timer);s.host.remove();window.__sbPip=null;}})()`;

// Alt+P: entra/sai do Picture-in-Picture (chamado com gesto do usuário).
const PIP_TOGGLE_SCRIPT = `(async function(){
  if (document.pictureInPictureElement) { await document.exitPictureInPicture(); return "exit"; }
  var vids = Array.from(document.querySelectorAll("video")).filter(function(v){return v.readyState>0 && v.videoWidth>0;});
  vids.sort(function(a,b){return (b.videoWidth*b.videoHeight)-(a.videoWidth*a.videoHeight);});
  if (!vids[0]) return "none";
  vids[0].disablePictureInPicture = false;
  await vids[0].requestPictureInPicture();
  return "enter";
})()`;

module.exports = { fillLoginScript, pipInstallScript, PIP_REMOVE_SCRIPT, PIP_TOGGLE_SCRIPT, PIP_POSITIONS };
