import { lookupPerson, type Person } from './people.ts';
import { type Platform, type Role, socialPost, type TitleTag, titleTags } from './rules.ts';

export interface Writing {
  platform: Platform | null;
  evidence: string | null;
  poster: string | null;
  role: Role | null;
  roleSource: 'clause' | 'people' | null;
  titleTags: TitleTag[];
}

/**
 * Role precedence: an admin correction for the name, then title words in the
 * clause, then the role the name usually carries (auto entries).
 */
export function analyzeArticle(title: string, body: string, people: Map<string, Person>): Writing {
  const tags = titleTags(title);
  const post = socialPost(body);
  if (!post) return { platform: null, evidence: null, poster: null, role: null, roleSource: null, titleTags: tags };
  const base = { platform: post.platform, evidence: post.evidence, titleTags: tags };
  const found = post.name ? lookupPerson(post.name, people) : null;
  if (found?.person.source === 'admin') return { ...base, poster: found.name, role: found.person.role, roleSource: 'people' };
  if (post.roleSource === 'clause') return { ...base, poster: post.name, role: post.role, roleSource: 'clause' };
  if (found) return { ...base, poster: found.name, role: found.person.role, roleSource: 'people' };
  return { ...base, poster: post.name, role: '未知', roleSource: null };
}
