import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabase";

export type RegisterDevicePayload = {
  device_id: string;
  device_name?: string;
  windows_type?: string;
  ip_address?: string;
  realtime?: boolean;
};

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error || new Error("No Supabase user");
  return data.user.id;
}

export async function registerDevice(payload: RegisterDevicePayload): Promise<{ device: any }>{
  const uid = await currentUserId();
  const now = new Date().toISOString();
  const row: any = {
    user_id: uid,
    device_id: payload.device_id,
    device_name: payload.device_name ?? null,
    windows_type: payload.windows_type ?? null,
    ip_address: payload.ip_address ?? null,
    realtime: payload.realtime ?? false,
    linked_at: now,
    last_seen: now,
  };
  const { error } = await supabase
    .from("devices")
    .upsert(row, { onConflict: "device_id" });
  if (error) throw error;
  return { device: row };
}

export async function heartbeat(device_id: string, status?: string, realtime?: boolean): Promise<{ ok: true }>{
  const uid = await currentUserId();
  const patch: any = { last_seen: new Date().toISOString() };
  if (typeof status !== "undefined") patch.status = status;
  if (typeof realtime !== "undefined") patch.realtime = realtime;
  const { error } = await supabase
    .from("devices")
    .update(patch)
    .eq("user_id", uid)
    .eq("device_id", device_id);
  if (error) throw error;
  return { ok: true } as const;
}

export async function getDevices(): Promise<{ devices: any[] }>{
  const { data, error } = await supabase
    .from("devices")
    .select("*")
    .order("last_seen", { ascending: false });
  if (error) throw error;
  return { devices: data || [] };
}

export function generateLocalDeviceId(): string { return uuidv4(); }
