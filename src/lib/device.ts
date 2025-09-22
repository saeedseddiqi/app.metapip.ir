import { v4 as uuidv4 } from "uuid";
import { readTextFile, writeTextFile, BaseDirectory, exists, mkdir } from "@tauri-apps/plugin-fs";
import { hostname } from "@tauri-apps/plugin-os";

const DEVICE_FILE = "metapip/device_id.txt";

export async function getOrCreateDeviceId() {
  const has = await exists(DEVICE_FILE, { baseDir: BaseDirectory.AppData });
  if (has) {
    return readTextFile(DEVICE_FILE, { baseDir: BaseDirectory.AppData });
  }
  const id = uuidv4();
  // Ensure the directory exists before writing the file
  try {
    await mkdir("metapip", { baseDir: BaseDirectory.AppData, recursive: true });
  } catch (_) {
    // ignore if already exists or not necessary
  }
  await writeTextFile(DEVICE_FILE, id, { baseDir: BaseDirectory.AppData });
  return id;
}

export async function getDeviceName() {
  try {
    const h = await hostname();
    return h ?? "Windows-PC";
  } catch {
    return "Windows-PC";
  }
}
