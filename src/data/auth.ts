import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { Account, Role } from './types';

/**
 * Accounts on this phone.
 *
 * This is a local sign-in, not server authentication. It keeps one person's bowlers and
 * sessions apart from another person's on a shared phone, and it keeps the password out of
 * plain text, but it does not protect against someone with access to the phone's storage and
 * time to guess. Real accounts, tokens and roles belong to the backend designed in docs/API.md.
 *
 * A password is stored as a salted hash: SHA-256 of salt and password, repeated ITERATIONS times.
 */
const ACCOUNTS = 'ba_accounts_v1';
const CURRENT = 'ba_current_account_v1';
const ITERATIONS = 1000;

interface StoredAccount extends Account {
  salt: string;
  hash: string;
  iterations: number;
}

export class AuthError extends Error {
  constructor(
    public readonly code: 'email-taken' | 'invalid-credentials',
    message: string,
  ) {
    super(message);
  }
}

/** Secure store on a phone. On the web it does not exist, so the browser's storage stands in. */
const secure = {
  get: (k: string) => (Platform.OS === 'web' ? AsyncStorage.getItem(k) : SecureStore.getItemAsync(k)),
  set: (k: string, v: string) => (Platform.OS === 'web' ? AsyncStorage.setItem(k, v) : SecureStore.setItemAsync(k, v)),
  del: (k: string) => (Platform.OS === 'web' ? AsyncStorage.removeItem(k) : SecureStore.deleteItemAsync(k)),
};

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

export async function hashPassword(password: string, salt: string, iterations: number): Promise<string> {
  let digest = salt + password;
  for (let i = 0; i < iterations; i++) {
    digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, i === 0 ? digest : digest + salt);
  }
  return digest;
}

/** Compares two strings in time that does not depend on where they first differ. */
export function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function readAll(): Promise<StoredAccount[]> {
  try {
    const text = await secure.get(ACCOUNTS);
    return text ? (JSON.parse(text) as StoredAccount[]) : [];
  } catch {
    return [];
  }
}

const publicPart = ({ id, email, name, role, createdAt }: StoredAccount): Account => ({ id, email, name, role, createdAt });
const normalise = (email: string) => email.trim().toLowerCase();

export async function register(input: { name: string; email: string; password: string; role: Role }): Promise<Account> {
  const all = await readAll();
  const email = normalise(input.email);
  if (all.some((a) => a.email === email)) throw new AuthError('email-taken', 'An account with this email already exists on this phone.');
  const salt = toHex(Crypto.getRandomBytes(16));
  const account: StoredAccount = {
    id: Crypto.randomUUID(),
    email,
    name: input.name.trim(),
    role: input.role,
    createdAt: new Date().toISOString(),
    salt,
    iterations: ITERATIONS,
    hash: await hashPassword(input.password, salt, ITERATIONS),
  };
  await secure.set(ACCOUNTS, JSON.stringify([...all, account]));
  await secure.set(CURRENT, account.id);
  return publicPart(account);
}

export async function login(emailInput: string, password: string): Promise<Account> {
  const email = normalise(emailInput);
  const found = (await readAll()).find((a) => a.email === email);
  // The same message for a wrong email and a wrong password, so neither can be probed.
  const fail = new AuthError('invalid-credentials', 'Email or password is not right.');
  if (!found) throw fail;
  const hash = await hashPassword(password, found.salt, found.iterations);
  if (!sameString(hash, found.hash)) throw fail;
  await secure.set(CURRENT, found.id);
  return publicPart(found);
}

export async function currentAccount(): Promise<Account | null> {
  try {
    const id = await secure.get(CURRENT);
    if (!id) return null;
    const found = (await readAll()).find((a) => a.id === id);
    return found ? publicPart(found) : null;
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  await secure.del(CURRENT);
}

export async function deleteAccount(id: string): Promise<void> {
  const rest = (await readAll()).filter((a) => a.id !== id);
  await secure.set(ACCOUNTS, JSON.stringify(rest));
  await secure.del(CURRENT);
}
