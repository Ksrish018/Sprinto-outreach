-- Default ICP v1 (PRD §6). Weights and thresholds are proposals the Growth Lead can change in Settings.
insert into icp_versions (weights, thresholds, note) values (
  '{"audit_prep": 30, "enterprise_pressure": 25, "funding_a_to_c": 15, "client_size": 10,
    "regulated_industry": 10, "cloud_stack": 5, "geography": 5}',
  '{"go_score": 50, "near_miss_min": 45, "employees_min": 20, "employees_max": 500,
    "employees_drop_below": 10, "employees_drop_above": 1000, "max_fetches": 15, "max_seconds": 120}',
  'v1 starting point (PRD v1.1)'
);

-- Sprinto itself and its direct competitors are never prospected.
insert into suppression (domain, reason) values
  ('sprinto.com', 'own company'),
  ('vanta.com', 'competitor'),
  ('drata.com', 'competitor'),
  ('secureframe.com', 'competitor');
