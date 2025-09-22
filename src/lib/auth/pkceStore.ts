"use client";

// In-memory PKCE storage (RAM-only). Not persisted to disk.
// Holds a single active flow at a time.

let _verifier: string | null = null;
let _state: string | null = null;
let _redirect: string | null = null;

export function setPkce(verifier: string, state: string, redirect: string) {
  _verifier = verifier;
  _state = state;
  _redirect = redirect;
}

export function getPkce(): { verifier: string | null; state: string | null; redirect: string | null } {
  return { verifier: _verifier, state: _state, redirect: _redirect };
}

export function clearPkce() {
  _verifier = null;
  _state = null;
  _redirect = null;
}
