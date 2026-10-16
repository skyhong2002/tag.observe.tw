import { tabClass, tabRowClass } from '@/components/SectionTabs';

/** TabRow for a switch held in client state rather than the URL (表格單位, 檢視方式). */
export default function TabButtons<T extends string>({
  label,
  options,
  value,
  onChange,
  className = '',
}: {
  label: string;
  options: ReadonlyArray<readonly [T, string]>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <fieldset className={`min-w-0 ${tabRowClass} ${className}`}>
      <legend className="sr-only">{label}</legend>
      {options.map(([option, text]) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={tabClass(value === option)}
        >
          {text}
        </button>
      ))}
    </fieldset>
  );
}
