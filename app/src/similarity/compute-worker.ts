import { parentPort, workerData } from 'node:worker_threads';
import { buildGraph, type ContentRow, computeSimilarity } from './compute.ts';

const { rows, threshold } = workerData as { rows: ContentRow[]; threshold: number };
const result = computeSimilarity(rows, threshold);
parentPort!.postMessage({ ...result, ...buildGraph(rows, result.pairs) });
