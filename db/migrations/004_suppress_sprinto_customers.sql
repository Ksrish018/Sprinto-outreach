-- Sprinto's own customers, from the public customer stories on sprinto.com (FR-2.4).
-- A customer's site does not always say it uses Sprinto, so the list is the reliable guard.
insert into suppression (domain, reason) values
  ('rocketlane.com', 'Sprinto customer (sprinto.com story)'),
  ('spendflo.com', 'Sprinto customer (sprinto.com story)'),
  ('zipy.ai', 'Sprinto customer (sprinto.com story)'),
  ('scribbledata.io', 'Sprinto customer (sprinto.com story)'),
  ('webengage.com', 'Sprinto customer (sprinto.com story)'),
  ('zeto.co', 'Sprinto customer (sprinto.com story)'),
  ('siterocketlabs.com', 'Sprinto customer (sprinto.com story)'),
  ('risr.global', 'Sprinto customer (sprinto.com story)')
on conflict (domain) do nothing;
