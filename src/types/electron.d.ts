// Type definitions for Electron API
interface Window {
  electronAPI: {
    handleQuery: (query: string) => Promise<{ success: boolean }>;
  }
} 