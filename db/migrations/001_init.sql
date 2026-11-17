-- Sprinto Outreach: initial schema (PRD §9 data model).
create extension if not exists vector;

create table icp_versions (
  id          serial primary key,
  weights     jsonb not null,
  thresholds  jsonb not null,
  note        text,
  created_at  timestamptz not null default now()
);

create table prompt_versions (
  id          serial primary key,
  name        text not null,            -- e.g. 'draft', 'extract'
  body        text not null,
  healthy     boolean not null default true,
  note        text,
  created_at  timestamptz not null default now()
);

create table runs (
  id              serial primary key,
  trigger         text not null check (trigger in ('cron', 'manual', 'domains', 'test')),
  icp_version_id  int references icp_versions(id),
  status          text not null default 'running' check (status in ('running', 'done', 'failed', 'paused')),
  counts          jsonb not null default '{}',
  started_at      timestamptz not null default now(),
  finished_at     timestamptz
);

create table companies (
  id                  serial primary key,
  domain              text not null unique,
  name                text,
  first_seen_run      int references runs(id),
  last_researched_at  timestamptz,
  source              text,
  why_picked          text,
  created_at          timestamptz not null default now()
);

create table pages (
  id              serial primary key,
  company_id      int not null references companies(id) on delete cascade,
  url             text not null,
  fetched_at      timestamptz not null default now(),
  status          int,
  via             text check (via in ('plain', 'jina', 'api')),
  word_count      int,
  failure_reason  text check (failure_reason in ('robots', 'bot_check', 'rate_limit', 'login_wall', 'captcha',
                                                 'non_text', 'empty', 'off_domain', 'timeout', 'http_error')),
  cleaned_text    text,
  unique (company_id, url)
);

create table facts (
  id           serial primary key,
  company_id   int not null references companies(id) on delete cascade,
  run_id       int references runs(id),
  question_id  text not null check (question_id ~ '^Q[1-8]$'),
  value        text not null,
  quote        text not null,
  source_url   text not null,
  source_rung  text not null check (source_rung in ('api', 'provider', 'search', 'scrape')),
  verified     boolean not null default false,
  created_at   timestamptz not null default now()
);

create table decisions (
  id          serial primary key,
  company_id  int not null references companies(id) on delete cascade,
  run_id      int references runs(id),
  outcome     text not null check (outcome in ('go', 'go_flag', 'human', 'no_go')),
  score       int,
  gates       jsonb not null default '{}',
  triggers    jsonb not null default '{}',
  reasons     jsonb not null default '[]',
  flags       jsonb not null default '[]',
  override    jsonb,                     -- Growth Lead's decision on a Human-review company
  created_at  timestamptz not null default now()
);

create table contacts (
  id                 serial primary key,
  company_id         int not null references companies(id) on delete cascade,
  name               text not null,
  title              text,
  email              text not null,
  hunter_confidence  int,
  verify_status      text,
  pick_reason        text,
  created_at         timestamptz not null default now()
);

create table drafts (
  id              serial primary key,
  company_id      int not null references companies(id) on delete cascade,
  contact_id      int references contacts(id),
  run_id          int references runs(id),
  subject         text not null,
  hook            text not null,
  body            text not null,
  cta             text not null,
  hook_fact_id    int references facts(id),
  claim_map       jsonb not null default '{}',
  pains           jsonb not null default '[]',
  segment         text,                  -- role group x trigger, e.g. 'cto:audit_prep'
  stage           text,                  -- funding stage
  prompt_version  int references prompt_versions(id),
  memory_ids      int[] not null default '{}',
  gmail_draft_id  text,
  thread_id       text,
  status          text not null default 'drafted'
                  check (status in ('drafted', 'in_gmail', 'sent_edited', 'sent_as_is', 'discarded', 'blocked')),
  created_at      timestamptz not null default now(),
  unique (company_id, run_id)
);

-- Loop 3 memory: one row per edited draft. Before, after, delta, reason and context stay together.
create table corrections (
  id              serial primary key,
  draft_id        int not null references drafts(id) on delete cascade,
  reviewer        text not null,
  before_text     text not null,
  after_text      text not null,
  delta           jsonb not null,        -- per part: hook / body / cta, words changed
  reason          text,
  reason_source   text check (reason_source in ('stated', 'inferred')),
  segment         text not null,
  stage           text,
  role_group      text not null,
  industry        text,
  situation_text  text not null,         -- what is embedded: the situation, not the fix
  embedding       vector(768),
  search_text     tsvector generated always as (to_tsvector('english', situation_text)) stored,
  created_at      timestamptz not null default now()
);
create index corrections_filter_idx on corrections (reviewer, role_group, stage);
create index corrections_embedding_idx on corrections using hnsw (embedding vector_cosine_ops);
create index corrections_search_idx on corrections using gin (search_text);

create table sends (
  id                serial primary key,
  draft_id          int not null unique references drafts(id) on delete cascade,
  gmail_message_id  text,
  thread_id         text,
  outcome           text check (outcome in ('edited', 'accepted', 'discarded')),
  sent_at           timestamptz
);

create table events (
  id        serial primary key,
  send_id   int references sends(id) on delete cascade,
  type      text not null check (type in ('open', 'reply', 'bounce', 'unsubscribe', 'deal_stage')),
  value     jsonb,
  at        timestamptz not null default now()
);

create table kill_state (
  id             int primary key default 1 check (id = 1),
  is_on          boolean not null default false,
  fired_line     text,
  numbers        jsonb,
  post_mortem    text,
  fired_at       timestamptz,
  resumed_at     timestamptz,
  resume_reason  text
);
insert into kill_state (id) values (1);

create table suppression (
  domain    text primary key,
  reason    text not null,
  added_at  timestamptz not null default now()
);

create table audit_log (
  id      serial primary key,
  actor   text not null check (actor in ('system', 'growth_lead')),
  action  text not null,
  entity  text,
  before  jsonb,
  after   jsonb,
  at      timestamptz not null default now()
);

create table api_ledger (
  id               serial primary key,
  test_id          text,
  run_id           int references runs(id),
  api              text not null check (api in ('gemini', 'gemini_search', 'gemini_embed', 'hunter_search',
                                                 'hunter_verify', 'hubspot', 'gmail', 'jina')),
  endpoint         text not null,
  credits_used     numeric not null default 0,
  remaining_after  numeric,
  at               timestamptz not null default now()
);
create index api_ledger_month_idx on api_ledger (api, at);
