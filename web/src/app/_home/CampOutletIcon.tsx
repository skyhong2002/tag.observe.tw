import MediaHoverLink from '@/components/MediaHoverLink';
import SafeImage from '@/components/SafeImage';
import type { CampOutlet } from '@/lib/demo';
import styles from './home.module.css';

export default function CampOutletIcon({ outlet }: { outlet: CampOutlet }) {
  return (
    <MediaHoverLink
      media={outlet.media}
      title={outlet.title}
      className={`${styles.campOutletLink} ${outlet.active ? '' : styles.campOutletIdle}`}
    >
      <span className={styles.campOutletIcon}>
        {outlet.icon ? <SafeImage src={outlet.icon} alt="" width={18} height={18} /> : outlet.title.slice(0, 1)}
      </span>
    </MediaHoverLink>
  );
}
