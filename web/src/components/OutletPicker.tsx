'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import MediaIcon from '@/components/MediaIcon';
import SuggestInput from '@/components/SuggestInput';

// Searchable stand-in for a long 「全部媒體」 <select>: type a few characters of
// the outlet's name (or its id) to narrow the list. Clearing the box means all
// outlets; leaving it with unmatched text restores the current choice.

/** `noIcon` for entries that are not an outlet (e.g. a selected pair on the graph). */
export type OutletOption = { media: string; name: string; count?: number; noIcon?: boolean };

export default function OutletPicker({
  outlets,
  value,
  onChange,
  unit = '人',
  placeholder = '全部媒體',
  className = '',
  id,
}: {
  outlets: OutletOption[];
  value: string;
  onChange: (media: string) => void;
  unit?: string;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  const selected = outlets.find((outlet) => outlet.media === value);
  const [text, setText] = useState(selected?.name ?? '');
  useEffect(() => setText(selected?.name ?? ''), [selected?.name]);
  const suggest = useCallback(
    (typed: string) => {
      const needle = typed.toLocaleLowerCase();
      const matches =
        !typed || typed === selected?.name
          ? outlets
          : outlets.filter((outlet) => outlet.name.toLocaleLowerCase().includes(needle) || outlet.media.includes(needle));
      return matches.map((outlet) => ({
        key: outlet.media,
        label: outlet.name,
        icon: outlet.noIcon ? undefined : <MediaIcon media={outlet.media} title={outlet.name} size={14} />,
        hint: outlet.count === undefined ? undefined : `${outlet.count.toLocaleString('zh-TW')} ${unit}`,
      }));
    },
    [outlets, selected?.name, unit],
  );
  return (
    <SuggestInput
      type="search"
      id={id}
      value={text}
      placeholder={placeholder}
      showOnEmpty
      limit={outlets.length}
      className={className}
      onValueChange={(next) => {
        setText(next);
        if (!next.trim() && value) onChange('');
      }}
      suggest={suggest}
      onPick={(item) => {
        setText(item.label);
        onChange(item.key);
      }}
      onBlur={() => setText(selected?.name ?? '')}
    />
  );
}

/** OutletPicker inside a plain GET form: the choice travels as a hidden field. */
export function FormOutletPicker({
  name,
  defaultValue = '',
  submitOnPick = false,
  ...props
}: Omit<Parameters<typeof OutletPicker>[0], 'value' | 'onChange'> & { name: string; defaultValue?: string; submitOnPick?: boolean }) {
  const [value, setValue] = useState(defaultValue);
  const hidden = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={hidden} type="hidden" name={name} value={value} />
      <OutletPicker
        {...props}
        value={value}
        onChange={(media) => {
          flushSync(() => setValue(media));
          if (submitOnPick) hidden.current?.form?.requestSubmit();
        }}
      />
    </>
  );
}
