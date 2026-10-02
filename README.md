# install-stats

[English](README.en.md) ｜ 中文

一键安装脚本（`bash <(curl -sL …)` 那种）的每日运行统计，**任何项目都能用**：一个 Cloudflare Worker 把请求重定向到你的脚本，顺路记一次运行。部署一次，在统计页里填上要统计的脚本即可，不用改代码。

- **运行次数**：curl / wget 取一次脚本算一次（每天、每个脚本、每个国家），浏览器和爬虫单独记为「其他访问」。
- **独立服务器**：同一天里同一台服务器只算一次，按脚本、按项目、按全部各去重。
- **Docker 拉取**：每天读一次 Docker Hub 的累计拉取数，相邻两天相减就是当天的拉取量。
- **统计页**（密码登录，中英双语）：每日柱状图（鼠标 / 方向键看每一天）、各项目和脚本的明细、来源国家、客户端、Docker 拉取；脚本、Docker 仓库、时区都在这里设置。
- **公开徽章**：一个项目的运行次数合成一个数，明细只在统计页里。

**隐私**：不保存 IP。独立服务器靠「IP + 当天的随机盐」的哈希去重，盐和哈希在当天结束时一起删掉，之后谁也对不回某个地址。

![统计页](https://raw.githubusercontent.com/jinqians/install-stats/main/docs/dashboard.png)

## 部署

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/jinqians/install-stats)

1. 点上面的按钮，登录 Cloudflare（没有账号就免费注册一个）。部署页会：
   - 把这个仓库复制一份到你的 GitHub（名字可以改），以后往那个仓库推送就会自动重新部署；
   - 建好 D1 数据库 `install-stats`（表由 Worker 第一次收到请求时自己建）；
   - 让你填 **ADMIN_PASSWORD**：统计页的登录密码，至少 8 位。
2. 部署完会得到一个地址 `https://install-stats.<你的子域>.workers.dev`，打开、登录，到 **设置** 里添加脚本、Docker 仓库，选好时区，保存。
3. 想用自己的域名打开统计页（比如 `stats.example.com`）：Cloudflare 后台 **Workers 和 Pages → install-stats → 设置 → 域和路由 → 添加 → 自定义域**。

不用按钮也行：

```bash
git clone https://github.com/jinqians/install-stats && cd install-stats
npm install
npx wrangler login
npx wrangler deploy                       # 首次部署会自动创建 D1 数据库 install-stats
npx wrangler secret put ADMIN_PASSWORD
```

或者 fork 后在 Cloudflare 后台 **Workers 和 Pages → 创建 → 导入 Git 仓库** 连接你的 fork（推送即部署），密码在 Worker 的 **设置 → 变量和机密** 里加 `ADMIN_PASSWORD`。

`wrangler.jsonc` 里没有任何人自己的域名和脚本，所以谁部署都一样；你在后台加的路由和自定义域，重新部署也不会被动。

## 接入脚本

在 **设置 → 脚本** 里，每个脚本填：

![设置页](https://raw.githubusercontent.com/jinqians/install-stats/main/docs/settings.png)

| 字段 | 说明 |
| --- | --- |
| 名字 | 小写字母、数字和 `. _ -`，比如 `tool`。脚本的入口就是 `https://<统计页的域名>/<名字>` |
| 脚本地址 | 脚本真正的地址（`https://`），比如 `https://raw.githubusercontent.com/you/tool/main/install.sh` |
| 项目 | 可不填：默认是脚本所在的 GitHub 仓库名，同一个仓库的脚本归一个项目（徽章按项目算） |
| 独立域名 | 可不填：这个脚本自己的短域名，比如 `tool.example.com`（见下面第 2 种） |

两种接入方式，可以混用：

1. **路径**（什么都不用改）：把 `https://stats.example.com/tool` 发给用户，用法就是

   ```bash
   bash <(curl -sL https://stats.example.com/tool)
   ```

   已经有短域名、并且在 Cloudflare 用重定向规则指向脚本的，只要把规则的目标改成 `https://stats.example.com/tool`，用户那边的命令不变。短域名不在 Cloudflare 上也行，在哪里配的重定向就改哪里。

2. **独立域名**（少一次跳转）：Cloudflare 后台 **Workers 和 Pages → install-stats → 设置 → 域和路由 → 添加 → 路由**，填 `tool.example.com/*`；删掉这个域名原来的重定向规则（Cloudflare 先执行重定向规则、后执行 Worker，规则不删 Worker 收不到请求）；再把 `tool.example.com` 填进这个脚本的「独立域名」。

**导入 / 导出**：设置页最下面可以把配置导出成 JSON，或者把 JSON 导入表单再保存，方便搬到另一个部署。格式：

```json
{
  "scripts": [
    { "name": "tool", "url": "https://raw.githubusercontent.com/you/tool/main/install.sh" },
    { "name": "tool-docker", "url": "https://raw.githubusercontent.com/you/tool/main/docker.sh", "hosts": ["docker.example.com"] },
    { "name": "other", "url": "https://example.com/other.sh", "project": "other" }
  ],
  "timezone": "Asia/Shanghai",
  "dockerRepos": ["you/tool"]
}
```

## 徽章

`https://stats.example.com/badge/<项目>.json` 是 [shields.io](https://shields.io/badges/endpoint-badge) 的 endpoint 格式，项目名以 `.sh` 结尾的可以省掉 `.sh`：

```markdown
![runs](https://img.shields.io/endpoint?url=https%3A%2F%2Fstats.example.com%2Fbadge%2Ftool.json)
![今日运行](https://img.shields.io/endpoint?url=https%3A%2F%2Fstats.example.com%2Fbadge%2Ftool.json%3Fperiod%3Dtoday%26lang%3Dzh)
```

参数：`period=today|7d|30d|all`（默认 `all`）、`lang=en|zh`（标签的语言，默认英文）、`label=自定义标签`。只给项目的运行次数；单个脚本、服务器数、国家这些只在统计页里。

## 额度

免费版 Workers 每天 10 万次请求；每次运行写 D1 两行（运行次数、去重），D1 免费版每天 10 万行写入，约合每天 5 万次运行。定时任务每小时跑一次（按所选时区结算前一天），几乎不占额度。

## 更新

fork 后用「导入 Git 仓库」部署的，在 GitHub 上点 **Sync fork** 就能跟上这里的更新（同步后自动重新部署）。

用按钮部署的，复制出来的仓库和这里没有共同的提交历史，不会自动更新。要更新时，在那个仓库里拉一次这里的代码再推送：

```bash
git remote add upstream https://github.com/jinqians/install-stats
git pull --no-rebase --allow-unrelated-histories upstream main   # 第一次要 --allow-unrelated-histories
git push
```

数据库的表由 Worker 自己按 `migrations/` 升级，不用手动操作。

## 测试

在装了 Docker 的测试机上（项目放在 `$W/install-stats`，默认 `/root/w`）：

```bash
bash tests/e2e.sh
```

`wrangler dev` 下跑：刚部署时什么都没设、设置（谁能改、哪些不收）、每个脚本在路径和独立域名上的重定向（并从 GitHub 取回脚本）、哪些算运行、哪些不算、去重、每小时任务（真实读取 Docker Hub，反复跑不重复计）、时区、密码和会话、徽章，以及 Chromium 里的统计页和设置页（中英文）。
