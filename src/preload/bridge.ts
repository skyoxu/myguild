import { contextBridge, ipcRenderer } from 'electron';

type SafeAPI = {
  ping: () => Promise<string>;
};

const api: SafeAPI = {
  ping: () => ipcRenderer.invoke('sys:ping'),
};

contextBridge.exposeInMainWorld('api', api);
