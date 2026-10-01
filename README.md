# install-stats

一键脚本的每日运行统计：一个 Cloudflare Worker 接管脚本的短域名（`bash <(curl -sL snell.jinqians.com)` 里的那个），照旧重定向到 GitHub 上的脚本，顺路记一次运行。

- **运行次数**：curl / wget 取一次脚本算一次（每天、每个脚本、每个国家），浏览器和爬虫单独记为「其他访问」。
- **独立服务器**：同一天里同一台服务器只算一次，按脚本、按项目、按全部各去重。
- **Docker 拉取**：每天读一次 Docker Hub 的累计拉取数，相邻两天相减就是当天的拉取量。
- **统计页**（`stats.jinqians.com`，密码登录）：每日柱状图（鼠标 / 方向键看每一天）、各项目和脚本的明细、来源国家、客户端、Docker 拉取。
- **公开徽章**：一个项目的运行次数合成一个数（比如 snell.sh 的 install、snell、menu……加在一起），明细只在统计页里。

**隐私**：不保存 IP。独立服务器靠「IP + 当天的随机盐」的哈希去重，盐和哈希在当天结束时一起删掉，之后谁也对不回某个地址。

## 统计页

![统计页](https://raw.githubusercontent.com/jinqians/install-stats/main/docs/dashboard.png)

## 部署

1. 克隆这个仓库，按需改 `wrangler.jsonc`：`routes`（脚本的域名）、`vars.TARGETS`（域名 → 脚本地址）、`DOCKER_REPOS`、`TIMEZONE`。
2. 部署并设置统计页密码（至少 8 位）：

   ```bash
   npm install
   npx wrangler login
   npx wrangler deploy            # 首次部署会自动创建 D1 数据库 install-stats，表由 Worker 自己建
   npx wrangler secret put ADMIN_PASSWORD
   ```

   也可以在 Cloudflare 后台 **Workers 和 Pages → 创建 → 导入 Git 仓库** 连接这个仓库（推送即部署），密码在 Worker 的 **设置 → 变量和机密** 里加 `ADMIN_PASSWORD`。
3. **删掉这些域名原来的重定向规则**（区域 jinqians.com → **规则 → 重定向规则**）：Cloudflare 先执行重定向规则、后执行 Worker，规则不删，Worker 永远收不到请求。先部署、再删规则，中间不会断：

   | 域名 | Worker 重定向到 |
   | --- | --- |
   | install.jinqians.com | snell.sh / install.sh |
   | snell.jinqians.com | snell.sh / snell.sh |
   | snell-centos.jinqians.com | snell.sh / snell-centos.sh |
   | snell-docker.jinqians.com | snell.sh / snell-docker.sh |
   | snell-alpine.jinqians.com | snell.sh / snell-alpine.sh |
   | menu.jinqians.com | snell.sh / menu.sh |
   | ss.jinqians.com | ss-2022.sh / ss-2022.sh |
   | psm.jinqians.com | proxy-stack / bootstrap.sh |

   这些域名的 DNS 记录保持原样（已代理，橙色云）。`stats.jinqians.com` 是 Worker 的自定义域，部署时自动建好 DNS 记录。
4. 检查：`curl -sI https://snell.jinqians.com` 应该是 `302`，`location` 指向脚本；打开 `https://stats.jinqians.com` 登录。

不想统计某个域名，就把它从 `routes` 和 `TARGETS` 里去掉，再给它加回重定向规则。

## 给其他项目用

不限于 snell：在 `wrangler.jsonc` 里给新域名加一条 `routes`，在 `TARGETS` 里写上它的脚本地址，重新部署，再删掉它的重定向规则即可。

脚本按**项目**分组，默认就是它所在的 GitHub 仓库（`raw.githubusercontent.com/<用户>/<仓库>/…`）。脚本不在 GitHub 上，或者想换个分法，就写成对象：

```jsonc
"TARGETS": {
  "tool.example.com": { "url": "https://example.com/tool.sh", "project": "tool" }
}
```

`routes` 和 `TARGETS` 要一一对应（测试会检查）：只在 `TARGETS` 里的域名，Cloudflare 不会交给 Worker。

## 徽章

`https://stats.jinqians.com/badge/<项目>.json` 是 [shields.io](https://shields.io/badges/endpoint-badge) 的 endpoint 格式，项目名是仓库名，`.sh` 可以省：

```markdown
![运行次数](https://img.shields.io/endpoint?url=https%3A%2F%2Fstats.jinqians.com%2Fbadge%2Fsnell.json)
![今日运行](https://img.shields.io/endpoint?url=https%3A%2F%2Fstats.jinqians.com%2Fbadge%2Fsnell.json%3Fperiod%3Dtoday)
```

参数：`period=today|7d|30d|all`（默认 `all`）、`label=自定义标签`。只给项目的运行次数；单个脚本、服务器数、国家这些只在统计页里。

## 额度

免费版 Workers 每天 10 万次请求；每次运行写 D1 两行（运行次数、去重），D1 免费版每天 10 万行写入，约合每天 5 万次运行。

## 测试

在装了 Docker 的测试机上（项目放在 `$W/install-stats`，默认 `/root/w`）：

```bash
bash tests/e2e.sh
```

`wrangler dev` 下跑：每个域名的重定向（并从 GitHub 取回脚本）、哪些算运行、哪些不算、去重、每日任务（真实读取 Docker Hub）、密码和会话、徽章，以及 Chromium 里的统计页。
