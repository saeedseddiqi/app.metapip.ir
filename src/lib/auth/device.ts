import { v4 as uuidv4 } from "uuid";

export type DeviceInfo = {
  device_id: string;
  device_name?: string;
  windows_type?: string;
  ip_address?: string;
};

const LS_KEY = "mc_device_id";

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return uuidv4();
  try {
    const cur = localStorage.getItem(LS_KEY);
    if (cur && cur.length > 0) return cur;
  } catch {}
  const id = uuidv4();
  try { localStorage.setItem(LS_KEY, id); } catch {}
  return id;
}

export async function getDeviceInfo(): Promise<DeviceInfo> {
  const device_id = getOrCreateDeviceId();
  let device_name: string | undefined = undefined;
  let windows_type: string | undefined = undefined;
  let ip_address: string | undefined = undefined;
  try {
    if (typeof window !== "undefined") {
      const os = await import("@tauri-apps/plugin-os");
      device_name = (await os.platform()).toString();
    }
  } catch {}
  try {
    if (typeof window !== "undefined") {
      const os = await import("@tauri-apps/plugin-os");
      const v = await os.version();
      const type = await os.platform();
      windows_type = `${type} ${v}`;
    }
  } catch {}
  try {
    if (typeof window !== "undefined") {
      const res = await fetch("https://api.ipify.org?format=json");
      if (res.ok) {
        const data = await res.json().catch(() => ({} as any));
        if (data?.ip) ip_address = data.ip;
      }
    }
  } catch {}
  return { device_id, device_name, windows_type, ip_address };
}
