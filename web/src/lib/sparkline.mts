/** Separate runs preserve missing samples instead of drawing across gaps. */
export function sparklineRuns(values: readonly (number | null)[], rank = false) {
  const finite = values.filter((v): v is number => v !== null && Number.isFinite(v));
  const min = rank ? 1 : 0;
  const max = Math.max(rank ? 10 : 1, ...finite);
  const runs: Array<Array<[number, number]>> = [];
  let run: Array<[number, number]> = [];
  values.forEach((value, index) => {
    if (value === null || !Number.isFinite(value)) {
      if (run.length) runs.push(run);
      run = [];
      return;
    }
    const x = 2 + (values.length <= 1 ? 46 : (index / (values.length - 1)) * 92);
    const ratio = (value - min) / (max - min);
    const y = rank ? 5 + ratio * 24 : 30 - ratio * 26;
    run.push([Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
  });
  if (run.length) runs.push(run);
  return runs;
}
