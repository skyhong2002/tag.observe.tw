import { createDb } from '../app/src/db/client.ts';
import { runMediaTrafficJob } from '../app/src/jobs/media-traffic-job.ts';
import { trafficDomain } from '../app/src/media-traffic/live.ts';

const domains = process.argv.slice(2);
if (domains.some((domain) => trafficDomain(domain) !== domain)) throw Error('Pass bare domains, for example udn.com');
// Same history tables as the worker (TAG_DB_URL from .env).
const { db, close } = createDb();
try {
  console.log(await runMediaTrafficJob(domains.length ? domains : undefined, db));
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await close();
}
