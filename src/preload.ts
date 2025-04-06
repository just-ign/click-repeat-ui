// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import { ProgressMessage } from "./general-agent";

contextBridge.exposeInMainWorld("electronAPI", {
  handleQuery: (query: string) => ipcRenderer.invoke("handleQuery", query),
  onAgentProgress: (callback: (message: ProgressMessage) => void) => {
    // Define the event handler function
    const eventHandler = (_event: IpcRendererEvent, message: ProgressMessage) =>
      callback(message);

    // Add the listener
    ipcRenderer.on("agent-progress", eventHandler);

    // Return a function to remove the listener
    return () => {
      ipcRenderer.removeListener("agent-progress", eventHandler);
    };
  },
  expandWindow: () => ipcRenderer.invoke("expandWindow"),
  minimizeWindow: () => ipcRenderer.invoke("minimizeWindow"),
});
