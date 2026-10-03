// Provider labels on syndication platforms may identify a person and their
// affiliation, rather than a separate publisher. Only strip an explicit role.
export function reporterCredit(value: string): string | null {
  const text = value.normalize('NFKC').trim();
  const match = /^([^|｜／/]{2,50})\s*[|｜／/]\s*[^|｜／/]*(?:特派記者|記者|撰稿人|特約作者|correspondent|reporter)\s*$/iu.exec(text);
  if (!match) return null;
  const name = match[1].trim();
  return /(?:編輯室|編輯部|新聞網|通訊社)/u.test(name) ? null : name;
}
export function normalizeAuthorCredits(values: string[]): string[] {
  return [...new Set(values.map((value) => reporterCredit(value) ?? value.trim()).filter(Boolean))];
}
