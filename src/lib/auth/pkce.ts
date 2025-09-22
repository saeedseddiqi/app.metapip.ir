"use client";

// Utility to generate PKCE verifier/challenge

function base64UrlEncode(bytes: Uint8Array): string {
  let str = typeof Buffer !== "undefined" ? Buffer.from(bytes).toString("base64") : btoa(String.fromCharCode(...bytes));
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function generateCodeVerifier(length = 64): string {
  // Allowed characters per RFC7636: ALPHA / DIGIT / "-" / "." / "_" / "~"
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const random = new Uint8Array(length);
  if (typeof crypto !== "undefined" && (crypto as any).getRandomValues) {
    (crypto as any).getRandomValues(random);
  } else {
    for (let i = 0; i < length; i++) random[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (let i = 0; i < length; i++) out += charset[random[i] % charset.length];
  return out;
}

async function sha256(input: string): Promise<Uint8Array> {
  if (typeof crypto !== "undefined" && (crypto.subtle as any)?.digest) {
    const data = new TextEncoder().encode(input);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return new Uint8Array(hash);
  }
  // Fallback (very unlikely in modern WebView)
  throw new Error("Web Crypto not available for SHA-256");
}

export async function deriveCodeChallenge(verifier: string): Promise<string> {
  const hash = await sha256(verifier);
  return base64UrlEncode(hash);
}

export async function createPkcePair() {
  const verifier = generateCodeVerifier();
  const challenge = await deriveCodeChallenge(verifier);
  return { verifier, challenge, method: "S256" as const };
}
