import Link from 'next/link';
import { Suspense } from 'react';
import Logo from '@/components/Logo';
import RankingWordCloud from '@/components/RankingWordCloud';
import { fetchRanking } from '@/lib/api';
import { LOGO_MASK } from '@/lib/logo-mask.mts';
import styles from './home.module.css';

// The ranking page's 正在發酵 cloud for all outlets without a media gate.
const HOME_CLOUD_HREF = '/ranking/?category=all&order=growth&gate=all';

// The original masthead (the 128px mark, 104px on a phone) laid over the middle
// of RankingWordCloud's masthead canvases (1120×400 wide, 340×380 on a phone;
// about one unit per CSS pixel). The stack is centred: the mark sits dy above
// the middle, with the tagline, the edition line and the link to the ranking
// under it, each with its own clear box. The glyphs are kept clear by their
// shape (LOGO_MASK); RankingWordCloud's markGap holds the words off all of it.
const HOLE = {
  compact: {
    hole: { width: 100, height: 100, mask: LOGO_MASK, dy: -33 },
    clear: [
      { x: -76, y: 20, width: 152, height: 24 },
      { x: -122, y: 43, width: 244, height: 21 },
      { x: -38, y: 62, width: 76, height: 22 },
    ],
  },
  wide: {
    hole: { width: 128, height: 128, mask: LOGO_MASK, dy: -35 },
    clear: [
      { x: -80, y: 32, width: 160, height: 26 },
      { x: -130, y: 56, width: 260, height: 22 },
      { x: -40, y: 77, width: 80, height: 22 },
    ],
  },
};

// At most 30 terms, the top rising ones; on a quiet day the day's top keywords
// by score make up the count in grey, sized below every rising term.
const WORDS = 30;

async function Cloud() {
  const [growth, score] = await Promise.all([
    fetchRanking('all', 'growth', 500, false, false, { gate: 'all' }).catch(() => null),
    fetchRanking('all', 'score', 500, false, false, { gate: 'all' }).catch(() => null),
  ]);
  if (!growth?.entries.length) return null;
  const term = (e: (typeof growth.entries)[number]) => ({
    tag: e.tag,
    score: e.normalized,
    burst: e.burst,
    growth: e.signals?.growth ?? null,
    count: e.count,
    media: Object.keys(e.media).length,
    isNew: e.new,
  });
  const rising = growth.entries.map(term);
  const seen = new Set(rising.map((t) => t.tag));
  const top = rising.reduce((n, t) => Math.max(n, t.growth ?? 0), 0);
  const shown = rising.slice(0, WORDS);
  const floor = shown.reduce((n, t) => Math.min(n, t.growth ?? n), top);
  const others = (score?.entries ?? []).filter((e) => !seen.has(e.tag)).slice(0, WORDS - shown.length);
  const best = others[0]?.normalized || 1;
  const fillers = others.map((e) => ({ ...term(e), growth: null, quiet: true, weight: floor * (0.3 + 0.6 * (e.normalized / best)) }));
  return <RankingWordCloud mode="growth" hole={HOLE} terms={[...shown, ...fillers]} />;
}

/** The home page's opening: the site mark in the middle of the 正在發酵 cloud,
 *  the day's rising keywords packed around it. SiteHeader hides its own
 *  wordmark while #masthead is in view, so one logo shows at a time. */
export default function MastheadCloud({ date, updated }: { date: string; updated: string }) {
  return (
    <div className={styles.mastheadCloud}>
      <div className={styles.mastheadCloudFrame} data-vital-region="home-growth-cloud">
        <Suspense fallback={null}>
          <Cloud />
        </Suspense>
        <div className={styles.mastheadCloudCentre}>
          <h1 id="masthead">
            <Logo className={styles.mastheadMark} />
          </h1>
          <p className={styles.mastheadTagline}>同一件事，各家怎麼說</p>
          <p className={styles.edition}>
            {date} · {updated}
          </p>
          <Link href={HOME_CLOUD_HREF} className={styles.mastheadCloudLink}>
            升溫排行 →
          </Link>
        </div>
      </div>
    </div>
  );
}
