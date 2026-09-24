-- Mission 4: one row per webhook event
create table if not exists email_events (
  svix_id     text primary key,            -- dedupe key from the svix-id header
  email_id    text not null,
  type        text not null,               -- email.delivered, email.bounced, ...
  occurred_at timestamptz not null,
  to_address  text[],
  subject     text,
  tag         text,                        -- tags[].value where name = 'category'
  bounce      jsonb,                       -- data.bounce for bounced events
  raw         jsonb not null
);
create index if not exists email_events_email_id_idx on email_events (email_id);
create index if not exists email_events_occurred_idx on email_events (occurred_at desc);

-- Mission 5: one row per received email (body fetched from the Receiving API)
create table if not exists inbound_emails (
  email_id     text primary key,
  message_id   text not null,              -- needed for In-Reply-To when you reply
  from_address text not null,
  to_address   text[] not null,
  subject      text,
  text_body    text,
  html_body    text,
  received_at  timestamptz not null default now(),
  attachments  jsonb,                      -- metadata only; fetch on demand
  status       text not null default 'open' -- open | replied | archived
);

-- Nobody but admins reads these; the service role (webhook) bypasses RLS to write.
alter table email_events   enable row level security;
alter table inbound_emails enable row level security;
create policy "admins read email_events" on email_events for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "admins read inbound_emails" on inbound_emails for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
