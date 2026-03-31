import { supabase } from "./supabase.js";

// ─── Password hashing (SHA-256 via Web Crypto) ────────────────────────────────
export async function hashPassword(password) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(password)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Session (localStorage — só para não pedir login a cada refresh) ──────────
export function getSession() {
  try { return JSON.parse(localStorage.getItem("fin-session")); } catch { return null; }
}
export function saveSession(user) {
  localStorage.setItem("fin-session", JSON.stringify(user));
}
export function clearSession() {
  localStorage.removeItem("fin-session");
}

// ─── User CRUD (Supabase) ─────────────────────────────────────────────────────
export async function findUser(username) {
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("usuario", username.toLowerCase().trim())
    .maybeSingle();
  return data ?? null;
}

export async function createUser(user) {
  const { data, error } = await supabase
    .from("users")
    .insert([user])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateUser(id, updates) {
  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Admin (Supabase) ─────────────────────────────────────────────────────────
export async function loadAllUsers() {
  const { data, error } = await supabase
    .from("users")
    .select("id, nome, usuario, is_admin, totp_enabled, recovery_codes, criado_em")
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function loadAllTransactionCounts() {
  const { data } = await supabase.from("transactions").select("user_id");
  const counts = {};
  data?.forEach(t => { counts[t.user_id] = (counts[t.user_id] || 0) + 1; });
  return counts;
}

export async function deleteUserById(id) {
  const { error } = await supabase.from("users").delete().eq("id", id);
  if (error) throw error;
}

export async function setAdminStatus(id, isAdmin) {
  return updateUser(id, { is_admin: isAdmin });
}

export async function resetUserPassword(id, novaSenha) {
  const hash = await hashPassword(novaSenha);
  return updateUser(id, { senha_hash: hash });
}

// ─── Transactions (Supabase) ──────────────────────────────────────────────────
export async function loadTransactions(userId) {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("data", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertTransaction(tx) {
  const { error } = await supabase
    .from("transactions")
    .upsert([tx], { onConflict: "id" });
  if (error) throw error;
}

export async function deleteTransaction(id) {
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ─── TOTP (RFC 6238 — Google Authenticator) ───────────────────────────────────
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateSecret(bytes = 20) {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  let out = "", bits = 0, val = 0;
  for (const b of buf) {
    val = (val << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}

function b32Decode(s) {
  s = s.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  const out = []; let bits = 0, val = 0;
  for (const c of s) {
    const idx = B32.indexOf(c);
    if (idx < 0) continue;
    val = (val << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return new Uint8Array(out);
}

async function hotp(secret, counter) {
  const key = await crypto.subtle.importKey(
    "raw", b32Decode(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
  );
  const msg = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) { msg[i] = c & 0xff; c = Math.floor(c / 256); }
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, msg));
  const off = sig[19] & 0xf;
  const code = (((sig[off] & 0x7f) << 24) | (sig[off+1] << 16) | (sig[off+2] << 8) | sig[off+3]) % 1_000_000;
  return String(code).padStart(6, "0");
}

export async function verifyTOTP(secret, token) {
  const t = Math.floor(Date.now() / 1000 / 30);
  for (const w of [-1, 0, 1]) {
    if ((await hotp(secret, t + w)) === token.replace(/\s/g, "")) return true;
  }
  return false;
}

export function totpUri(secret, username) {
  return `otpauth://totp/Finan%C3%A7as:${encodeURIComponent(username)}?secret=${secret}&issuer=Finan%C3%A7as&algorithm=SHA1&digits=6&period=30`;
}

// ─── Recovery codes ───────────────────────────────────────────────────────────
function randHex(n) {
  return Array.from(crypto.getRandomValues(new Uint8Array(n)))
    .map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function generateRecoveryCodes(count = 8) {
  return Array.from({ length: count }, () => `${randHex(4)}-${randHex(4)}-${randHex(4)}`);
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
