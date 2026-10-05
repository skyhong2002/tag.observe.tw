import { API_ORIGIN } from './api';
import { type Observation, publicObservation } from './observation.mts';

export async function fetchObservation(): Promise<Observation | null> {
  try {
    const response = await fetch(`${API_ORIGIN}/api/v1/site-observation`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const { snapshot } = await response.json();
    return snapshot ? publicObservation(snapshot) : null;
  } catch {
    return null;
  }
}
