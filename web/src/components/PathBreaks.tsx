import { Fragment } from 'react';

/** An API path that may wrap only after a slash or before a query, never mid-word. */
export default function PathBreaks({ path }: { path: string }) {
  let at = 0;
  const parts = path.split(/(?<=[/?&])/).map((text) => {
    const part = { text, at };
    at += text.length;
    return part;
  });
  return (
    <>
      {parts.map(({ text, at }) => (
        <Fragment key={at}>
          {at > 0 && <wbr />}
          {text}
        </Fragment>
      ))}
    </>
  );
}
