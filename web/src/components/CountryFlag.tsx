export default function CountryFlag({ code, country }: { code?: string; country?: string }) {
  const label = country ?? '待確認';
  const flag =
    code === 'INT'
      ? '🌐'
      : code && code !== 'ZZ' && /^[A-Z]{2}$/.test(code)
        ? String.fromCodePoint(...Array.from(code, (letter) => 127397 + letter.charCodeAt(0)))
        : '◇';
  return (
    <span role="img" aria-label={label} title={label} className="shrink-0 text-sm leading-none">
      {flag}
    </span>
  );
}
