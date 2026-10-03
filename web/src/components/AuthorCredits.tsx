import Link from 'next/link';
import { journalistHref } from '@/lib/journalists';
import { personNames } from '../../../app/src/journalists/names';

type Part = { key: string; text: string; href: string | null };
// Credits as the publisher wrote them, with each recognised person linked to
// their journalist page. Desks and agencies stay as plain text.
export default function AuthorCredits({ credits, className = '' }: { credits: string[]; className?: string }) {
  if (!credits.length) return null;
  const parts: Part[] = [];
  for (const credit of credits) {
    const names = personNames(credit);
    if (names.length) for (const name of names) parts.push({ key: `${credit}:${name}`, text: name, href: journalistHref(name) });
    else parts.push({ key: credit, text: credit, href: null });
  }
  return (
    <span className={className}>
      {parts.map((part, index) => (
        <span key={part.key}>
          {index > 0 && '、'}
          {part.href ? (
            <Link href={part.href} className="hover:text-brand-700 hover:underline dark:hover:text-brand-400">
              {part.text}
            </Link>
          ) : (
            part.text
          )}
        </span>
      ))}
    </span>
  );
}
