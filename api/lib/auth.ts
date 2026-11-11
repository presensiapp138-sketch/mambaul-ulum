import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User, Role } from './types.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'presensi-default-secret-key-2026';

export interface TokenPayload {
  userId: string;
  username: string;
  role: Role;
  name: string;
  classId?: string;
}

export function generateToken(user: User): string {
  const payload: TokenPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    classId: user.classId,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function hashPassword(plainText: string): string {
  return bcrypt.hashSync(plainText, 10);
}

export function comparePassword(plainText: string, hash: string): boolean {
  return bcrypt.compareSync(plainText, hash);
}

export function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1];
  }
  return null;
}
