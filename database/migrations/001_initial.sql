-- 文件说明：首个迁移文件，建立基础任务表和线索表。
-- 功能说明：用于新数据库的基础表结构初始化，同时对已有库保持幂等。

create table if not exists tasks (
  id varchar(64) primary key,
  keyword varchar(255) not null,
  city varchar(64),
  source_scope jsonb not null default '[]'::jsonb,
  planned_count integer not null default 10,
  completed_count integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  status varchar(32) not null default 'pending',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  last_error text
);

create table if not exists leads (
  id varchar(64) primary key,
  task_id varchar(64) not null references tasks(id) on delete cascade,
  name varchar(255) not null,
  brand varchar(255),
  city varchar(64),
  contact varchar(255),
  address text,
  lead_type varchar(64) not null,
  source_platform varchar(64) not null,
  source_url text not null,
  match_score integer not null default 0,
  review_status varchar(16) not null default '待审核',
  raw_title text,
  raw_summary text,
  score_reasons jsonb not null default '[]'::jsonb,
  signals jsonb not null default '{}'::jsonb,
  duplicate_state varchar(32) not null default 'normal',
  duplicate_of varchar(64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_leads_source_url on leads (source_url);
create index if not exists idx_leads_review_status on leads (review_status);
create index if not exists idx_leads_city on leads (city);
create index if not exists idx_leads_lead_type on leads (lead_type);
create index if not exists idx_tasks_status on tasks (status);
