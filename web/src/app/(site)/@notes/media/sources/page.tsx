import { MediaCardMethod, MediaSourcesMethod } from '@/components/MethodNotes';
import traffic from '../../../../../../../app/data/media-traffic.json';

// Server-side so the footer can date the traffic sheet without shipping the
// sheet itself to the browser.
export default function MediaSourcesNotes() {
  return (
    <>
      <MediaSourcesMethod retrievedAt={traffic.retrievedAt} />
      <MediaCardMethod />
    </>
  );
}
