# Meta AdBlock for Quantumult X

Instagram / Facebook 去广告相关配置。

## 先看结论（重要）

官方 **Instagram / Facebook App** 启用了 **SSL Pinning（证书锁定）**。

你的日志若出现：

- `i.instagram.com` / `gateway.facebook.com` / `graph.instagram.com` 等  
- 右侧 **红锁**、`N/A`、上下行 **0B**  
- App **不显示内容 / 一直转圈**

说明：圈 X **解不开 HTTPS**，`script-response-body` **永远不会执行**，信息流里的「赞助」**去不掉**。  
这不是脚本写错，是 App 安全机制。

| 场景 | 能否去掉 App 内赞助 |
|------|---------------------|
| 官方 App + 证书锁定（现状） | ❌ 不能（改包失败） |
| Safari 网页版 Instagram/Facebook | ✅ 部分可以 |
| 已自行解决 pinning 的环境 | ✅ 可用全量 MITM 配置 |

## 你现在该怎么做

### 1. 先恢复 App 能用（必做）

关掉全量 MITM 配置，改用 **兼容模式**：

```ini
[rewrite_remote]
https://raw.githubusercontent.com/carlleilzj/Meta_AdBlock_QX/main/conf/Meta_AdBlock_Compat.conf, tag=Meta兼容去广告, update-interval=86400, opt-parser=true, enabled=true
```

并检查 **MitM hostname**：

- ✅ 可保留：`www.instagram.com`, `www.facebook.com`（网页）  
- ❌ 务必删除：`i.instagram.com`, `b.i.instagram.com`, `gateway.instagram.com`, `graph.instagram.com`, `gateway.facebook.com`, `graph.facebook.com`, `b-graph.facebook.com`, `*.instagram.com`, `*.facebook.com`（App API）

然后：

1. 保存配置  
2. 完全划掉 IG/FB  
3. 再打开  

内容应恢复正常。兼容模式会拦部分追踪域名，并给 **Safari 网页版** 去广告。

### 2. 现实可行的「去赞助」方案

**方案 A — Safari 网页版（推荐、无破解）**

1. 启用 `Meta_AdBlock_Compat.conf`  
2. Safari 打开 https://www.instagram.com 或 https://www.facebook.com 并登录  
3. 网页 GraphQL 可被改包，赞助内容可过滤一部分  

**方案 B — 继续用官方 App**

- App 内赞助信息流：**目前没有** 纯 Quantumult X 合法配置能稳定去掉  
- 只能减少部分追踪请求，无法删 feed 里的 Sponsored 卡片  

**方案 C — 证书锁定被绕过的环境（进阶、自负风险）**

仅当你 **自己已经** 具备下列条件之一时，才可改回全量配置  
`Meta_AdBlock.conf`：

- 越狱 + 可禁用 SSL Pinning 的工具  
- 自行重签/修改过、去掉 pinning 的 App 包  

本仓库 **不提供** 破解包、不提供绕过 pinning 的教程。  
未解决 pinning 前强行 MITM = 红锁 + 空白。

## 配置链接

| 配置 | 用途 | 链接 |
|------|------|------|
| **兼容模式（推荐）** | 恢复 App + 网页去广告 | https://raw.githubusercontent.com/carlleilzj/Meta_AdBlock_QX/main/conf/Meta_AdBlock_Compat.conf |
| 全量 MITM | 仅无 pinning / 网页加强 | https://raw.githubusercontent.com/carlleilzj/Meta_AdBlock_QX/main/conf/Meta_AdBlock.conf |
| 仅 IG | 全量 | https://raw.githubusercontent.com/carlleilzj/Meta_AdBlock_QX/main/conf/Instagram_AdBlock.conf |
| 仅 FB | 全量 | https://raw.githubusercontent.com/carlleilzj/Meta_AdBlock_QX/main/conf/Facebook_AdBlock.conf |

脚本：

- https://raw.githubusercontent.com/carlleilzj/Meta_AdBlock_QX/main/scripts/Instagram_AdBlock.js  
- https://raw.githubusercontent.com/carlleilzj/Meta_AdBlock_QX/main/scripts/Facebook_AdBlock.js  

## 日志对照

| 日志 | 含义 |
|------|------|
| 红锁 + N/A + 0B | MITM 失败（pinning），脚本未执行 |
| 有状态码、有上下行流量、rewrite 命中 | 脚本可以工作 |
| iCloud 等显示 DIRECT 且有流量 | 正常对照 |

## License

MIT
