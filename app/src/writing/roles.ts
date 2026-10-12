import { ROLES, type Role } from './rules.ts';

/** Raw SQL JSON columns can arrive as strings; old rows only have role. */
export function roleTags(value: unknown, legacy: string | null = null): Role[] {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  const values = Array.isArray(parsed) ? parsed : legacy ? [legacy] : [];
  return ROLES.filter((role) => values.includes(role));
}

/** Empty sets must use the explicit clear action (null). */
export function parseRoles(value: unknown): Role[] | null | undefined {
  if (value === null) return null;
  if (!Array.isArray(value) || !value.length || value.length > ROLES.length - 1) return undefined;
  if (value.some((role) => typeof role !== 'string' || role === '未知' || !(ROLES as readonly string[]).includes(role))) return undefined;
  return roleTags(value);
}
