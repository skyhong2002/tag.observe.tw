'use client';

import { useCallback, useMemo } from 'react';
import MediaIcon from '@/components/MediaIcon';
import SuggestInput from '@/components/SuggestInput';
import type { SuggestItem } from './FormSuggestInput';

// SuggestInput for boxes that filter a list already on the page (outlet
// tables, keyword lists). Suggestions come from that list; picking one puts its
// value in the box, so the list narrows to it.

export default function FilterSuggestInput({
  items,
  value,
  onValueChange,
  ...input
}: {
  items: SuggestItem[];
  value: string;
  onValueChange: (value: string) => void;
  id?: string;
  type?: 'search' | 'text';
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  wrapperClassName?: string;
  'aria-label'?: string;
}) {
  const byKey = useMemo(() => new Map(items.map((item) => [item.value, item])), [items]);
  const suggest = useCallback(
    (typed: string) => {
      const needle = typed.toLocaleLowerCase();
      return [...byKey.values()]
        .filter((item) => `${item.value} ${item.label ?? ''} ${item.hint ?? ''}`.toLocaleLowerCase().includes(needle))
        .map((item) => ({
          key: item.value,
          label: item.label ?? item.value,
          hint: item.hint,
          icon: item.media ? <MediaIcon media={item.media} size={14} /> : undefined,
        }));
    },
    [byKey],
  );
  return (
    <SuggestInput
      {...input}
      value={value}
      onValueChange={onValueChange}
      suggest={suggest}
      onPick={(picked) => onValueChange(byKey.get(picked.key)?.value ?? picked.key)}
    />
  );
}
