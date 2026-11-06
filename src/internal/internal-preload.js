const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("saturniumAI", {
    getConfig: () => ipcRenderer.invoke("saturnium-ai-config-get"),
    saveConfig: (config) => ipcRenderer.invoke("saturnium-ai-config-save", config),
    chat: (messages, options) => ipcRenderer.invoke("saturnium-ai-chat", messages, options),
    testConnection: (provider) => ipcRenderer.invoke("saturnium-ai-test", provider),
    stop: () => ipcRenderer.invoke("saturnium-ai-stop")
});
