# Meta AdBlock for Quantumult X（加强版）

Instagram / Facebook 去广告重写。针对 **Sponsored / 赞助内容** 做深度 JSON 过滤，并拦截广告追踪域名。

## 链接

| 资源 | URL |
|------|-----|
| 仓库 | https://github.com/carlleilzj/Meta_AdBlock_QX |
| **合并配置** | https://raw.githubusercontent.com/carlleilzj/Meta_AdBlock_QX/main/conf/Meta_AdBlock.conf |
| Instagram 配置 | https://raw.githubusercontent.com/carlleilzj/Meta_AdBlock_QX/main/conf/Instagram_AdBlock.conf |
| Facebook 配置 | https://raw.githubusercontent.com/carlleilzj/Meta_AdBlock_QX/main/conf/Facebook_AdBlock.conf |
| Instagram 脚本 | https://raw.githubusercontent.com/carlleilzj/Meta_AdBlock_QX/main/scripts/Instagram_AdBlock.js |
| Facebook 脚本 | https://raw.githubusercontent.com/carlleilzj/Meta_AdBlock_QX/main/scripts/Facebook_AdBlock.js |

## 安装

### 远程引用

```ini
[rewrite_remote]
https://raw.githubusercontent.com/carlleilzj/Meta_AdBlock_QX/main/conf/Meta_AdBlock.conf, tag=Meta去广告, update-interval=86400, opt-parser=true, enabled=true
```

然后：

1. **设置 → HTTPS 解密** 开启，安装并信任证书  
2. 确认 MitM 主机名包含（可手动追加）：

```text
i.instagram.com, b.i.instagram.com, graph.instagram.com, www.instagram.com,
graph.facebook.com, b-graph.facebook.com, www.facebook.com, *.instagram.com, *.facebook.com
```

3. 保存配置 → **完全关闭** Instagram/Facebook（后台划掉）→ 再打开 → **下拉刷新**

### 必须检查：请求是否命中

打开 Quantumult X → 最近请求 / 日志：

| 现象 | 含义 |
|------|------|
| 能看到 `i.instagram.com` / `b.i.instagram.com` 且 rewrite 命中 | 脚本在工作 |
| 完全没有这些域名，或 HTTPS 失败 | 证书未信任 / 未走代理 |
| 有域名但解密失败、无响应体 | **证书锁定 (SSL Pinning)**，脚本无法改包 |

> 新版 Instagram / Facebook 常带证书锁定。锁定开启时，**任何响应体去广告都会失效**，只能拦截部分追踪域名。可尝试旧版 App，或使用可过 pinning 的环境（需自行承担风险）。

## 加强版改动

- 补全主机名：`b.i.instagram.com`、`*.i.instagram.com`、更多 Facebook Graph 节点  
- 覆盖 `api/v1` 与 `api/vN`  
- Instagram：按 `injected` / `ad_metadata` / `ad_id` / `dr_ad_type` / `stories_netego` / 推荐卡片等强特征删除  
- 同步过滤探索、Reels、GraphQL  
- Facebook：数组级剥离 `sponsored_data` / `is_sponsored` / `category=SPONSORED`  
- 默认去掉信息流「推荐用户」等插入单元（更干净）

## 仍可能看到的内容

- 创作者「付费合作 / Paid partnership」有机帖（默认保留）  
- WebView / 视频播放器内贴片  
- 证书锁定导致脚本未执行  
- Meta 新字段改版（可提 issue 并附上脱敏后的 JSON 片段）

## 调试

1. 把脚本里 `const DEBUG = false` 改为 `true`  
2. 看 QX 日志是否有 `[IG AdBlock] removed=N`  
3. 若 `removed=0` 但界面仍有赞助：把对应请求的响应 JSON 里赞助那一段（打码 token）发出来以便更新规则  

## License

MIT
