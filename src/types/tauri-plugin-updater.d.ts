declare module '@tauri-apps/plugin-updater' {
  export interface UpdateManifest {
    version?: string;
    notes?: string;
    pub_date?: string;
    body?: string;
    platforms?: Record<string, { url?: string; signature?: string }>;
  }
  export interface UpdateResult {
    available: boolean;
    manifest?: UpdateManifest;
    downloadAndInstall?: () => Promise<void>;
  }
  export function check(): Promise<UpdateResult>;
}
