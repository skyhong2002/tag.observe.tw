// The page-side pointer to the footer's 本頁的資料來源與計算方式 (#method sits
// inside its <details>, which browsers open for a fragment target).
export default function MethodLink({ children = '怎麼算', className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <a href="#method" className={`whitespace-nowrap text-brand-700 hover:underline dark:text-brand-400 ${className}`}>
      {children} ⓘ
    </a>
  );
}
