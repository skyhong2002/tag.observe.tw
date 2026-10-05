import Logo from '@/components/Logo';
import styles from './home.module.css';

/** The home page's opening: the site mark in place of a page title (as on the
 *  parent site tag.analysis.tw), the tagline, and the edition line. SiteHeader
 *  hides its own wordmark while #masthead is in view, so one logo shows at a time. */
export default function Masthead({ date, updated }: { date: string; updated: string }) {
  return (
    <div className={styles.masthead}>
      <h1 id="masthead">
        <Logo className={styles.mastheadMark} />
      </h1>
      <p className={styles.mastheadTagline}>同一件事，各家怎麼說</p>
      <p className={styles.edition}>
        {date} · {updated}
      </p>
    </div>
  );
}
