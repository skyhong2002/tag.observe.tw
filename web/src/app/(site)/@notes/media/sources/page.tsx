import { MediaCardMethod, MediaSourcesMethod } from '@/components/MethodNotes';
import traffic from '../../../../../../../app/data/media-traffic.json';
import { loadComparison } from '../../../media/sources/load';

// Server-side so the footer can date the traffic sheet and state each source's
// status without shipping the sheet or snapshots to the browser. loadComparison
// is per-request cached, so this shares the table's fetches.
export default async function MediaSourcesNotes() {
  const status = await loadComparison().catch(() => null);
  return (
    <>
      <MediaSourcesMethod sheet={traffic} status={status} />
      <MediaCardMethod />
    </>
  );
}
