/// <reference types="vite/client" />

declare global {
  interface Window {
    electronAPI?: {
      reportEvent?: (event: { type: string; data: any }) => void;
    };
  }
}

export {};
