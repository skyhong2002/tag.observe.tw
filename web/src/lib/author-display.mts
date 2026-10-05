import { personNames } from '../../../app/src/journalists/names.ts';

/** Keep publisher credits visible without describing organizations as reporters. */
export function authorDisplay(credits: readonly string[]): string {
  const people: string[] = [];
  const organizations: string[] = [];
  for (const credit of credits) {
    const names = personNames(credit);
    if (names.length) people.push(...names);
    else if (credit.trim()) organizations.push(credit.trim());
  }
  const names = [...new Set([...people, ...organizations])].slice(0, 3);
  return names.length ? `署名 ${names.join('、')}` : '未署名';
}
