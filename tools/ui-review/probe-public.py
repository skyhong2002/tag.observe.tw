"""Small read-only SM probe; no build/capture/lock/process control."""
import datetime
import json
import os
from pathlib import Path
import shutil
import statistics
import subprocess
import sys


def utc():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


rows = []
for site in ["tag", "blog", "youtube"]:
    for _ in range(3):
        start = utc()
        result = subprocess.run(
            ["curl", "-sS", "-H", "DNT: 1", "--max-time", "20",
             "-o", "/dev/null", "-D", "-", "-w",
             "MEASURE %{http_code} %{time_total} %{time_starttransfer} %{size_download}",
             f"https://{site}.observe.tw/"],
            capture_output=True, text=True,
        )
        fields = result.stdout.rsplit("MEASURE ", 1)[-1].split()
        rows.append({
            "site": site, "start": start, "end": utc(), "exit": result.returncode,
            "http": int(fields[0]) if len(fields) == 4 else 0,
            "time": float(fields[1]) if len(fields) == 4 else 999,
            "ttfb": float(fields[2]) if len(fields) == 4 else 999,
            "bytes": int(fields[3]) if len(fields) == 4 else 0,
            "cfCacheStatus": next((line.split(":", 1)[1].strip()
                for line in result.stdout.splitlines()
                if line.lower().startswith("cf-cache-status:")), None),
        })

medians = {site: statistics.median(row["time"] for row in rows if row["site"] == site)
           for site in ["tag", "blog", "youtube"]}
loads = os.getloadavg()
receipt = {
    "utc": utc(), "source": "SM local DNT:1 full HTML, three per site, median time_total",
    "timeMeaning": "includes origin, Cloudflare edge and network; not isolated origin rendering",
    "baselineUtc": "2026-10-13T05:47Z",
    "baselineMethod": "DNT:1 full HTML curl, five per site, median time_total",
    "baselines": {"tag": 0.256, "blog": 3.085, "youtube": 0.289},
    "gates": {"tag": 2.0, "blog": 6.17, "youtube": 2.0},
    "rows": rows, "medians": medians,
    "medianTtfb": {site: statistics.median(row["ttfb"] for row in rows if row["site"] == site)
                   for site in medians},
    "homeGiB": shutil.disk_usage("/home").free / 2**30,
    "load1": loads[0], "load5": loads[1], "load15": loads[2],
    "uptime": subprocess.check_output(["uptime"], text=True).strip(),
    "memAvailableGiB": int(next(line.split()[1] for line in Path("/proc/meminfo")
        .read_text().splitlines() if line.startswith("MemAvailable:"))) / 1024**2,
}
with os.fdopen(os.open(sys.argv[1], os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w") as out:
    json.dump(receipt, out, indent=2)
print(json.dumps({key: value for key, value in receipt.items() if key != "rows"}))
assert all(row["exit"] == 0 and row["http"] == 200 for row in rows), "HTTP/curl gate failed"
assert loads[0] < 12 and all(medians[site] <= receipt["gates"][site] for site in medians), "load/latency gate failed"
