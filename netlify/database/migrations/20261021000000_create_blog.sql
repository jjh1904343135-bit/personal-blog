CREATE TABLE blog_posts (
  id UUID PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('algorithms','agent','interviews','deployment','systems','backend')),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  article_date DATE NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  reading_time TEXT NOT NULL DEFAULT '约 8 分钟',
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category, slug)
);

CREATE TABLE blog_drafts (
  id UUID PRIMARY KEY,
  post_id UUID UNIQUE REFERENCES blog_posts(id) ON DELETE SET NULL,
  version UUID NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('algorithms','agent','interviews','deployment','systems','backend')),
  slug TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  article_date DATE,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  reading_time TEXT NOT NULL DEFAULT '约 8 分钟',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE blog_media (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX blog_posts_recent ON blog_posts (article_date DESC, published_at DESC);
CREATE INDEX blog_posts_category_recent ON blog_posts (category, article_date DESC);
CREATE INDEX blog_drafts_recent ON blog_drafts (updated_at DESC);
