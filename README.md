# Meta AdBlock for Quantumult X

Instagram / Facebook 去广告重写脚本（Quantumult X）。

过滤 App 信息流接口里的 **Sponsored / 赞助内容**，并拦截部分广告追踪域名。

## 链接

| 资源 | 地址 |
|------|------|
| 仓库 | https://github.com/carlleilzj/Meta_AdBlock_QX |
| 合并配置 | https://raw.githubusercontent.com/carlleilzj/Meta_AdBlock_QX/main/conf/Meta_AdBlock.conf |
| Instagram 配置 | https://raw.githubusercontent.com/carlleilzj/Meta_AdBlock_QX/main/conf/Instagram_AdBlock.conf |
| Facebook 配置 | https://raw.githubusercontent.com/carlleilzj/Meta_AdBlock_QX/main/conf/Facebook_AdBlock.conf |
| Instagram 脚本 | https://raw.githubusercontent.com/carlleilzj/Meta_AdBlock_QX/main/scripts/Instagram_AdBlock.js |
| Facebook 脚本 | https://raw.githubusercontent.com/carlleilzj/Meta_AdBlock_QX/main/scripts/Facebook_AdBlock.js |

## 安装（Quantumult X）

### 方式 A：远程引用（推荐）

1. 设置 → HTTPS 解密 → 开启，安装并**信任**证书  
2. 配置文件 → 编辑，添加：

```ini
[rewrite_remote]
https://raw.githubusercontent.com/carlleilzj/Meta_AdBlock_QX/main/conf/Meta_AdBlock.conf, tag=Meta去广告, update-interval=172800, opt-parser=true, enabled=true
```

> 若你的 QX 版本对 `rewrite_remote` 合并 `[mitm]` 支持不佳，请改用方式 B 手动粘贴。

### 方式 B：手动粘贴

打开 [Meta_AdBlock.conf](https://raw.githubusercontent.com/carlleilzj/Meta_AdBlock_QX/main/conf/Meta_AdBlock.conf)，把其中：

- `[rewrite_local]` 整段  
- `[mitm] hostname = ...`（追加到已有 hostname，不要覆盖）

写入你的配置并保存。

### 方式 C：只开其中一个

- 只要 Instagram → 用 `Instagram_AdBlock.conf`  
- 只要 Facebook → 用 `Facebook_AdBlock.conf`

## 使用后

1. 完全关掉 Instagram / Facebook（从后台划掉）  
2. 重新打开，**下拉刷新**信息流  
3. 在 QX「最近请求」里应能看到 `i.instagram.com` / `graph.facebook.com` 被 rewrite 命中  

## 能去什么 / 不能去什么

**通常有效**

- 首页信息流 Sponsored 帖  
- 部分 Reels / 探索页广告卡片  
- 部分 Stories 托盘广告  
- Facebook GraphQL 中带 `sponsored_data` / `is_sponsored` 的单元  
- 广告追踪域名（`an.facebook.com`、`facebook.com/tr` 等）

**可能无效**

- App 开启 **SSL Pinning（证书锁定）** 时，MITM 解不开 HTTPS，响应脚本不会执行  
- 内嵌 WebView / 特殊广告 SDK 渲染的广告  
- 视频播放器内部贴片（非 feed JSON）  
- Meta 改版后字段变化（需更新脚本）

### 证书锁定时怎么办？

1. 确认 QX 已信任证书，MitM 主机名包含配置里的域名  
2. 看「最近请求」：若 Instagram 流量全是「失败 / 未知」且无 body rewrite，多半是 pinning  
3. 可选：使用未加固的旧版 App（有风险，自行权衡）  
4. 即便 MITM 失败，**reject 规则**仍可能拦截部分追踪广告  

## 误杀说明

- **付费合作 / Paid partnership** 帖默认**保留**（创作者内容）  
- 若需连合作帖一并隐藏，可改 `Instagram_AdBlock.js` 里 `sponsor_tags` 分支为 `return true`  
- Facebook 「你可能认识的人」默认不过滤；脚本主要针对赞助广告字段  

## 目录

```
conf/
  Meta_AdBlock.conf          # 合并
  Instagram_AdBlock.conf
  Facebook_AdBlock.conf
scripts/
  Instagram_AdBlock.js
  Facebook_AdBlock.js
```

## 隐私

脚本仅在本地修改响应 JSON，不上传任何数据。

## License

MIT
