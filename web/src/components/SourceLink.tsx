export default function SourceLink({ url, label = '原站', className = '' }: { url: string | null; label?: string; className?: string }) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label}（另開視窗）`}
      className={`inline-flex min-h-8 items-center gap-1 whitespace-nowrap text-xs text-zinc-500 hover:text-brand-700 dark:text-zinc-400 dark:hover:text-brand-400 ${className}`}
    >
      {label}
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M14 4h6v6M20 4 10 14M10 4H4v16h16v-6" />
      </svg>
    </a>
  );
}
