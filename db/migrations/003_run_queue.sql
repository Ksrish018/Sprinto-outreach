-- M2: per-run work queue, so each company is its own resumable step (FR-1.5).
create table run_companies (
  run_id       int not null references runs(id) on delete cascade,
  company_id   int not null references companies(id) on delete cascade,
  status       text not null default 'queued'
               check (status in ('queued', 'researching', 'qualified', 'failed', 'skipped')),
  stop_reason  text,
  fetches      int not null default 0,
  attempts     int not null default 0,
  timeline     jsonb not null default '[]',   -- research steps: source, rung, why picked, result
  error        text,
  updated_at   timestamptz not null default now(),
  primary key (run_id, company_id)
);
create index run_companies_status_idx on run_companies (run_id, status);

-- Which field of the Evidence Map question a fact fills (e.g. Q1 'pricing_plans').
alter table facts add column field text;
create index facts_company_idx on facts (company_id, run_id);
create index decisions_company_idx on decisions (company_id, run_id);
