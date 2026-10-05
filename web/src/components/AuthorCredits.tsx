import Link from 'next/link';
import { authorCreditParts } from '@/lib/author-display.mts';
import { journalistHref } from '@/lib/journalists';

// Use the same role rules as liveboard and similarity, retaining person links.
export default function AuthorCredits({
  credits,
  media,
  attributions,
  className = '',
}: {
  credits: string[];
  media?: string;
  attributions?: readonly { media: string; name: string; evidence: string }[];
  className?: string;
}) {
  const parts = authorCreditParts(credits, { media, attributions });
  return (
    <span className={className}>
      {parts.map((part, index) => (
        <span key={`${part.label}:${part.text}`}>
          {index > 0 && ' · '}
          {part.label && `${part.label} `}
          {part.label === '作者'
            ? part.text.split('、').map((name, nameIndex) => (
                <span key={name}>
                  {nameIndex > 0 && '、'}
                  <Link href={journalistHref(name)} className="hover:text-brand-700 hover:underline dark:hover:text-brand-400">
                    {name}
                  </Link>
                </span>
              ))
            : part.text}
        </span>
      ))}
    </span>
  );
}
