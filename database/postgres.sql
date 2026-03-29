-- 文件说明：该文件定义高定木作公开商务线索采集系统当前版本的 PostgreSQL 全量结构快照。
-- 功能说明：提供迁移记录表、任务表、线索表和当前索引基线，便于人工核查和全量初始化参考。
--
-- 结构概览：
--   第一部分：扩展与迁移记录表
--   第二部分：任务表
--   第三部分：线索表
--   第四部分：索引

-- ========== 第一部分：扩展与迁移记录表 ==========
create extension if not exists pg_trgm;

create table if not exists schema_migrations (
  version varchar(255) primary key,
  applied_at timestamptz not null default now()
);

-- ========== 第二部分：任务表 ==========
create table if not exists tasks (
  id varchar(64) primary key,
  keyword varchar(255) not null,
  province varchar(64),
  city varchar(64),
  source_scope jsonb not null default '[]'::jsonb,
  planned_count integer not null default 10,
  completed_count integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  status varchar(32) not null default 'pending',
  latest_progress jsonb not null default '{}'::jsonb,
  failure_samples jsonb not null default '[]'::jsonb,
  retry_records jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  last_error text
);

-- ========== 第三部分：线索表 ==========
create table if not exists leads (
  id varchar(64) primary key,
  task_id varchar(64) not null references tasks(id) on delete cascade,
  name varchar(255) not null,
  brand varchar(255),
  province varchar(64),
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

-- ========== 第四部分：索引 ==========
create unique index if not exists idx_leads_source_url on leads (source_url);
create index if not exists idx_leads_review_status on leads (review_status);
create index if not exists idx_leads_city on leads (city);
create index if not exists idx_leads_province on leads (province);
create index if not exists idx_leads_lead_type on leads (lead_type);
create index if not exists idx_leads_task_created_at on leads (task_id, created_at desc);
create index if not exists idx_leads_task_score_created on leads (task_id, match_score desc, created_at desc);
create index if not exists idx_leads_source_platform on leads (source_platform);
create index if not exists idx_leads_brand on leads (brand);
create index if not exists idx_leads_review_status_score_created on leads (review_status, match_score desc, created_at desc);
create index if not exists idx_leads_region_score_created on leads (province, city, match_score desc, created_at desc);
create index if not exists idx_leads_platform_type_score_created on leads (source_platform, lead_type, match_score desc, created_at desc);
create index if not exists idx_leads_brand_score_created on leads (brand, match_score desc, created_at desc)
  where brand is not null and brand <> '';
create index if not exists idx_leads_name_trgm on leads using gin (name gin_trgm_ops);
create index if not exists idx_leads_brand_trgm on leads using gin (brand gin_trgm_ops);
create index if not exists idx_leads_address_trgm on leads using gin (address gin_trgm_ops);
create index if not exists idx_leads_raw_title_trgm on leads using gin (raw_title gin_trgm_ops);
create index if not exists idx_leads_raw_summary_trgm on leads using gin (raw_summary gin_trgm_ops);
create index if not exists idx_leads_source_url_trgm on leads using gin (source_url gin_trgm_ops);
create index if not exists idx_tasks_status on tasks (status);
