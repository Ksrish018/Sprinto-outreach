-- v5 discovery: news feeds fill a company pool every day; a cheap compliance pre-check runs before research.

-- One row per company seen in the news. Kept between runs; expires after 30 days if never researched.
create table leads (
  id            serial primary key,
  domain        text not null unique,
  name          text not null,
  round         text,                  -- Seed, Series A, Series B, Series C, later, unknown
  amount        text,
  sector        text,
  saas          text not null default 'unsure' check (saas in ('yes', 'no', 'unsure')),
  headline      text not null,
  article_url   text not null,
  feed          text not null,         -- feed id from src/lib/feeds/sources.ts
  published_at  timestamptz,
  status        text not null default 'new'
                check (status in ('new', 'ready', 'compliant', 'unreachable', 'queued', 'researched', 'expired', 'excluded')),
  precheck      jsonb,                 -- { verdict, tool, badges[], pages[], checked_at }
  priority      int not null default 0,
  status_reason text,
  first_seen_at timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index leads_status_priority on leads (status, priority desc);

-- Every feed read, so the funnel and Loop health can show yield per source.
create table feed_reads (
  id          serial primary key,
  feed        text not null,
  read_at     timestamptz not null default now(),
  ok          boolean not null,
  items       int not null default 0,
  funding     int not null default 0,  -- items whose headline looks like a funding round
  new_leads   int not null default 0,
  error       text
);
create index feed_reads_at on feed_reads (read_at desc);

-- Lead links into the run queue, so a company page can say which headline found it.
alter table companies add column if not exists lead_id int references leads(id);

-- Feed articles already read, so a headline is sent to the AI once, not every day it stays in a feed.
create table feed_items (
  url      text primary key,
  feed     text not null,
  seen_at  timestamptz not null default now()
);
