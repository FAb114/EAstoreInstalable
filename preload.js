const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('eaAPI', {
  setUser: (username) => ipcRenderer.send('set-user', username),
  getUser: () => ipcRenderer.invoke('get-user')
});

