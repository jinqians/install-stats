# install-stats

English ｜ [中文](README.md)

Daily runs of one-line install scripts (the `bash <(curl -sL …)` kind), **for any project**: a Cloudflare Worker redirects each request to your script and counts a run on the way. Deploy it once, enter the scripts to count on its stats page, and that's all: no code to change.

- **Runs**: curl / wget fetching a script once is one run (per day, script and country); browsers and crawlers are counted apart as "other".
- **Unique servers**: a server counts once a day, per script, per project and over everything.
- **Docker pulls**: Docker Hub's total pull count is read once a day; the difference between two days is that day's pulls.
- **The stats page** (behind a password, in English and Chinese): daily bars (mouse or arrow keys to look at each day), each project and script, countries, clients, Docker pulls; the scripts, Docker repositories and time zone are set there too.
- **Public badges**: a project's runs as one number; the details stay on the stats page.

**Privacy**: no IP address is kept. Unique servers come from a hash of the address with a salt that changes every day; the salt and the hashes are deleted when the day ends, and nothing can be matched back to an address afterwards.

![The stats page](https://raw.githubusercontent.com/jinqians/install-stats/main/docs/english.png)

## Deploying

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/jinqians/install-stats)

1. Click the button and sign in to Cloudflare (a free account will do). The deploy page:
   - copies this repository to your GitHub (you can rename it); a push to that copy redeploys;
   - creates the D1 database `install-stats` (the Worker creates its tables on its first request);
   - asks for **ADMIN_PASSWORD**: the stats page's password, 8 characters or more.
2. You get an address, `https://install-stats.<your-subdomain>.workers.dev`. Open it, sign in, and under **Settings** add your scripts and Docker repositories, pick the time zone, and save.
3. For the stats page on a domain of your own (`stats.example.com`, say): Cloudflare dashboard → **Workers & Pages → install-stats → Settings → Domains & Routes → Add → Custom domain**.

Or without the button:

```bash
git clone https://github.com/jinqians/install-stats && cd install-stats
npm install
npx wrangler login
npx wrangler deploy                       # the first deploy creates the D1 database install-stats
npx wrangler secret put ADMIN_PASSWORD
```

Or fork it and connect your fork under **Workers & Pages → Create → Import a repository** (a push deploys); add `ADMIN_PASSWORD` under the Worker's **Settings → Variables and Secrets**.

`wrangler.jsonc` holds nobody's domains or scripts, so it is the same for everyone; routes and custom domains you add in the dashboard are left alone by later deploys.

## Connecting a script

Under **Settings → Scripts**, each script has:

![The settings](https://raw.githubusercontent.com/jinqians/install-stats/main/docs/settings.png)

| Field | |
| --- | --- |
| Name | Lower-case letters, digits and `. _ -`, like `tool`. The script's entry is `https://<the stats page's host>/<name>` |
| Script URL | Where the script really is (`https://`), like `https://raw.githubusercontent.com/you/tool/main/install.sh` |
| Project | Optional: by default the GitHub repository the script is served from; a repository's scripts are one project (badges are per project) |
| Own hostnames | Optional: a short domain of the script's own, like `tool.example.com` (the second way below) |

Two ways in, which can be mixed:

1. **Path** (nothing else to change): hand out `https://stats.example.com/tool`:

   ```bash
   bash <(curl -sL https://stats.example.com/tool)
   ```

   If you already have a short domain whose redirect rule in Cloudflare points at the script, point the rule at `https://stats.example.com/tool` instead; your users' command stays the same. A short domain somewhere else than Cloudflare works too: change its redirect wherever it is set.

2. **Own hostname** (one redirect less): Cloudflare dashboard → **Workers & Pages → install-stats → Settings → Domains & Routes → Add → Route**, `tool.example.com/*`; delete the hostname's old redirect rule (Cloudflare runs redirect rules before Workers, so with the rule in place the Worker never sees the request); then enter `tool.example.com` under the script's own hostnames.

**Import / export**: at the bottom of the settings, the configuration can be exported as JSON, or JSON loaded into the form and saved, to move it to another deployment. The format:

```json
{
  "scripts": [
    { "name": "tool", "url": "https://raw.githubusercontent.com/you/tool/main/install.sh" },
    { "name": "tool-docker", "url": "https://raw.githubusercontent.com/you/tool/main/docker.sh", "hosts": ["docker.example.com"] },
    { "name": "other", "url": "https://example.com/other.sh", "project": "other" }
  ],
  "timezone": "Europe/Berlin",
  "dockerRepos": ["you/tool"]
}
```

## Badges

`https://stats.example.com/badge/<project>.json` is in [shields.io](https://shields.io/badges/endpoint-badge)'s endpoint format; a project ending in `.sh` can be named without it:

```markdown
![runs](https://img.shields.io/endpoint?url=https%3A%2F%2Fstats.example.com%2Fbadge%2Ftool.json)
![runs today](https://img.shields.io/endpoint?url=https%3A%2F%2Fstats.example.com%2Fbadge%2Ftool.json%3Fperiod%3Dtoday)
```

Parameters: `period=today|7d|30d|all` (default `all`), `lang=en|zh` (the label's language, English by default), `label=your own label`. Only a project's runs; single scripts, servers and countries stay on the stats page.

## Limits

The free Workers plan allows 100,000 requests a day; a run writes two D1 rows (the run, the unique server), and free D1 allows 100,000 written rows a day: about 50,000 runs a day. The scheduled job runs hourly (closing the day before in the time zone you picked) and costs next to nothing.

## Updating

A fork deployed through **Import a repository** follows this repository with GitHub's **Sync fork** (the sync redeploys).

A copy made by the button shares no history with this repository and does not follow it by itself. To update, pull from here into your copy and push:

```bash
git remote add upstream https://github.com/jinqians/install-stats
git pull --no-rebase --allow-unrelated-histories upstream main   # --allow-unrelated-histories the first time
git push
```

The Worker upgrades its own tables from `migrations/`; there is nothing to run by hand.

## Tests

On a test machine with Docker (the project in `$W/install-stats`, `/root/w` by default):

```bash
bash tests/e2e.sh
```

Under `wrangler dev`: a fresh deployment with nothing set; the settings (who may change them, what is refused); each script's redirect at its path and on its own hostname (and the script fetched from GitHub); what is counted and what is not; unique servers; the hourly job (Docker Hub read for real, run again and again without counting twice); the time zone; the password and sessions; the badges; and the stats and settings pages in Chromium, in English and Chinese.
