declare module "@tauri-apps/api/shell" {
  /** Opens the given URL in the system's default handler (browser). */
  export function open(url: string): Promise<void>;
}
