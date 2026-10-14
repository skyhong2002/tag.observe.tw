'use client';

import { useEffect, useState } from 'react';
import { fetchHomeTopics, type HomeTopicsSummary } from '@/lib/home-topics.mts';
import TopicPanel from './TopicPanel';

/** A failed ISR snapshot should recover through the public API without a full-page reload. */
export default function HomeTopicsRecovery() {
  const [topics, setTopics] = useState<HomeTopicsSummary | null>(null);
  const [pending, setPending] = useState(true);
  const [attempt, setAttempt] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the retry counter intentionally restarts this request.
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    let active = true;
    setPending(true);
    void fetchHomeTopics(controller.signal)
      .then((data) => {
        if (active) setTopics(data);
      })
      .catch(() => {
        /* Keep a compact unavailable state; retry only on an explicit click. */
      })
      .finally(() => {
        clearTimeout(timer);
        if (active) setPending(false);
      });
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [attempt]);
  return <TopicPanel topics={topics} pending={pending} onRetry={() => setAttempt((n) => n + 1)} />;
}
