'use client';

import { type ReactNode, useState } from 'react';

/** Table rows beyond the first few, hidden behind a toggle row. The rows are
 *  rendered by the server; this only decides whether they show, so there is
 *  nothing to re-sort or re-format on the client. */
export default function ExpandRows({
  rest,
  hidden,
  shown,
  colSpan,
}: {
  rest: ReactNode;
  /** How many rows `rest` holds, for the button label. */
  hidden: number;
  /** How many rows stay visible when folded. */
  shown: number;
  colSpan: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && rest}
      <tr>
        <td colSpan={colSpan} className="px-3 py-1.5 text-center">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="rounded-md px-3 py-1 text-xs text-brand-700 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-zinc-800"
          >
            {open ? `只顯示前 ${shown} 家 ▲` : `展開其餘 ${hidden} 家 ▼`}
          </button>
        </td>
      </tr>
    </>
  );
}
