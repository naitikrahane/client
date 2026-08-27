// Wallet address utilities

export function shortenAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// ══════════════════════════════════════════════
// WEB CRYPTO UTILS (AES-GCM + PBKDF2-SHA256)
// ══════════════════════════════════════════════

const PBKDF2_ITERATIONS = 600000;

function buf2base64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToBuf(b64: string): Uint8Array {
  const binary = window.atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export type EncryptedData = { ciphertext: string, salt: string, iv: string };

export async function encryptData(password: string, data: string): Promise<EncryptedData> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  
  const enc = new TextEncoder();
  const encryptedBuf = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as any },
    key,
    enc.encode(data)
  );

  return {
    ciphertext: buf2base64(encryptedBuf),
    salt: buf2base64(salt),
    iv: buf2base64(iv),
  };
}

export async function decryptData(password: string, encrypted: EncryptedData): Promise<string> {
  const salt = base64ToBuf(encrypted.salt);
  const iv = base64ToBuf(encrypted.iv);
  const ciphertextBuf = base64ToBuf(encrypted.ciphertext);
  
  const key = await deriveKey(password, salt);
  const decryptedBuf = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as any },
    key,
    ciphertextBuf as any
  );
  
  const dec = new TextDecoder();
  return dec.decode(decryptedBuf);
}
