// Shared with the web app, which cannot import the database layer.
export interface RelatedArticle {
  id: number;
  media: string;
  mediaTitle: string;
  title: string;
  image: string | null;
  publishedAt: string;
  sharedTags: string[];
}
export interface ArticleRelated {
  articleId: number;
  windowDays: number;
  /** The article's keywords with how widely they were used within the window. */
  tags: Array<{ tag: string; articles: number; media: number }>;
  events: Array<{ id: number; title: string; firstTime: string; lastTime: string; sharedTags: string[] }>;
  otherMedia: RelatedArticle[];
  sameMedia: RelatedArticle[];
}
