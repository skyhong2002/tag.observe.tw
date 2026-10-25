// Match home.module.css: 32px main gutters, 20px grid gaps, a 220px
// minimum sidebar in the 2-column layout, then .85fr/2fr/1fr at >1000px.
// Hero subtracts its 2px border; stories also subtract their inner padding.
// Keep the small upward rounding (<1px) so high-DPR screens are not undersized.
export const homeImageSizes = {
  hero: '(max-width: 640px) calc(100vw - 34px), (max-width: 690px) calc(100vw - 274px), (max-width: 1000px) calc(65.52vw - 36.06px), (max-width: 1152px) calc(51.95vw - 39.4px), 560px',
  story:
    '(max-width: 640px) calc(28vw - 17.36px), (max-width: 690px) calc(27vw - 82.62px), (max-width: 1000px) calc(17.69vw - 18.37px), (max-width: 1152px) calc(14.03vw - 19.27px), 143px',
  topic: '72px',
} as const;
