import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'cyberpunk-battle-agents-secret-token-key-2026';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedValue: string): boolean {
  const [salt, hash] = storedValue.split(':');
  if (!salt || !hash) return false;
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

export function generateToken(payload: { userId: string }): string {
  const expiry = Date.now() + 24 * 60 * 60 * 1000; // 1 day
  const raw = `${payload.userId}.${expiry}`;
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(raw).digest('hex');
  return `${raw}.${signature}`;
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [userId, expiry, signature] = parts;
    if (Number(expiry) < Date.now()) return null;
    
    const raw = `${userId}.${expiry}`;
    const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(raw).digest('hex');
    if (signature !== expectedSignature) return null;
    
    return { userId };
  } catch {
    return null;
  }
}
