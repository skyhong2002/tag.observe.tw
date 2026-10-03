import MediaHoverLink from '@/components/MediaHoverLink';
import MediaIcon from '@/components/MediaIcon';
import type { CampOutlet } from '@/lib/demo';
import styles from './home.module.css';

export default function CampOutletIcon({ outlet }: { outlet: CampOutlet }) {
  return (
    <MediaHoverLink
      media={outlet.media}
      title={outlet.title}
      icon={false}
      className={`${styles.campOutletLink} ${outlet.active ? '' : styles.campOutletIdle}`}
    >
      <span className={styles.campOutletIcon}>
        <MediaIcon media={outlet.media} title={outlet.title} size={18} />
      </span>
    </MediaHoverLink>
  );
}
