/**
 * 文件说明：该文件实现 PostgreSQL 存储层。
 * 功能说明：负责数据库创建、迁移执行、任务与线索的读写，以及演示数据整体写入。
 *
 * 结构概览：
 *   第一部分：数据库初始化与迁移
 *   第二部分：行映射与基础工具
 *   第三部分：任务与线索访问函数
 */

const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { Pool } = require("pg");

// ========== 第一部分：数据库初始化与迁移 ==========
const DEFAULT_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/xiansuo_leads";
const MIGRATION_DIR = path.join(process.cwd(), "database", "migrations");

let pool = null;
let storageReadyPromise = null;

function getDatabaseUrl() {
  return process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl()
    });
  }

  return pool;
}

async function ensureDatabaseExists() {
  const databaseUrl = new URL(getDatabaseUrl());
  const targetDatabase = databaseUrl.pathname.replace(/^\//, "");
  const adminUrl = new URL(databaseUrl.toString());
  adminUrl.pathname = "/postgres";

  const adminPool = new Pool({
    connectionString: adminUrl.toString()
  });

  try {
    const result = await adminPool.query("select 1 from pg_database where datname = $1", [targetDatabase]);
    if (result.rowCount === 0) {
      const safeDatabaseName = targetDatabase.replace(/"/g, "\"\"");
      await adminPool.query(`create database "${safeDatabaseName}"`);
    }
  } finally {
    await adminPool.end();
  }
}

function readMigrationFiles() {
  if (!fs.existsSync(MIGRATION_DIR)) {
    return [];
  }

  return fs.readdirSync(MIGRATION_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({
      name,
      sql: fs.readFileSync(path.join(MIGRATION_DIR, name), "utf8")
    }));
}

async function runMigrations() {
  const database = getPool();
  await database.query(`
    create table if not exists schema_migrations (
      version varchar(255) primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const applied = await database.query("select version from schema_migrations");
  const appliedVersions = new Set(applied.rows.map((row) => row.version));
  const migrations = readMigrationFiles();

  for (const migration of migrations) {
    if (appliedVersions.has(migration.name)) {
      continue;
    }

    const client = await database.connect();
    try {
      await client.query("begin");
      await client.query(migration.sql);
      await client.query("insert into schema_migrations (version) values ($1)", [migration.name]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw new Error(`迁移失败 ${migration.name}: ${error.message}`);
    } finally {
      client.release();
    }
  }
}

async function ensureStorage() {
  if (!storageReadyPromise) {
    storageReadyPromise = (async () => {
      await ensureDatabaseExists();
      await runMigrations();
    })().catch((error) => {
      storageReadyPromise = null;
      throw error;
    });
  }

  return storageReadyPromise;
}

// ========== 第二部分：行映射与基础工具 ==========
function generateId(prefix) {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${random}`;
}

function mapTaskRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    keyword: row.keyword,
    province: row.province || "",
    city: row.city || "",
    sourceScope: Array.isArray(row.source_scope) ? row.source_scope : [],
    plannedCount: row.planned_count,
    completedCount: row.completed_count,
    successCount: row.success_count,
    failureCount: row.failure_count,
    status: row.status,
    latestProgress: row.latest_progress || {},
    failureSamples: Array.isArray(row.failure_samples) ? row.failure_samples : [],
    retryRecords: Array.isArray(row.retry_records) ? row.retry_records : [],
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : "",
    startedAt: row.started_at ? new Date(row.started_at).toISOString() : "",
    finishedAt: row.finished_at ? new Date(row.finished_at).toISOString() : "",
    lastError: row.last_error || ""
  };
}

function mapLeadRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    taskId: row.task_id,
    name: row.name,
    brand: row.brand || "",
    province: row.province || "",
    city: row.city || "",
    contact: row.contact || "",
    address: row.address || "",
    leadType: row.lead_type,
    sourcePlatform: row.source_platform,
    sourceUrl: row.source_url,
    matchScore: row.match_score,
    reviewStatus: row.review_status,
    rawTitle: row.raw_title || "",
    rawSummary: row.raw_summary || "",
    scoreReasons: Array.isArray(row.score_reasons) ? row.score_reasons : [],
    signals: row.signals || {},
    duplicateState: row.duplicate_state || "normal",
    duplicateOf: row.duplicate_of || "",
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : "",
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : ""
  };
}

async function query(text, params = []) {
  await ensureStorage();
  return getPool().query(text, params);
}

async function upsertTask(task, client = null) {
  const runner = client || getPool();
  await ensureStorage();
  await runner.query(
    `
      insert into tasks (
        id, keyword, province, city, source_scope, planned_count, completed_count,
        success_count, failure_count, status, latest_progress, failure_samples,
        retry_records, created_at, started_at, finished_at, last_error
      )
      values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15,$16,$17)
      on conflict (id) do update set
        keyword = excluded.keyword,
        province = excluded.province,
        city = excluded.city,
        source_scope = excluded.source_scope,
        planned_count = excluded.planned_count,
        completed_count = excluded.completed_count,
        success_count = excluded.success_count,
        failure_count = excluded.failure_count,
        status = excluded.status,
        latest_progress = excluded.latest_progress,
        failure_samples = excluded.failure_samples,
        retry_records = excluded.retry_records,
        created_at = excluded.created_at,
        started_at = excluded.started_at,
        finished_at = excluded.finished_at,
        last_error = excluded.last_error
    `,
    [
      task.id,
      task.keyword,
      task.province || null,
      task.city || null,
      JSON.stringify(task.sourceScope || []),
      task.plannedCount || 0,
      task.completedCount || 0,
      task.successCount || 0,
      task.failureCount || 0,
      task.status,
      JSON.stringify(task.latestProgress || {}),
      JSON.stringify(task.failureSamples || []),
      JSON.stringify(task.retryRecords || []),
      task.createdAt || null,
      task.startedAt || null,
      task.finishedAt || null,
      task.lastError || ""
    ]
  );
}

async function upsertLead(lead, client = null) {
  const runner = client || getPool();
  await ensureStorage();
  await runner.query(
    `
      insert into leads (
        id, task_id, name, brand, province, city, contact, address, lead_type, source_platform,
        source_url, match_score, review_status, raw_title, raw_summary, score_reasons,
        signals, duplicate_state, duplicate_of, created_at, updated_at
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17::jsonb,$18,$19,$20,$21)
      on conflict (id) do update set
        task_id = excluded.task_id,
        name = excluded.name,
        brand = excluded.brand,
        province = excluded.province,
        city = excluded.city,
        contact = excluded.contact,
        address = excluded.address,
        lead_type = excluded.lead_type,
        source_platform = excluded.source_platform,
        source_url = excluded.source_url,
        match_score = excluded.match_score,
        review_status = excluded.review_status,
        raw_title = excluded.raw_title,
        raw_summary = excluded.raw_summary,
        score_reasons = excluded.score_reasons,
        signals = excluded.signals,
        duplicate_state = excluded.duplicate_state,
        duplicate_of = excluded.duplicate_of,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at
    `,
    [
      lead.id,
      lead.taskId,
      lead.name,
      lead.brand || null,
      lead.province || null,
      lead.city || null,
      lead.contact || null,
      lead.address || null,
      lead.leadType,
      lead.sourcePlatform,
      lead.sourceUrl,
      Number(lead.matchScore || 0),
      lead.reviewStatus,
      lead.rawTitle || null,
      lead.rawSummary || null,
      JSON.stringify(lead.scoreReasons || []),
      JSON.stringify(lead.signals || {}),
      lead.duplicateState || "normal",
      lead.duplicateOf || null,
      lead.createdAt || null,
      lead.updatedAt || null
    ]
  );
}

// ========== 第三部分：任务与线索访问函数 ==========
async function listTasks() {
  const result = await query("select * from tasks order by created_at desc");
  return result.rows.map(mapTaskRow);
}

async function getTaskById(taskId) {
  const result = await query("select * from tasks where id = $1", [taskId]);
  return mapTaskRow(result.rows[0]);
}

function buildLeadFilterQuery(filters = {}) {
  const clauses = [];
  const params = [];
  const safeLimit = Number.isFinite(Number(filters.limit)) && Number(filters.limit) > 0 ? Math.floor(Number(filters.limit)) : 0;

  function pushClause(sql, value, transform = (input) => input) {
    params.push(transform(value));
    clauses.push(sql.replace("?", `$${params.length}`));
  }

  if (filters.taskId) {
    pushClause("task_id = ?", filters.taskId);
  }

  if (filters.reviewStatus) {
    pushClause("review_status = ?", filters.reviewStatus);
  }

  if (filters.province) {
    pushClause("province = ?", filters.province);
  }

  if (filters.city) {
    pushClause("city = ?", filters.city);
  }

  if (filters.brand) {
    pushClause("coalesce(brand, '') ilike ?", filters.brand, (input) => `%${input}%`);
  }

  if (filters.sourcePlatform) {
    pushClause("source_platform = ?", filters.sourcePlatform);
  }

  if (filters.leadType) {
    pushClause("lead_type = ?", filters.leadType);
  }

  if (filters.minScore) {
    pushClause("match_score >= ?", Number(filters.minScore));
  }

  if (filters.q) {
    params.push(`%${String(filters.q).trim()}%`);
    clauses.push(`
      (
        coalesce(name, '') ilike $${params.length}
        or coalesce(brand, '') ilike $${params.length}
        or coalesce(province, '') ilike $${params.length}
        or coalesce(city, '') ilike $${params.length}
        or coalesce(contact, '') ilike $${params.length}
        or coalesce(address, '') ilike $${params.length}
        or coalesce(raw_title, '') ilike $${params.length}
        or coalesce(raw_summary, '') ilike $${params.length}
        or coalesce(source_url, '') ilike $${params.length}
      )
    `);
  }

  const whereSql = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
  const limitSql = safeLimit ? ` limit ${safeLimit}` : "";

  return {
    text: `select * from leads ${whereSql} order by match_score desc, created_at desc${limitSql}`,
    params
  };
}

async function listLeads(filters = {}) {
  const { text, params } = buildLeadFilterQuery(filters);
  const result = await query(text, params);
  return result.rows.map(mapLeadRow);
}

async function getLeadById(leadId) {
  const result = await query("select * from leads where id = $1", [leadId]);
  return mapLeadRow(result.rows[0]);
}

async function replaceAllData({ tasks, leads }) {
  await ensureStorage();
  const client = await getPool().connect();

  try {
    await client.query("begin");
    await client.query("truncate table leads restart identity cascade");
    await client.query("truncate table tasks restart identity cascade");

    for (const task of tasks) {
      await upsertTask(task, client);
    }

    for (const lead of leads) {
      await upsertLead(lead, client);
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  ensureStorage,
  generateId,
  listTasks,
  getTaskById,
  upsertTask,
  listLeads,
  getLeadById,
  upsertLead,
  replaceAllData,
  getDatabaseUrl
};
