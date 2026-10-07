import Link from 'next/link';
import { authorCreditParts } from '@/lib/author-display.mts';
import { bylineHref } from '@/lib/bylines';
import { creditEntities } from '../../../app/src/journalists/credit-entities';

/** Retain the shared author/source roles while linking to their matching directories. */
export default function AuthorCredits({
  credits,
  media,
  attributions,
  hours = 48,
  className = '',
}: {
  credits: string[];
  media?: string;
  attributions?: readonly { media: string; name: string; evidence: string }[];
  hours?: number;
  className?: string;
}) {
  const entities = creditEntities(credits, media ?? '');
  const parts = authorCreditParts(credits, { media, attributions });
  const linkClass = 'hover:text-brand-700 hover:underline dark:hover:text-brand-400';
  return (
    <span className={className}>
      {parts.map((part, index) => (
        <span key={`${part.label}:${part.text}`}>
          {index > 0 && ' · '}
          {part.label && `${part.label} `}
          {part.media ? (
            <Link href={`/media/${encodeURIComponent(part.media)}/references/?hours=${hours}`} className={linkClass}>
              {part.text}
            </Link>
          ) : (
            part.text.split('、').map((name, nameIndex) => {
              const entity = entities.find((entry) => entry.name === name);
              const href =
                entity && ((entity.kind !== 'desk' && entity.kind !== 'unknown') || media) ? bylineHref(entity.key, hours) : undefined;
              return (
                <span key={name}>
                  {nameIndex > 0 && '、'}
                  {href ? (
                    <Link href={href} className={linkClass}>
                      {name}
                    </Link>
                  ) : (
                    name
                  )}
                </span>
              );
            })
          )}
        </span>
      ))}
    </span>
  );
}
