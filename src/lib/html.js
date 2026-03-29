/**
 * 文件说明：该文件提供 HTML 文本清洗与基础提取工具。
 * 功能说明：从原始页面中提取 title、H1、纯文本摘要，并做最基础的实体解码。
 *
 * 结构概览：
 *   第一部分：实体与标签处理
 *   第二部分：标题与元信息提取
 *   第三部分：结构化数据提取
 *   第四部分：摘要与行文本提取
 */

// ========== 第一部分：实体与标签处理 ==========
function decodeEntities(input) {
  return String(input || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function stripTags(html) {
  return decodeEntities(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

// ========== 第二部分：标题提取 ==========
function extractTitle(html) {
  const match = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripTags(match[1]).trim() : "";
}

function extractH1(html) {
  const match = String(html || "").match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? stripTags(match[1]).trim() : "";
}

function extractMetaContent(html, key) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["'][^>]*>`, "i")
  ];

  for (const pattern of patterns) {
    const match = String(html || "").match(pattern);
    if (match) {
      return decodeEntities(match[1]).trim();
    }
  }

  return "";
}

// ========== 第三部分：结构化数据提取 ==========
function extractJsonLdObjects(html) {
  const objects = [];
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = regex.exec(String(html || "")))) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const candidates = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of candidates) {
        if (!item) {
          continue;
        }

        if (Array.isArray(item["@graph"])) {
          objects.push(...item["@graph"]);
        } else {
          objects.push(item);
        }
      }
    } catch (error) {
      // 结构化数据经常夹杂注释或不严格 JSON，这里容错跳过，避免影响主流程。
    }
  }

  return objects.filter(Boolean);
}

// ========== 第四部分：摘要与行文本提取 ==========
function extractExcerpt(html, length = 420) {
  return stripTags(html).slice(0, length);
}

function extractLinesAroundKeyword(text, keyword) {
  const source = String(text || "");
  const index = source.indexOf(keyword);
  if (index < 0) {
    return "";
  }

  const start = Math.max(0, index - 40);
  const end = Math.min(source.length, index + 100);
  return source.slice(start, end).trim();
}

function extractTextLines(text) {
  return String(text || "")
    .split(/[\n\r。；;|｜]/)
    .map((line) => line.trim())
    .filter(Boolean);
}

module.exports = {
  stripTags,
  extractTitle,
  extractH1,
  extractMetaContent,
  extractJsonLdObjects,
  extractExcerpt,
  extractLinesAroundKeyword,
  extractTextLines
};
