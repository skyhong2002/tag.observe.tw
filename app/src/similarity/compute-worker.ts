import { parentPort, workerData } from 'node:worker_threads';
import { buildGraph, type ContentRow, computeSimilarity } from './compute.ts';

const { rows, threshold, focus } = workerData as { rows: ContentRow[]; threshold: number; focus?: number[] };
const result = computeSimilarity(rows, threshold, focus ? new Set(focus) : undefined);
parentPort!.postMessage({ ...result, ...buildGraph(rows, result.pairs) });
