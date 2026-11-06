const PROVIDERS = {
  "llama.cpp": "llama.cpp — Local",
  ollama: "Ollama — Local",
  groq: "Groq — API",
  openai: "OpenAI — API",
  gemini: "Gemini — API",
  custom: "Custom — OpenAI compatible"
};
let config = null;
const chat = document.getElementById("chat");
const prompt = document.getElementById("prompt");
const status = document.getElementById("status");
const providerLabel = document.getElementById("providerLabel");
const modal = document.getElementById("settings");
const provider = document.getElementById("provider");
const fields = document.getElementById("providerFields");

function addMessage(role, content) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = content;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}
function renderFields() {
  const id = provider.value;
  const c = config.providers[id] || {};
  fields.innerHTML = "";
  if (id !== "gemini") {
    const endpoint = document.createElement("label");
    endpoint.textContent = "Endpoint";
    const input = document.createElement("input");
    input.id = "endpoint"; input.value = c.endpoint || ""; input.autocomplete = "off";
    endpoint.appendChild(input); fields.appendChild(endpoint);
  }
  const model = document.createElement("label"); model.textContent = "Modelo";
  const modelInput = document.createElement("input"); modelInput.id = "model"; modelInput.value = c.model || ""; modelInput.autocomplete = "off";
  model.appendChild(modelInput); fields.appendChild(model);
  if (!["llama.cpp", "ollama"].includes(id)) {
    const key = document.createElement("label"); key.textContent = "API Key";
    const keyInput = document.createElement("input"); keyInput.id = "apiKey"; keyInput.type = "password"; keyInput.placeholder = c.hasApiKey ? "••••••••••••••••" : "Cole sua chave aqui"; keyInput.autocomplete = "off";
    key.appendChild(keyInput); fields.appendChild(key);
  }
}
function populateProviders() {
  provider.innerHTML = "";
  for (const id of Object.keys(PROVIDERS)) { const o = document.createElement("option"); o.value=id; o.textContent=PROVIDERS[id]; provider.appendChild(o); }
  provider.value = config.activeProvider;
  renderFields();
  providerLabel.textContent = `Provedor: ${PROVIDERS[config.activeProvider] || config.activeProvider}`;
}
async function openSettings() { config = await window.saturniumAI.getConfig(); populateProviders(); document.getElementById("testResult").textContent=""; modal.classList.remove("hidden"); }
document.getElementById("settingsBtn").onclick = openSettings;
document.getElementById("closeSettings").onclick = () => modal.classList.add("hidden");
provider.onchange = renderFields;
document.getElementById("saveBtn").onclick = async () => {
  const id = provider.value; const next = {...config.providers[id], model: document.getElementById("model").value.trim()};
  const ep = document.getElementById("endpoint"); if (ep) next.endpoint = ep.value.trim();
  const key = document.getElementById("apiKey"); if (key && key.value.trim()) next.apiKey = key.value.trim();
  try {
    config = await window.saturniumAI.saveConfig({activeProvider:id, providers:{[id]:next}});
    providerLabel.textContent = `Provedor: ${PROVIDERS[id]}`; status.textContent = "Configuração salva."; modal.classList.add("hidden");
  } catch(e) { document.getElementById("testResult").textContent = `Erro: ${e.message}`; }
};
document.getElementById("testBtn").onclick = async () => { try { document.getElementById("testResult").textContent="Testando..."; const r=await window.saturniumAI.testConnection(provider.value); document.getElementById("testResult").textContent=`✓ Conexão OK (${r.model || provider.value})`; } catch(e) { document.getElementById("testResult").textContent=`✕ ${e.message}`; } };
document.getElementById("stopBtn").onclick = () => window.saturniumAI.stop();
document.getElementById("composer").onsubmit = async e => {
 e.preventDefault(); const text=prompt.value.trim(); if(!text) return; prompt.value=""; addMessage("user",text); status.textContent="Pensando...";
 const answer=addMessage("assistant","...");
 try { const r=await window.saturniumAI.chat([{role:"user",content:text}]); answer.textContent=r.content; status.textContent=`${PROVIDERS[r.provider] || r.provider} · ${r.model || ""}`; }
 catch(err) { answer.textContent=`Não foi possível obter uma resposta.\n\n${err.message}`; status.textContent="Erro na solicitação."; }
};
(async()=>{ try { config=await window.saturniumAI.getConfig(); providerLabel.textContent=`Provedor: ${PROVIDERS[config.activeProvider] || config.activeProvider}`; addMessage("assistant","Olá! Eu sou o SaturniumAI. Configure um provedor em ⚙ Configurar e depois envie sua pergunta."); } catch(e){ status.textContent=`Falha ao iniciar o SaturniumAI: ${e.message}`; }})();
