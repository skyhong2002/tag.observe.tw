import { ROLES, type Role } from './rules.ts';

/** Raw SQL JSON columns can arrive as strings; old rows only have role. */
export function roleTags(value: unknown, legacy: string | null = null): Role[] {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  const values = Array.isArray(parsed) ? parsed : legacy ? [legacy] : [];
  return ROLES.filter((role) => values.includes(role));
}
