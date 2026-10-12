import dotenv from 'dotenv';

dotenv.config();

// Read a required environment variable, failing loudly when it is missing so the
// app never runs on a guessable default (e.g. a placeholder JWT signing key).
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
