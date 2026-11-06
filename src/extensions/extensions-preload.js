const { contextBridge, ipcRenderer } = require("electron");

// Exposto somente para saturnium://extensions e saturnium://ext/<id>/...
// O processo principal valida o remetente em cada chamada.
contextBridge.exposeInMainWorld("saturniumExtensions", {
    list: () => ipcRenderer.invoke("extensions-list"),
    setEnabled: (id, enabled) => ipcRenderer.invoke("extensions-set-enabled", id, enabled),
    openSettings: id => ipcRenderer.invoke("extensions-open-settings", id),
    call: (id, method, args) => ipcRenderer.invoke("extensions-call", id, method, args)
});
