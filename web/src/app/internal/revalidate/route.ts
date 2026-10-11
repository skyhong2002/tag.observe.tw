import { revalidatePath } from 'next/cache';

// Rebuild these pages now (app/src/pictures/refresh.ts): the gateway calls this
// after a tag's picture changes. Only the gateway reaches it: this server
// listens on localhost and the gateway answers /internal/ from outside itself.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { paths?: unknown };
  const paths = Array.isArray(body.paths)
    ? body.paths.filter((p): p is string => typeof p === 'string' && p.startsWith('/')).slice(0, 10)
    : [];
  for (const path of paths) revalidatePath(path);
  return Response.json({ revalidated: paths });
}
