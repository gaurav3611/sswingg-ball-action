import type { BowlerProfile } from './types';

export const MIN_PASSWORD = 8;

export interface FieldErrors {
  [field: string]: string | undefined;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegistration(input: { name: string; email: string; password: string }): FieldErrors {
  const e: FieldErrors = {};
  if (input.name.trim().length < 2) e.name = 'Enter your name.';
  if (!EMAIL.test(input.email.trim())) e.email = 'Enter a valid email address.';
  if (input.password.length < MIN_PASSWORD) e.password = `Use at least ${MIN_PASSWORD} characters.`;
  return e;
}

export function validateLogin(input: { email: string; password: string }): FieldErrors {
  const e: FieldErrors = {};
  if (!EMAIL.test(input.email.trim())) e.email = 'Enter a valid email address.';
  if (input.password.length === 0) e.password = 'Enter your password.';
  return e;
}

/** Parses an optional number from a text field. Empty means "not given", not zero. */
export function parseOptionalNumber(text: string, min: number, max: number): { value: number | null; error?: string } {
  const t = text.trim().replace(',', '.');
  if (t === '') return { value: null };
  const n = Number(t);
  if (!Number.isFinite(n) || n < min || n > max) return { value: null, error: `Enter a number from ${min} to ${max}, or leave it empty.` };
  return { value: n };
}

export function validateProfile(input: {
  name: string;
  age: string;
  heightCm: string;
  massKg: string;
}): { errors: FieldErrors; age: number | null; heightCm: number | null; massKg: number | null } {
  const errors: FieldErrors = {};
  if (input.name.trim().length < 2) errors.name = 'Enter a name.';
  const age = parseOptionalNumber(input.age, 5, 90);
  const height = parseOptionalNumber(input.heightCm, 100, 230);
  const mass = parseOptionalNumber(input.massKg, 20, 200);
  if (age.error) errors.age = age.error;
  if (height.error) errors.heightCm = height.error;
  if (mass.error) errors.massKg = mass.error;
  return { errors, age: age.value, heightCm: height.value, massKg: mass.value };
}

export const hasErrors = (e: FieldErrors) => Object.values(e).some(Boolean);

export const displayArm = (p: Pick<BowlerProfile, 'bowlingArm'>) => (p.bowlingArm === 'left' ? 'Left arm' : 'Right arm');
