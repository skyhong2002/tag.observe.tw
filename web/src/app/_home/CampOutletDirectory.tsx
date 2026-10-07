import { campOutlets, DEMO_CAMPS, mediaStats } from '@/lib/demo';
import CampOutletIcon from './CampOutletIcon';
import CampOutlets from './CampOutlets';
import styles from './home.module.css';

/** Stream the directory separately so its API cannot hold up the homepage. */
export default async function CampOutletDirectory() {
  const groups = campOutlets(await mediaStats());
  const total = Object.values(groups).reduce((count, outlets) => count + outlets.length, 0);
  if (!total) return <p className={styles.notice}>媒體清單暫時無法取得，請稍後重新整理。</p>;
  return (
    <CampOutlets total={total} columns={DEMO_CAMPS.map((c) => `minmax(128px, ${Math.max(1, groups[c.key].length)}fr)`).join(' ')}>
      {DEMO_CAMPS.map((c) => (
        <div key={c.key} className={styles.campOutletGroup}>
          <p>
            <i className={styles[c.key]} aria-hidden="true" />
            {c.label} <span>{groups[c.key].length} 家</span>
          </p>
          <ul>
            {groups[c.key].map((outlet) => (
              <li key={outlet.media}>
                <CampOutletIcon outlet={outlet} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </CampOutlets>
  );
}
