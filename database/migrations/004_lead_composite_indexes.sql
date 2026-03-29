-- 文件说明：该文件为线索查询补充第二批组合索引。
-- 功能说明：覆盖任务详情页、结果页、线索库页的高频筛选与排序路径，减少仅靠单列索引时的回表压力。
--
-- 结构概览：
--   第一部分：任务详情读取索引
--   第二部分：结果与线索库通用排序索引
--   第三部分：按地区、来源与品牌的组合筛选索引

-- ========== 第一部分：任务详情读取索引 ==========
-- 任务详情页会按 task_id 过滤，并按匹配分和创建时间倒序展示最近线索。
create index if not exists idx_leads_task_score_created
  on leads (task_id, match_score desc, created_at desc);

-- ========== 第二部分：结果与线索库通用排序索引 ==========
-- 结果页和线索库页都经常先按审核状态分组，再按匹配分与时间排序。
create index if not exists idx_leads_review_status_score_created
  on leads (review_status, match_score desc, created_at desc);

-- ========== 第三部分：按地区、来源与品牌的组合筛选索引 ==========
-- 省市筛选是当前后台最常见的运营查询路径，这里单独补一条组合索引。
create index if not exists idx_leads_region_score_created
  on leads (province, city, match_score desc, created_at desc);

-- 来源平台 + 线索类型经常一起出现，适合作为后台筛选兜底索引。
create index if not exists idx_leads_platform_type_score_created
  on leads (source_platform, lead_type, match_score desc, created_at desc);

-- 品牌筛选经常配合排序使用，但空品牌比例较高，因此做部分索引更稳妥。
create index if not exists idx_leads_brand_score_created
  on leads (brand, match_score desc, created_at desc)
  where brand is not null and brand <> '';
