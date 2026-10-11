import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { inkImage } from '../avatars/portrait.ts';
import type { Db } from '../db/client.ts';
import { tagAvatarCandidates, tagPeople } from '../db/schema.ts';

// The person behind a tag and their sketch avatar (docs/tag-avatars.md).

const SHOWN = new Set(['auto', 'review', 'chosen']);

// `v` changes whenever the shown image can change (a re-run or an admin switch), so the image itself can cache for a day.
const avatarPath = (tag: string, version: string) => `/api/v1/tags/${encodeURIComponent(tag)}/avatar?v=${version}`;

export async function tagPerson(db: Db, tag: string) {
  const [person] = await db.select().from(tagPeople).where(eq(tagPeople.tag, tag));
  if (!person?.wikidataId) return null;
  const shown = SHOWN.has(person.status) && person.shownRank ? person.shownRank : null;
  const [avatar] = shown
    ? await db
        .select({
          rank: tagAvatarCandidates.rank,
          file: tagAvatarCandidates.file,
          pageUrl: tagAvatarCandidates.pageUrl,
          license: tagAvatarCandidates.license,
          licenseUrl: tagAvatarCandidates.licenseUrl,
          artist: tagAvatarCandidates.artist,
        })
        .from(tagAvatarCandidates)
        .where(and(eq(tagAvatarCandidates.tag, tag), eq(tagAvatarCandidates.rank, shown)))
    : [];
  return {
    wikidataId: person.wikidataId,
    label: person.label,
    description: person.description,
    facts: person.facts,
    avatar: avatar
      ? {
          url: avatarPath(tag, `${((person.reviewedAt ?? person.checkedAt).getTime() / 1000).toString(36)}-${avatar.rank}`),
          file: avatar.file,
          pageUrl: avatar.pageUrl,
          license: avatar.license,
          licenseUrl: avatar.licenseUrl,
          artist: avatar.artist,
        }
      : null,
  };
}

export function registerTagPerson(app: FastifyInstance, db: Db) {
  app.get<{ Params: { tag: string } }>('/api/v1/tags/:tag/person', async (request, reply) => {
    const { tag } = request.params;
    if (tag.length > 60) return reply.code(400).send({ error: 'tag too long' });
    reply.header('cache-control', 'public, max-age=300');
    return { tag, person: await tagPerson(db, tag) };
  });

  // The shown sketch (WebP, 256×256): ink on transparent, to mask a colour with.
  app.get<{ Params: { tag: string }; Querystring: { theme?: string } }>('/api/v1/tags/:tag/avatar', async (request, reply) => {
    const { tag } = request.params;
    const [row] = await db
      .select({ image: tagAvatarCandidates.image, status: tagPeople.status })
      .from(tagPeople)
      .innerJoin(tagAvatarCandidates, and(eq(tagAvatarCandidates.tag, tagPeople.tag), eq(tagAvatarCandidates.rank, tagPeople.shownRank)))
      .where(eq(tagPeople.tag, tag));
    if (!row || !SHOWN.has(row.status)) return reply.code(404).send({ error: 'no avatar' });
    const theme = request.query.theme === 'dark' ? 'dark' : 'light';
    return reply
      .header('content-type', 'image/webp')
      .header('cache-control', 'public, max-age=86400')
      .send(await inkImage(row.image, theme));
  });
}
