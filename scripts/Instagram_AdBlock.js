/**
 * Instagram 去广告（加强版）
 * Quantumult X / Surge / Loon - script-response-body
 *
 * 深度过滤信息流 / Reels / 探索 / Stories / GraphQL 中的赞助与广告单元
 * https://github.com/carlleilzj/Meta_AdBlock_QX
 */

const DEBUG = false;

let raw = $response && $response.body;
if (raw == null) {
  $done({});
} else {
  try {
    if (typeof raw !== "string") raw = raw.toString();
    // 去掉可能的 BOM / 空白
    const text = raw.replace(/^\uFEFF/, "");
    if (!text || !/^\s*[\[{]/.test(text)) {
      $done({ body: raw });
    } else {
      const data = JSON.parse(text);
      const removed = { n: 0 };
      const out = walk(data, removed, 0);
      if (DEBUG) console.log(`[IG AdBlock] removed=${removed.n}`);
      $done({ body: JSON.stringify(out) });
    }
  } catch (e) {
    if (DEBUG) console.log("[IG AdBlock] err " + e);
    $done({ body: raw });
  }
}

/** 递归清洗 */
function walk(node, removed, depth) {
  if (node == null || depth > 40) return node;
  if (Array.isArray(node)) {
    const next = [];
    for (let i = 0; i < node.length; i++) {
      const item = node[i];
      if (shouldDrop(item)) {
        removed.n++;
        continue;
      }
      next.push(walk(item, removed, depth + 1));
    }
    return next;
  }
  if (typeof node !== "object") return node;

  // 先处理 feed 专用字段
  if (Array.isArray(node.feed_items)) {
    node.feed_items = filterFeedItems(node.feed_items, removed);
    if (typeof node.num_results === "number") {
      node.num_results = node.feed_items.length;
    }
  }

  const keys = Object.keys(node);
  for (let k = 0; k < keys.length; k++) {
    const key = keys[k];
    const val = node[key];
    if (val == null) continue;

    // 整段广告块直接删
    if (isAdKey(key) && isLikelyAdPayload(val)) {
      delete node[key];
      removed.n++;
      continue;
    }

    if (Array.isArray(val)) {
      // 常见列表字段强过滤
      if (isListKey(key)) {
        node[key] = val
          .filter((x) => {
            if (shouldDrop(x)) {
              removed.n++;
              return false;
            }
            return true;
          })
          .map((x) => walk(x, removed, depth + 1));
      } else {
        node[key] = walk(val, removed, depth + 1);
      }
    } else if (typeof val === "object") {
      if (shouldDrop(val)) {
        delete node[key];
        removed.n++;
      } else {
        node[key] = walk(val, removed, depth + 1);
      }
    }
  }
  return node;
}

function filterFeedItems(items, removed) {
  const out = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it || typeof it !== "object") continue;

    // 1) 整项就是广告/推广单元
    if (shouldDropFeedItem(it)) {
      removed.n++;
      continue;
    }

    // 2) media_or_ad 是广告
    if (it.media_or_ad && isAdMedia(it.media_or_ad)) {
      removed.n++;
      continue;
    }

    // 3) 清洗嵌套
    out.push(walk(it, removed, 0));
  }
  return out;
}

function shouldDropFeedItem(it) {
  // 经典 / 新版 feed 单元类型
  if (it.ad || it.ad_item || it.ad_media) return true;
  if (it.injected && (it.injected.ad_id || it.injected.label || it.injected.show_ad_choices))
    return true;

  // 推广 / 推荐干扰单元
  if (it.stories_netego) return true;
  if (it.netego_extra) return true;
  if (it.ad_and_netego_info) return true;
  if (it.branded_content) return true;

  // 推荐人/商店/直播 enticement（信息流插入）
  if (it.suggested_users) return true;
  if (it.suggested_user_items) return true;
  if (it.suggested_businesses) return true;
  if (it.suggested_producers) return true;
  if (it.suggested_shopping_tiles) return true;
  if (it.shop_by_interest_tiles) return true;
  if (it.explore_story && isAdMedia(it.explore_story.media_dict || it.explore_story))
    return true;

  // 仅含广告相关 key 的单元
  const keys = Object.keys(it);
  const contentKeys = keys.filter(
    (k) =>
      ![
        "ad",
        "ad_item",
        "ad_media",
        "injected",
        "stories_netego",
        "netego_extra",
        "suggested_users",
        "suggested_user_items",
        "suggested_businesses",
        "end_of_feed_demarcator",
        "ad_and_netego_info",
      ].includes(k)
  );
  if (
    keys.some((k) =>
      /^(ad|ad_|ads_|injected|stories_netego|netego)/i.test(k)
    ) &&
    !it.media_or_ad &&
    !it.media &&
    contentKeys.length === 0
  ) {
    return true;
  }

  return isAdMedia(it) || isAdMedia(it.media) || isAdMedia(it.media_or_ad);
}

function shouldDrop(node) {
  if (!node || typeof node !== "object") return false;
  if (Array.isArray(node)) return false;

  if (isAdMedia(node)) return true;
  if (node.node && isAdMedia(node.node)) return true;
  if (node.media && isAdMedia(node.media)) return true;
  if (node.media_or_ad && isAdMedia(node.media_or_ad)) return true;
  if (node.item && isAdMedia(node.item)) return true;

  // GraphQL typename
  if (node.__typename && isAdTypename(node.__typename)) return true;
  if (node.node && node.node.__typename && isAdTypename(node.node.__typename))
    return true;

  // tray / reel
  if (node.is_ad === true) return true;
  if (node.ad_media) return true;
  if (node.reel_type && /ad/i.test(String(node.reel_type))) return true;

  // explore section
  if (node.feed_type && /ad|ads|banner|promot|shop/i.test(String(node.feed_type)))
    return true;
  if (node.layout_type && /ad|ads|banner|promot/i.test(String(node.layout_type)))
    return true;

  // 浅层赞助文案（限小对象）
  if (hasSponsoredBadge(node)) return true;

  return false;
}

function isAdMedia(m) {
  if (!m || typeof m !== "object" || Array.isArray(m)) return false;

  // —— 强特征（Instagram Private API / 抓包常见）——
  if (m.injected) {
    // injected 几乎只出现在广告
    if (
      m.injected.ad_id ||
      m.injected.label ||
      m.injected.show_ad_choices ||
      m.injected.ad_title ||
      m.injected.tracking_token
    )
      return true;
    // 有 injected 对象本身也高度可疑
    return true;
  }
  if (m.ad_metadata != null) return true;
  if (m.ad_id != null || m.ad_id_str != null) return true;
  if (m.dr_ad_type != null) return true;
  if (m.ad_action != null) return true;
  if (m.ad_link_type != null) return true;
  if (m.ad_header_style != null) return true;
  if (m.ad_destination != null) return true;
  if (m.is_ad === true) return true;
  if (m.view_state_item_type === "AD" || m.view_state_item_type === 3)
    return true;
  if (m.product_type === "ad" || m.product_type === "ad_preview") return true;
  if (m.inventory_source && isAdInventory(m.inventory_source)) return true;
  if (m.link != null && (m.link_text != null || m.ad_action != null)) {
    // CTA 外链 + 广告动作
    if (m.ad_metadata != null || m.dr_ad_type != null || m.injected) return true;
  }
  // 广告 CTA 链接数组
  if (Array.isArray(m.android_links) && m.android_links.length && m.ad_id)
    return true;
  if (Array.isArray(m.ios_links) && m.ios_links.length && (m.ad_id || m.injected))
    return true;

  // label / badge
  if (hasSponsoredBadge(m)) return true;

  // 嵌套
  if (m.ad || m.ad_info || m.advertising_info || m.ads_info) return true;
  if (m.sponsored_label || m.sponsored_ad_label) return true;
  if (m.more_info && /ad|sponsor/i.test(JSON.stringify(m.more_info).slice(0, 200)))
    return false; // 避免误伤

  // GraphQL
  if (m.__typename && isAdTypename(m.__typename)) return true;
  if (m.ad_promotion_info || m.afi_type) return true;

  // branded content 默认保留；若字段带 ad_ 再拦
  if (m.branded_content_ads_info) return true;

  // 扫描自身一层 key
  const keys = Object.keys(m);
  let adKeyHits = 0;
  for (let i = 0; i < keys.length; i++) {
    if (/^(ad_|ads_|injected|dr_ad|sponsor)/i.test(keys[i])) adKeyHits++;
  }
  if (adKeyHits >= 2) return true;

  return false;
}

function isAdInventory(src) {
  const s = String(src).toLowerCase();
  // organic 常见: media_or_ad / following 等；广告常见含 ad
  if (s === "ad" || s === "ads" || s === "ad_network") return true;
  if (s.indexOf("ad_") === 0) return true;
  if (s.indexOf("_ad") !== -1) return true;
  if (s.indexOf("sponsored") !== -1) return true;
  if (s.indexOf("injection") !== -1) return true;
  // 注意: "media_or_ad" 是有机帖也会用的名字，不要当广告
  return false;
}

function isAdTypename(t) {
  return /Ad(?![a-z])|Sponsored|AdItem|AdMedia|AdUnit|AdsEdge|Boosted|Promotion/i.test(
    String(t)
  );
}

function hasSponsoredBadge(m) {
  const re =
    /^(sponsored|赞助|贊助|廣告|广告|promoted|推广内容|推广|プロモーション|広告)$/i;
  const re2 =
    /sponsored|赞助内容|贊助內容|付费推广|付費推廣|品牌内容|品牌內容/i;

  const candidates = [];
  if (m.label != null) candidates.push(m.label);
  if (Array.isArray(m.labels)) candidates.push.apply(candidates, m.labels);
  if (m.title != null) candidates.push(m.title);
  if (m.header != null) candidates.push(m.header);
  if (m.injected && m.injected.label) candidates.push(m.injected.label);
  if (m.sponsored_label_text) candidates.push(m.sponsored_label_text);

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const text =
      typeof c === "string"
        ? c
        : c && (c.text || c.label || c.name || c.title || "");
    if (!text) continue;
    const s = String(text).trim();
    if (re.test(s) || re2.test(s)) return true;
  }

  // 小对象浅扫（避免大 body 性能问题）
  try {
    if (m.client_gap_rules || m.item_client_gap_rules) return false;
    const keys = Object.keys(m);
    if (keys.length <= 25) {
      const s = JSON.stringify(m);
      if (s.length < 2500) {
        if (/"label"\s*:\s*\{[^}]{0,80}"text"\s*:\s*"(Sponsored|赞助|贊助)"/i.test(s))
          return true;
        if (/"injected"\s*:\s*\{/.test(s) && /"ad_id"/.test(s)) return true;
      }
    }
  } catch (_) {}
  return false;
}

function isAdKey(key) {
  return /^(ad|ads|ad_|ads_|injected_ad|netego|stories_netego|branded_content_ads)/i.test(
    key
  );
}

function isListKey(key) {
  return /^(feed_items|items|medias|media_items|edges|nodes|tray|reels|stories|clips|sectional_items|fill_items|suggestions|ad_items|ranked_items|mixed_cards|preview_items|chaining_suggestions)$/i.test(
    key
  );
}

function isLikelyAdPayload(val) {
  if (val == null) return true;
  if (typeof val !== "object") return true;
  return isAdMedia(val) || shouldDrop(val);
}
