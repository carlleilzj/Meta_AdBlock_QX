/**
 * Facebook 去广告 - Quantumult X / Surge / Loon
 *
 * 策略:
 * 1) 过滤 GraphQL / 信息流响应中的赞助内容节点
 * 2) 配合 conf 中的 reject 规则拦截广告追踪域名
 *
 * 注意: 新版 Facebook/Meta App 常有证书锁定，MITM 可能失败。
 * 此时仍可依赖 [reject] 域名规则减少部分广告与追踪。
 *
 * 仓库: https://github.com/carlleilzj/Meta_AdBlock_QX
 */

const NAME = "Facebook去广告";
const DEBUG = false;

const SPONSORED_TEXT =
  /sponsored|赞助|贊助|廣告|广告|promoted|推广|プロモーション|広告|suggested for you|为你推荐|為你推薦|people you may know|你可能认识|你可能認識/i;

let body = $response && $response.body;
if (!body) {
  $done({});
} else {
  try {
    body = typeof body === "string" ? body : body.toString();
    if (!body || !/^\s*[\[{]/.test(body)) {
      $done({ body });
    } else {
      // Facebook 有时返回多段 JSON（用换行拼接）
      if (isNDJSON(body)) {
        const parts = body
          .split("\n")
          .filter((l) => l.trim())
          .map((line) => {
            try {
              return JSON.stringify(filterRoot(JSON.parse(line)));
            } catch (_) {
              return line;
            }
          });
        $done({ body: parts.join("\n") });
      } else {
        const data = JSON.parse(body);
        $done({ body: JSON.stringify(filterRoot(data)) });
      }
    }
  } catch (e) {
    if (DEBUG) console.log(NAME + " error: " + e);
    $done({ body });
  }
}

function isNDJSON(text) {
  // 多行且每行像 JSON 对象
  if (text.indexOf("\n") < 0) return false;
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return false;
  return lines.slice(0, 3).every((l) => /^\s*\{/.test(l));
}

function filterRoot(node) {
  if (node == null || typeof node !== "object") return node;

  if (Array.isArray(node)) {
    return node
      .map((x) => filterRoot(x))
      .filter((x) => !isSponsoredNode(x));
  }

  // 常见 feed edges
  for (const key of Object.keys(node)) {
    const val = node[key];
    if (val == null) continue;

    if (Array.isArray(val)) {
      node[key] = val
        .map((x) => filterRoot(x))
        .filter((x) => !isSponsoredNode(x) && !isSponsoredEdge(x));
    } else if (typeof val === "object") {
      if (isSponsoredNode(val)) {
        // 用空对象占位，避免前端崩溃
        node[key] = Array.isArray(val) ? [] : null;
      } else {
        node[key] = filterRoot(val);
      }
    } else if (typeof val === "string") {
      // 不改文案
    }
  }

  return node;
}

function isSponsoredEdge(edge) {
  if (!edge || typeof edge !== "object") return false;
  if (edge.node && isSponsoredNode(edge.node)) return true;
  if (edge.category && /SPONSORED|AD/i.test(String(edge.category))) return true;
  return false;
}

function isSponsoredNode(n) {
  if (!n || typeof n !== "object") return false;

  // 明确广告字段
  if (
    n.is_sponsored === true ||
    n.sponsored_data != null ||
    n.ad_id != null ||
    n.ad_id_str != null ||
    n.advertiser_id != null ||
    n.ad_account_id != null ||
    n.sponsored_label != null ||
    n.sponsored_ad_label != null ||
    n.third_party_clicks_logging != null ||
    n.third_party_impression_logging != null ||
    n.ad_bridge_info != null ||
    n.encrypted_ad_tracking_data != null ||
    n.ad_client_token != null
  ) {
    return true;
  }

  // GraphQL __typename
  if (n.__typename && /Sponsored|AdUnit|Ads|MarketplaceAd|Boosted/i.test(n.__typename)) {
    return true;
  }

  // 文案标签
  if (n.sponsored_label_text && SPONSORED_TEXT.test(String(n.sponsored_label_text))) {
    return true;
  }
  if (n.label && SPONSORED_TEXT.test(String(n.label.text || n.label))) {
    return true;
  }
  if (n.title && typeof n.title === "object") {
    const t = n.title.text || n.title;
    if (SPONSORED_TEXT.test(String(t))) return true;
  }

  // comet sections 常见赞助结构
  if (n.comet_sections) {
    try {
      const s = JSON.stringify(n.comet_sections);
      if (/"sponsored_data"|"SponsoredData"|"is_sponsored":true|"ad_id"/.test(s)) {
        // 若整个 story 是赞助
        if (n.sponsored_data || /"is_sponsored":true/.test(s)) return true;
      }
    } catch (_) {}
  }

  // 浅层字符串嗅探（控制成本，只 stringify 小对象）
  if (shouldShallowScan(n)) {
    try {
      const s = JSON.stringify(n);
      if (s.length < 8000) {
        if (/"is_sponsored":true/.test(s)) return true;
        if (/"sponsored_data":\{/.test(s) && /"ad_id"/.test(s)) return true;
      }
    } catch (_) {}
  }

  return false;
}

function shouldShallowScan(n) {
  // 只对看起来像 feed unit 的对象做浅扫
  return !!(
    n.comet_sections ||
    n.feedback ||
    n.story ||
    n.post_id ||
    n.legacy_api_story_id ||
    n.tracking ||
    n.cache_id
  );
}
