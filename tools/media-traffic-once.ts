import { runMediaTrafficJob } from '../app/src/jobs/media-traffic-job.ts';
import { trafficDomain } from '../app/src/media-traffic/live.ts';

const domains = process.argv.slice(2);
if (domains.some((domain) => trafficDomain(domain) !== domain)) throw Error('Pass bare domains, for example udn.com');
try {
  console.log(await runMediaTrafficJob(domains.length ? domains : undefined));
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
