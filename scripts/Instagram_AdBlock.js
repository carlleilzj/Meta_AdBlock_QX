/**
 * Instagram 去广告 - Quantumult X / Surge / Loon
 *
 * 过滤首页信息流、Reels、探索、Stories 等接口中的广告 / 赞助内容。
 * 需开启 MITM，且 App 未开启强证书锁定（若抓不到包请见 README）。
 *
 * 仓库: https://github.com/carlleilzj/Meta_AdBlock_QX
 */

const NAME = "Instagram去广告";
const DEBUG = false;

const AD_TEXT = /sponsored|赞助|廣告|广告|promoted|推广|プロモーション|広告|広告表示|paid partnership|付费合作|商業合作|商业合作/i;

// 请求入口
let body = $response && $response.body;
if (!body) {
  $done({});
} else {
  try {
    body = typeof body === "string" ? body : body.toString();
    // 部分接口返回非 JSON（空/HTML），直接放行
    if (!/^\s*[\[{]/.test(body)) {
      $done({ body });
    } else {
      const data = JSON.parse(body);
      const cleaned = filterRoot(data);
      $done({ body: JSON.stringify(cleaned) });
    }
  } catch (e) {
    if (DEBUG) console.log(NAME + " error: " + e);
    $done({ body });
  }
}

function filterRoot(node) {
  if (node == null || typeof node !== "object") return node;

  // 首页时间线
  if (Array.isArray(node.feed_items)) {
    node.feed_items = node.feed_items.filter((it) => !isAdFeedItem(it));
  }
  if (Array.isArray(node.items)) {
    node.items = node.items.filter((it) => !isAdMedia(it));
  }

  // 新版 timeline num_results 对齐
  if (typeof node.num_results === "number" && Array.isArray(node.feed_items)) {
    node.num_results = node.feed_items.length;
  }

  // Stories / Reels tray
  if (Array.isArray(node.tray)) {
    node.tray = node.tray
      .map((reel) => filterReel(reel))
      .filter((reel) => reel && !isAdReel(reel));
  }

  // 探索页 sectional
  if (Array.isArray(node.sectional_items)) {
    node.sectional_items = node.sectional_items
      .map((sec) => filterSection(sec))
      .filter((sec) => sec && !isAdSection(sec));
  }

  // 推荐用户 / 广告插入
  if (Array.isArray(node.suggested_users)) {
    node.suggested_users = node.suggested_users.filter((u) => !isAdUser(u));
  }

  // GraphQL / 嵌套 data
  if (node.data && typeof node.data === "object") {
    node.data = filterRoot(node.data);
  }

  // 递归常见列表字段
  for (const key of Object.keys(node)) {
    const val = node[key];
    if (!val || typeof val !== "object") continue;

    if (Array.isArray(val)) {
      if (
        /feed_items|media_or_ad|medias|edges|nodes|items|stories|reels|ad_items|clips/i.test(
          key
        )
      ) {
        node[key] = val
          .map((x) => (x && typeof x === "object" ? filterRoot(x) : x))
          .filter((x) => !looksLikeAdNode(x));
      } else if (val.length && typeof val[0] === "object") {
        // 轻量递归，避免过深拖慢
        node[key] = val.map((x) =>
          x && typeof x === "object" ? scrubAdFlags(x) : x
        );
      }
    } else if (
      /timeline|feed|viewer|xdt_|polaris|clips|reels|explore/i.test(key)
    ) {
      node[key] = filterRoot(val);
    } else {
      scrubAdFlags(val);
    }
  }

  return node;
}

function filterReel(reel) {
  if (!reel || typeof reel !== "object") return reel;
  if (Array.isArray(reel.items)) {
    reel.items = reel.items.filter((it) => !isAdMedia(it));
  }
  if (Array.isArray(reel.media_ids)) {
    // 保持与 items 大致一致（无法精确时不强制）
  }
  return reel;
}

function filterSection(sec) {
  if (!sec || typeof sec !== "object") return sec;
  const layout = sec.layout_content || sec.layout || {};
  if (layout.fill_items && Array.isArray(layout.fill_items)) {
    layout.fill_items = layout.fill_items.filter((x) => {
      const m = x.media || x;
      return !isAdMedia(m);
    });
  }
  if (layout.one_by_two_item) {
    // 探索页广告位常见
    if (isAdSection(sec)) return null;
  }
  if (layout.medias && Array.isArray(layout.medias)) {
    layout.medias = layout.medias.filter((x) => !isAdMedia(x.media || x));
  }
  sec.layout_content = layout;
  return sec;
}

function isAdFeedItem(item) {
  if (!item || typeof item !== "object") return false;
  // 经典结构：{ media_or_ad: {...} } / { ad: {...} } / { explore_story: {...} }
  if (item.ad || item.ad_item || item.injected) return true;
  if (item.explore_story && isAdMedia(item.explore_story.media_dict || item.explore_story))
    return true;
  if (item.media_or_ad && isAdMedia(item.media_or_ad)) return true;
  if (item.media && isAdMedia(item.media)) return true;
  // suggested_users 卡片等
  if (item.suggested_users || item.suggested_user_items) {
    // 非广告，保留；若要屏蔽推荐可改 true
    return false;
  }
  return isAdMedia(item) || looksLikeAdNode(item);
}

function isAdMedia(m) {
  if (!m || typeof m !== "object") return false;

  if (
    m.ad ||
    m.ad_metadata ||
    m.ad_expiry_timestamp_in_millis != null ||
    m.dr_ad_type != null ||
    m.ad_id != null ||
    m.ad_id_str != null ||
    m.is_ad === true ||
    m.injected ||
    m.view_state_item_type === "AD" ||
    m.view_state_item_type === 3 ||
    m.product_type === "ad" ||
    m.inventory_source === "ad" ||
    m.ad_destination ||
    m.link_text_hint || // 常伴随赞助
    (m.label && AD_TEXT.test(String(m.label.text || m.label)))
  ) {
    return true;
  }

  // 标题/标签文案
  if (m.title && AD_TEXT.test(String(m.title))) return true;
  if (Array.isArray(m.hide_reasons) && m.hide_reasons.some((r) => /ad|sponsor/i.test(JSON.stringify(r)))) {
    // 不作为唯一判断
  }

  // 用户侧付费合作标记
  if (m.sponsor_tags && Array.isArray(m.sponsor_tags) && m.sponsor_tags.length) {
    // 品牌合作帖：默认保留（属于创作者内容）；若要一并隐藏可 return true
  }

  // GraphQL media
  if (m.edge_media_to_sponsor_user) return false; // 合作内容默认保留
  if (m.ad_info || m.advertising_info) return true;
  if (m.sponsored_label || m.sponsored_ad_label) return true;

  // caption 中极少单独判断，避免误杀

  return hasSponsoredLabel(m);
}

function isAdReel(reel) {
  if (!reel) return false;
  if (reel.is_ad || reel.ad_media || reel.ad_expiry_timestamp_in_millis) return true;
  if (reel.user && reel.user.is_ad_available) {
    // 不据此删除整个 tray
  }
  return false;
}

function isAdSection(sec) {
  if (!sec) return true;
  const t = String(sec.feed_type || sec.layout_type || sec.explore_item_info?.dest_result_type || "");
  if (/ad|ads|banner|shopping_ad|promot/i.test(t)) return true;
  if (sec.ad || sec.ad_metadata) return true;
  return false;
}

function isAdUser(u) {
  if (!u) return false;
  return !!(u.is_ad || u.ad_media || u.social_context && AD_TEXT.test(String(u.social_context)));
}

function hasSponsoredLabel(m) {
  try {
    const labels = [];
    if (m.label) labels.push(m.label);
    if (Array.isArray(m.labels)) labels.push(...m.labels);
    if (m.caption && m.caption.text) {
      // 不把正文当广告
    }
    // UI badges
    if (Array.isArray(m.top_likers)) {
      // ignore
    }
    for (const lb of labels) {
      const text = typeof lb === "string" ? lb : lb && (lb.text || lb.label || lb.name);
      if (text && AD_TEXT.test(String(text))) return true;
    }
    // 嵌套 item_client_gap_rules / creative 等
    if (m.client_gap_enforcer_matrix) {
      // ignore
    }
  } catch (_) {}
  return false;
}

function looksLikeAdNode(x) {
  if (!x || typeof x !== "object") return false;
  if (isAdMedia(x)) return true;
  if (x.node && isAdMedia(x.node)) return true;
  if (x.media && isAdMedia(x.media)) return true;
  if (x.media_or_ad && isAdMedia(x.media_or_ad)) return true;
  // GraphQL edge
  if (x.node && x.node.__typename && /Ad|Sponsored/i.test(x.node.__typename)) return true;
  return false;
}

function scrubAdFlags(obj) {
  if (!obj || typeof obj !== "object") return obj;
  // 去掉注入广告位标记，降低前端插入概率
  const killKeys = [
    "ad_metadata",
    "injected",
    "ad_expiry_timestamp_in_millis",
    "dr_ad_type",
  ];
  for (const k of killKeys) {
    if (k in obj && (obj.is_ad || obj.ad || obj.ad_id != null)) {
      // 若整节点是广告，上层 filter 会删；此处只 scrub 混杂字段
    }
  }
  return obj;
}
