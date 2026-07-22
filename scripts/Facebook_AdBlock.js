/**
 * Facebook 去广告（加强版）
 * Quantumult X / Surge / Loon - script-response-body
 *
 * 深度剥离 GraphQL / Feed 中的赞助节点
 * https://github.com/carlleilzj/Meta_AdBlock_QX
 */

const DEBUG = false;

const SPONSORED_EXACT =
  /^(sponsored|赞助|贊助|廣告|广告|promoted|推广|プロモーション|広告)$/i;

let raw = $response && $response.body;
if (raw == null) {
  $done({});
} else {
  try {
    if (typeof raw !== "string") raw = raw.toString();
    const text = raw.replace(/^\uFEFF/, "");
    if (!text || !/^\s*[\[{]/.test(text)) {
      $done({ body: raw });
    } else if (isNDJSON(text)) {
      const parts = text.split("\n").filter((l) => l.trim());
      const out = parts.map((line) => {
        try {
          const removed = { n: 0 };
          const v = walk(JSON.parse(line), removed, 0);
          if (DEBUG) console.log(`[FB AdBlock] removed=${removed.n}`);
          return JSON.stringify(v);
        } catch (_) {
          return line;
        }
      });
      $done({ body: out.join("\n") });
    } else {
      const removed = { n: 0 };
      const v = walk(JSON.parse(text), removed, 0);
      if (DEBUG) console.log(`[FB AdBlock] removed=${removed.n}`);
      $done({ body: JSON.stringify(v) });
    }
  } catch (e) {
    if (DEBUG) console.log("[FB AdBlock] err " + e);
    $done({ body: raw });
  }
}

function isNDJSON(text) {
  if (text.indexOf("\n") < 0) return false;
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return false;
  return lines.slice(0, 4).every((l) => /^\s*\{/.test(l) || /^\s*\[/.test(l));
}

function walk(node, removed, depth) {
  if (node == null || depth > 50) return node;

  if (Array.isArray(node)) {
    const next = [];
    for (let i = 0; i < node.length; i++) {
      const item = node[i];
      if (isSponsored(item) || isSponsoredEdge(item)) {
        removed.n++;
        continue;
      }
      // 字符串数组里的广告标记不处理
      next.push(walk(item, removed, depth + 1));
    }
    return next;
  }

  if (typeof node !== "object") return node;

  const keys = Object.keys(node);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const val = node[key];
    if (val == null) continue;

    // 直接抹掉赞助字段，降低前端渲染概率
    if (isSponsoredFieldKey(key)) {
      delete node[key];
      removed.n++;
      continue;
    }

    if (Array.isArray(val)) {
      node[key] = walk(val, removed, depth + 1);
    } else if (typeof val === "object") {
      if (isSponsored(val)) {
        // 用 null 占位，避免缺 key 导致部分客户端异常
        node[key] = null;
        removed.n++;
      } else {
        node[key] = walk(val, removed, depth + 1);
      }
    } else if (typeof val === "string") {
      // 把 "Sponsored" 标签掏空（避免角标）
      if (
        (key === "text" || key === "label" || key === "title") &&
        SPONSORED_EXACT.test(val.trim())
      ) {
        // 不单靠文案删节点，只在父级 isSponsored 时处理
      }
    }
  }
  return node;
}

function isSponsoredFieldKey(key) {
  return /^(sponsored_data|sponsored_label|sponsored_ad_label|sponsored_label_text|encrypted_ad_tracking_data|ad_bridge_info|ad_client_token|third_party_impression_logging|third_party_clicks_logging|ad_id|advertiser_page)$/i.test(
    key
  );
}

function isSponsoredEdge(edge) {
  if (!edge || typeof edge !== "object") return false;
  if (edge.node && isSponsored(edge.node)) return true;
  if (edge.category && /SPONSORED|ADS?|PROMOTED/i.test(String(edge.category)))
    return true;
  if (edge.bump_reason && /ad|sponsor/i.test(String(edge.bump_reason)))
    return true;
  return false;
}

function isSponsored(n) {
  if (!n || typeof n !== "object" || Array.isArray(n)) return false;

  // 明确布尔/对象
  if (n.is_sponsored === true || n.is_sponsored === 1) return true;
  if (n.sponsored_data != null) return true;
  if (n.ad_id != null || n.ad_id_str != null) return true;
  if (n.advertiser_id != null) return true;
  if (n.ad_account_id != null) return true;
  if (n.sponsored_label != null || n.sponsored_ad_label != null) return true;
  if (n.sponsored_label_text && SPONSORED_EXACT.test(String(n.sponsored_label_text).trim()))
    return true;
  if (n.encrypted_ad_tracking_data != null) return true;
  if (n.ad_bridge_info != null) return true;
  if (n.ad_client_token != null) return true;
  if (n.third_party_impression_logging != null) return true;
  if (n.third_party_clicks_logging != null) return true;
  if (n.branded_content_ads_info != null && n.is_sponsored) return true;

  // typename
  if (n.__typename && /Sponsored|AdUnit|Ads?Edge|Boosted|AdItem|MarketplaceAd/i.test(n.__typename))
    return true;

  // category / type
  if (n.category && /SPONSORED|ADS?_UNIT|PROMOTED/i.test(String(n.category)))
    return true;
  if (n.story_category && /SPONSORED/i.test(String(n.story_category)))
    return true;

  // 标签文案
  if (n.label && textOf(n.label) && SPONSORED_EXACT.test(textOf(n.label).trim()))
    return true;
  if (n.title && textOf(n.title) && SPONSORED_EXACT.test(textOf(n.title).trim()))
    return true;

  // comet feed unit 浅扫
  if (n.comet_sections || n.feedback || n.legacy_api_story_id || n.post_id) {
    if (shallowSponsoredScan(n)) return true;
  }

  // edge.node 包装
  if (n.node && n.node !== n && isSponsored(n.node)) return true;

  return false;
}

function textOf(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") return String(v.text || v.label || v.name || "");
  return String(v);
}

function shallowSponsoredScan(n) {
  try {
    // 只扫一层关键字段，避免整树 stringify 过慢
    if (n.sponsored_data || n.is_sponsored === true) return true;
    if (n.comet_sections) {
      const s = JSON.stringify(n.comet_sections);
      if (s.length > 200000) {
        // 超大则用正则分段探测
        if (/"is_sponsored"\s*:\s*true/.test(s)) return true;
        if (/"sponsored_data"\s*:\s*\{/.test(s)) return true;
        if (/"category"\s*:\s*"SPONSORED"/.test(s)) return true;
        if (/"text"\s*:\s*"Sponsored"/.test(s) && /"ad_id"/.test(s)) return true;
        return false;
      }
      if (/"is_sponsored"\s*:\s*true/.test(s)) return true;
      if (/"sponsored_data"\s*:\s*\{/.test(s)) return true;
      if (/"category"\s*:\s*"SPONSORED"/.test(s)) return true;
      // 同时出现 Sponsored 文案 + ad 追踪字段
      if (
        /"text"\s*:\s*"(Sponsored|赞助|贊助)"/.test(s) &&
        /("ad_id"|sponsored_data|encrypted_ad_tracking)/.test(s)
      )
        return true;
    }
    // tracking
    if (n.tracking) {
      const t = typeof n.tracking === "string" ? n.tracking : JSON.stringify(n.tracking);
      if (/sponsor|\"ad_id\"|is_sponsored/i.test(t) && /ad/i.test(t)) {
        if (/is_sponsored|sponsored_data|\"ad_id\"/.test(t)) return true;
      }
    }
  } catch (_) {}
  return false;
}
