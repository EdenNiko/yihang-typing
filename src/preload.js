// 页面 → 主进程：切换主题、给日语文本自动注音、窗口按钮
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tpNative', {
  setTheme: (theme) => ipcRenderer.send('set-theme', theme),
  annotate: (text) => ipcRenderer.invoke('annotate', text),
  // action: 'min' | 'max' | 'close'
  win: (action) => ipcRenderer.send('win', action),
  onMaximize: (fn) => ipcRenderer.on('win-max', (e, maximized) => fn(maximized)),
});
