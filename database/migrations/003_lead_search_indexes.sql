-- 文件说明：该文件为线索查询补充搜索与详情页相关索引。
-- 功能说明：优化任务详情页按任务读取线索，以及结果页/线索库页的 SQL 直接搜索性能。

create extension if not exists pg_trgm;

create index if not exists idx_leads_task_created_at on leads (task_id, created_at desc);
create index if not exists idx_leads_source_platform on leads (source_platform);
create index if not exists idx_leads_brand on leads (brand);

create index if not exists idx_leads_name_trgm on leads using gin (name gin_trgm_ops);
create index if not exists idx_leads_brand_trgm on leads using gin (brand gin_trgm_ops);
create index if not exists idx_leads_address_trgm on leads using gin (address gin_trgm_ops);
create index if not exists idx_leads_raw_title_trgm on leads using gin (raw_title gin_trgm_ops);
create index if not exists idx_leads_raw_summary_trgm on leads using gin (raw_summary gin_trgm_ops);
create index if not exists idx_leads_source_url_trgm on leads using gin (source_url gin_trgm_ops);
