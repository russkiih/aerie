# Autopilot posts

Markdown files here are committed by the Blog Autopilot (frontmatter: `title`, `excerpt`, `date`,
`slug`, `tags`). `scripts/build-autopilot-posts.mjs` renders them into `lib/blog-autopilot.json`
on every build; `lib/site-nav.ts` merges them into `POSTS` (so they appear on /blog/ and in the
"keep reading" cards) and `app/blog/[slug]/page.tsx` renders the pre-built HTML in `PostLayout`.
