import { filterChipClass, filterLabelClass, filterRowClass } from '@/components/FilterChips';

/** FilterChips for a filter held in client state rather than the URL (期間, 關係). */
export default function FilterButtons<T extends string | number>({
  label,
  options,
  value,
  onChange,
  showLabel = false,
  className = '',
  children,
}: {
  label: string;
  options: ReadonlyArray<readonly [T, string]>;
  value: T;
  onChange: (value: T) => void;
  showLabel?: boolean;
  className?: string;
  /** Printed after the chips, e.g. the dates the period covers. */
  children?: React.ReactNode;
}) {
  return (
    <fieldset className={`min-w-0 ${filterRowClass} ${className}`}>
      <legend className="sr-only">{label}</legend>
      {showLabel && (
        <span aria-hidden="true" className={filterLabelClass}>
          {label}
        </span>
      )}
      {options.map(([option, text]) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={filterChipClass(value === option)}
        >
          {text}
        </button>
      ))}
      {children}
    </fieldset>
  );
}
