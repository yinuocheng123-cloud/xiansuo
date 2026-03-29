-- 文件说明：第二个迁移文件，补省份字段以及任务进度/失败/重试支撑字段。
-- 功能说明：支持省级任务、结果按省筛选、任务抓取过程可观测。

alter table tasks add column if not exists province varchar(64);
alter table tasks alter column city drop not null;
alter table tasks add column if not exists latest_progress jsonb not null default '{}'::jsonb;
alter table tasks add column if not exists failure_samples jsonb not null default '[]'::jsonb;
alter table tasks add column if not exists retry_records jsonb not null default '[]'::jsonb;

alter table leads add column if not exists province varchar(64);

create index if not exists idx_leads_province on leads (province);
