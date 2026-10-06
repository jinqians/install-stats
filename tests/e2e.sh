#!/usr/bin/env bash
# install-stats under `wrangler dev`, on a test machine with Docker (the
# project under $W, default /root/w): a fresh deployment with nothing set; the
# settings (who may change them, what is refused); the redirect each script
# answers with, at its path and on a hostname of its own (and the script it
# leads to, fetched from GitHub); what is counted and what is not, unique
# servers; the hourly job (Docker Hub's real pull count), run again and again;
# the time zone a day is counted in; the stats behind the password; the badges;
# and the page in a browser, settings included.
set -uo pipefail
W=${W:-/root/w}; N=$W/install-stats; T=$W/e2e-stats
rm -rf "$T"; mkdir -p "$T"
pass=0; fail=0
ok()  { echo "  ok   $1"; pass=$((pass + 1)); }
bad() { echo "  FAIL $1"; fail=$((fail + 1)); }
chk() { local n="$1"; shift; if "$@" >"$T/chk.out" 2>&1; then ok "$n"; else bad "$n"; tail -8 "$T/chk.out" | sed 's/^/       /'; fi; }
sec() { echo; echo "=== $1"; }
wait_for() { local end=$((SECONDS + $1)); shift; until "$@" >/dev/null 2>&1; do (( SECONDS < end )) || return 1; sleep 2; done; }

K=is-e2e; U=is-e2e-ui
cleanup() { docker cp "$K":/tmp/wrangler.log "$T/wrangler.log" >/dev/null 2>&1; docker rm -f "$K" "$U" >/dev/null 2>&1; true; }
trap cleanup EXIT
cleanup
ADMIN=stats-admin-pass-123
B=http://127.0.0.1:8787   # the stats page's own host here: 127.0.0.1

# one request for a script, as a client makes it: <host> [ip] [user agent] [path] [curl options…]
hit() { docker exec "$K" curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -H "Host: $1" -H "CF-Connecting-IP: ${2:-203.0.113.1}" -A "${3:-curl/8.5.0}" "${@:5}" "$B${4:-/}"; }
d1() { docker exec "$K" npx wrangler d1 execute install-stats --local --json --command "$1" 2>/dev/null | jq -c '.[0].results'; }
api() { docker exec "$K" curl -s -H "Cookie: $COOKIE" "$B$1"; }
code() { docker exec "$K" curl -s -o /tmp/body -w '%{http_code}' -H 'Content-Type: application/json' "$@"; }
# PUT a configuration (a file under $T) with the session; prints the status, the body is in the container's /tmp/body
put() { docker cp "$1" "$K":/tmp/put.json >/dev/null; code -X PUT -H "Cookie: $COOKIE" --data-binary @/tmp/put.json "${@:2}" "$B/api/config"; }
body() { docker exec "$K" cat /tmp/body; }
start_dev() { docker exec -d "$K" sh -c 'npx wrangler dev --ip 0.0.0.0 --port 8787 --test-scheduled >> /tmp/wrangler.log 2>&1'; }

sec "the Worker (wrangler dev), as the Deploy button leaves it: nothing set"
docker run -d --name "$K" -v "$N:/app" -w /app node:22 sleep infinity >/dev/null
rm -rf "$N/.wrangler"
chk "npm install" docker exec "$K" npm install --no-audit --no-fund
chk "typecheck" docker exec "$K" npx tsc --noEmit
chk "wrangler.jsonc lists no routes and no scripts: it is the same for everyone" bash -c \
    "sed -E '/^[[:space:]]*\/\//d' '$N/wrangler.jsonc' | jq -e '(has(\"routes\") | not) and (has(\"vars\") | not) and .triggers.crons == [\"7 * * * *\"]'"
chk "the Deploy form asks for ADMIN_PASSWORD (.dev.vars.example, package.json)" bash -c \
    "grep -q '^ADMIN_PASSWORD=$' '$N/.dev.vars.example' && jq -e '.cloudflare.bindings.ADMIN_PASSWORD.description | length > 0' '$N/package.json'"
docker exec "$K" sh -c "printf 'ADMIN_PASSWORD=$ADMIN\n' > .dev.vars"
start_dev
chk "it answers: the stats page" wait_for 120 bash -c "[[ \$(docker exec $K curl -s -o /dev/null -w '%{http_code}' $B/) == 200 ]]"
chk "no script yet: /snell is not one (404)" test "$(hit 127.0.0.1:8787 203.0.113.1 curl/8.5.0 /snell)" = "404 "

sec "signing in"
chk "no session → 401 (stats and settings)" bash -c "[[ \$(docker exec $K curl -s -o /dev/null -w '%{http_code}' $B/api/stats) == 401 && \$(docker exec $K curl -s -o /dev/null -w '%{http_code}' $B/api/config) == 401 ]]"
start=$SECONDS
chk "a wrong password → 401" test "$(code -d '{"password":"guess-guess"}' $B/api/login)" = 401
chk "… and it took a second" test $((SECONDS - start)) -ge 1
chk "a sign-in from another site → 403" test "$(code -H 'Sec-Fetch-Site: cross-site' -d "{\"password\":\"$ADMIN\"}" $B/api/login)" = 403
docker exec "$K" curl -s -D /tmp/h -o /dev/null -H 'Content-Type: application/json' -d "{\"password\":\"$ADMIN\"}" $B/api/login
COOKIE=$(docker exec "$K" sh -c "tr -d '\r' < /tmp/h | sed -n 's/^set-cookie: \(st=[^;]*\).*/\1/ip'")
chk "the right one → a session cookie (HttpOnly, Secure, SameSite=Strict)" bash -c "docker exec $K grep -i '^set-cookie: st=' /tmp/h | grep -q 'HttpOnly; Secure; SameSite=Strict' && [[ -n '$COOKIE' ]]"
chk "a fresh deployment: no scripts, UTC, no Docker repositories" bash -c \
    "$(declare -f api); K=$K B=$B COOKIE='$COOKIE'; api /api/config | jq -e '.scripts == [] and .timezone == \"UTC\" and .dockerRepos == [] and .host == \"127.0.0.1\"' && api '/api/stats?days=7' | jq -e '.scripts == [] and (.days | length) == 7'"

sec "the settings: what is refused, nothing saved"
# the configuration a user would import: snell.sh's scripts (three on hostnames of their
# own, the rest at their paths), two other projects' and one of its own project
cat > "$T/conf.json" <<'EOF'
{
  "scripts": [
    { "name": "install", "url": "https://raw.githubusercontent.com/jinqians/snell.sh/main/scripts/install.sh", "hosts": ["install.jinqians.com"] },
    { "name": "snell", "url": "https://raw.githubusercontent.com/jinqians/snell.sh/main/snell.sh", "hosts": ["snell.jinqians.com"] },
    { "name": "snell-centos", "url": "https://raw.githubusercontent.com/jinqians/snell.sh/main/snell-centos.sh" },
    { "name": "snell-docker", "url": "https://raw.githubusercontent.com/jinqians/snell.sh/main/scripts/snell-docker.sh" },
    { "name": "snell-alpine", "url": "https://raw.githubusercontent.com/jinqians/snell.sh/main/snell-alpine.sh" },
    { "name": "menu", "url": "https://raw.githubusercontent.com/jinqians/snell.sh/main/scripts/menu.sh", "hosts": ["Menu.Jinqians.com."] },
    { "name": "ss", "url": "https://raw.githubusercontent.com/jinqians/ss-2022.sh/main/ss-2022.sh" },
    { "name": "psm", "url": "https://raw.githubusercontent.com/jinqians/proxy-stack/main/bootstrap.sh" },
    { "name": "tool", "url": "https://example.com/tool.sh", "project": "demo" }
  ],
  "timezone": "Asia/Shanghai",
  "dockerRepos": ["jinqians/snell-server"]
}
EOF
refused() {   # <what> <jq that spoils the configuration> <the field the answer names>
    jq "$2" "$T/conf.json" > "$T/bad.json"
    chk "$1 → 400 ($3)" bash -c "$(declare -f put code body); K=$K B=$B COOKIE='$COOKIE'; [[ \$(put $T/bad.json) == 400 ]] && body | jq -e --arg f '$3' '.error == \"invalid\" and .field == \$f'"
}
refused "a name of the page's own (api)" '.scripts[0].name = "api"' reserved
refused "a name with a space" '.scripts[0].name = "bad name"' name
refused "a name twice" '.scripts[1].name = "install"' duplicate_name
refused "a script over http://" '.scripts[0].url = "http://example.com/x.sh"' url
refused "a project name with a slash" '.scripts[0].project = "a/b"' project
refused "a hostname that is not one" '.scripts[0].hosts = ["not a host"]' host
refused "a hostname twice" '.scripts[2].hosts = ["snell.jinqians.com"]' duplicate_host
refused "the stats page's own hostname" '.scripts[0].hosts = ["127.0.0.1"]' stats_host
refused "an unknown time zone" '.timezone = "Mars/Olympus"' timezone
refused "a Docker repository not owner/name" '.dockerRepos = ["nope"]' repo
chk "… none of it saved" bash -c "$(declare -f api); K=$K B=$B COOKIE='$COOKIE'; api /api/config | jq -e '.scripts == []'"
chk "a change from another site → 403" bash -c "$(declare -f put code); K=$K B=$B COOKIE='$COOKIE'; [[ \$(put $T/conf.json -H 'Sec-Fetch-Site: cross-site') == 403 ]]"
chk "… and without a session → 401" bash -c "$(declare -f put code); K=$K B=$B COOKIE='x'; [[ \$(put $T/conf.json) == 401 ]]"
chk "the configuration saved (hostnames lower-cased, the trailing dot dropped), read back the same" bash -c \
    "$(declare -f put code body api); K=$K B=$B COOKIE='$COOKIE'; [[ \$(put $T/conf.json) == 200 ]] && api /api/config > $T/conf-back.json &&
     jq -e '(.scripts | length) == 9 and .scripts[5].hosts == [\"menu.jinqians.com\"] and .timezone == \"Asia/Shanghai\" and .dockerRepos == [\"jinqians/snell-server\"]' $T/conf-back.json &&
     [[ \"\$(jq -c '[.scripts[] | [.name, .url]]' $T/conf-back.json)\" == \"\$(jq -c '[.scripts[] | [.name, .url]]' $T/conf.json)\" ]]"

sec "every script: a redirect to its URL, at its path and on its own hostname"
while IFS=$'\t' read -r n u; do
    chk "/$n → 302 $u" test "$(hit 127.0.0.1:8787 198.51.100.200 'curl/8.5.0' "/$n" -I)" = "302 $u"
done < <(jq -r '.scripts[] | [.name, .url] | @tsv' "$T/conf.json")
SNELL=$(jq -r '.scripts[1].url' "$T/conf.json"); MENU=$(jq -r '.scripts[5].url' "$T/conf.json")
chk "snell.jinqians.com/ → 302 to snell's URL; menu.jinqians.com too" bash -c "[[ \"\$($(declare -f hit); K=$K B=$B; hit snell.jinqians.com 198.51.100.200 curl/8.5.0 / -I)\" == '302 $SNELL' && \"\$($(declare -f hit); K=$K B=$B; hit menu.jinqians.com 198.51.100.200 curl/8.5.0 / -I)\" == '302 $MENU' ]]"
chk "… a path upper-cased (/SNELL) is the same script" test "$(hit 127.0.0.1:8787 198.51.100.200 curl/8.5.0 /SNELL -I)" = "302 $SNELL"
chk "a crawler's guess on a script's hostname (/wp-login.php) goes to the script too" test "$(hit menu.jinqians.com 198.51.100.200 Mozilla/5.0 /wp-login.php)" = "302 $MENU"
chk "… on the stats page's host it is no script (404)" test "$(hit 127.0.0.1:8787 198.51.100.200 Mozilla/5.0 /wp-login.php)" = "404 "
chk "the redirect leads to the real script (fetched from GitHub)" bash -c "docker exec $K curl -fsSL '$SNELL' | head -c 4000 > $T/snell.sh; head -1 $T/snell.sh | grep -q '^#!' && grep -qi snell $T/snell.sh"

sec "what is counted"
# snell: 3 on its hostname, 2 at its path (5 curl from 3 addresses), wget at its path from a 4th,
# a browser, a favicon and a HEAD (none of them a run); menu once on its hostname
for ip in 203.0.113.1 203.0.113.1 203.0.113.2; do hit snell.jinqians.com "$ip" >/dev/null; done
for ip in 203.0.113.2 203.0.113.3; do hit 127.0.0.1:8787 "$ip" curl/8.5.0 /snell >/dev/null; done
hit 127.0.0.1:8787 203.0.113.4 'Wget/1.21.4' /snell >/dev/null
hit snell.jinqians.com 203.0.113.5 'Mozilla/5.0 (X11; Linux x86_64)' >/dev/null
hit snell.jinqians.com 203.0.113.6 'curl/8.5.0' /favicon.ico >/dev/null
hit 127.0.0.1:8787 203.0.113.7 'curl/8.5.0' /snell -I >/dev/null
hit menu.jinqians.com 203.0.113.1 >/dev/null
hit "[2001:db8::7]" 203.0.113.9 >/dev/null   # not a script: the stats page
sleep 3
q() { d1 "SELECT (SELECT SUM(n) FROM hits WHERE script = 'snell' AND agent != 'other') AS runs,
               (SELECT SUM(n) FROM hits WHERE script = 'snell' AND agent = 'other') AS other,
               (SELECT SUM(n) FROM hits WHERE script = 'snell' AND agent = 'wget') AS wget,
               (SELECT COUNT(*) FROM seen WHERE script = 'snell') AS uniq,
               (SELECT SUM(n) FROM hits WHERE script = 'menu') AS menu,
               (SELECT COUNT(*) FROM salts) AS salts, (SELECT SUM(n) FROM hits) AS all_hits,
               (SELECT COUNT(DISTINCT h) FROM seen) AS servers" | jq -c '.[0]'; }
q | sed 's/^/       /'
chk "snell: 6 runs on its hostname and at its path as one (5 curl, 1 wget); the favicon and the HEAD not runs" bash -c "$(declare -f d1 q); K=$K; q | jq -e '.runs == 6 and .wget == 1'"
chk "… a browser counted apart (other: 1)" bash -c "$(declare -f d1 q); K=$K; q | jq -e '.other == 1'"
chk "… 4 servers ran it: 5 curl from 3 addresses, wget from a 4th (the browser is no server)" bash -c "$(declare -f d1 q); K=$K; q | jq -e '.uniq == 4'"
chk "menu: 1; one salt for the day" bash -c "$(declare -f d1 q); K=$K; q | jq -e '.menu == 1 and .salts == 1'"
chk "… 4 servers over both (menu's is one of snell's): one hash per server and day" bash -c "$(declare -f d1 q); K=$K; q | jq -e '.servers == 4'"
chk "nothing else counted: the HEADs, /wp-login.php, the favicon (8 in all)" bash -c "$(declare -f d1 q); K=$K; q | jq -e '.all_hits == 8'"
chk "no address is stored: neither in D1 nor in its files" bash -c "! docker exec $K grep -rqF '203.0.113.' /app/.wrangler/state/v3/d1"

sec "the stats"
api '/api/stats?days=7' > "$T/stats.json"
chk "today's runs, servers, other per script; servers over all, each once" jq -e '.runs.snell[-1] == 6 and .unique.snell[-1] == 4 and .other.snell[-1] == 1 and .runs.menu[-1] == 1 and .unique.menu[-1] == 1 and .uniqueAll[-1] == 4' "$T/stats.json"
chk "… seven days, every script, in the settings' order" jq -e '(.days | length) == 7 and .days[-1] == .today and ([.scripts[].name] | length) == 9 and .scripts[0].name == "install" and .scripts[1].hosts == ["snell.jinqians.com"]' "$T/stats.json"
chk "… in their projects (named, or the repository each comes from): snell.sh has six, its servers today 4" jq -e \
    '[.projects[].name] == ["snell.sh", "ss-2022.sh", "proxy-stack", "demo"] and (.projects[0].scripts | length) == 6 and .projects[0].unique[-1] == 4 and .projects[1].unique[-1] == 0' "$T/stats.json"
chk "… clients: 6 curl, 1 wget, 1 other; countries add up to the runs" jq -e '.agents.curl == 6 and .agents.wget == 1 and .agents.other == 1 and ([.countries[].n] | add) == 7' "$T/stats.json"
chk "a forged session → 401" test "$(docker exec $K curl -s -o /dev/null -w '%{http_code}' -H "Cookie: st=9999999999.$(printf 'x%.0s' $(seq 43))" $B/api/stats)" = 401
chk "an expired one → 401" test "$(docker exec $K curl -s -o /dev/null -w '%{http_code}' -H "Cookie: st=1000.${COOKIE##*.}" $B/api/stats)" = 401
chk "the page: a Content-Security-Policy with no inline script; no framing" bash -c \
    "docker exec $K curl -s -D - -o /dev/null $B/ | tr -d '\r' | tee $T/h | grep -i '^content-security-policy:' | grep -q \"script-src 'self';\" && grep -qi '^x-frame-options: DENY' $T/h"

sec "the hourly job: the days before today closed, Docker Hub read once a day"
TODAY=$(jq -r .today "$T/stats.json"); YDAY=$(date -u -d "$TODAY -1 day" +%F); OLD=$(date -u -d "$TODAY -2 day" +%F)
d1 "INSERT INTO seen (day, script, h) VALUES ('$YDAY', 'snell', 'a'), ('$YDAY', 'snell', 'b'), ('$YDAY', 'snell', 'c'), ('$YDAY', 'menu', 'a')" >/dev/null
d1 "INSERT INTO salts (day, salt) VALUES ('$YDAY', 'y'), ('$OLD', 'o')" >/dev/null
d1 "INSERT INTO hits (day, script, country, agent, n) VALUES ('$YDAY', 'snell', 'JP', 'curl', 4)" >/dev/null
chk "the trigger runs" bash -c "docker exec $K curl -s -o /dev/null -w '%{http_code}' '$B/__scheduled?cron=7+*+*+*+*' | grep -q 200"
sleep 6
r() { d1 "SELECT (SELECT group_concat(script || ':' || n) FROM uniques WHERE day = '$YDAY') AS closed,
               (SELECT COUNT(*) FROM seen WHERE day < '$TODAY') AS old_seen, (SELECT COUNT(*) FROM seen WHERE day = '$TODAY') AS today_seen,
               (SELECT group_concat(day) FROM salts) AS salts, (SELECT total FROM pulls WHERE day = '$TODAY' AND repo = 'jinqians/snell-server') AS pulls" | jq -c '.[0]'; }
r | sed 's/^/       /'
chk "yesterday's servers counted (snell 3, menu 1, 3 over both and over the project), their hashes and salt gone" bash -c \
    "$(declare -f d1 r); K=$K; TODAY=$TODAY; YDAY=$YDAY; r | jq -e '(.closed | split(\",\") | sort) == [\"*:3\", \"@snell.sh:3\", \"menu:1\", \"snell:3\"] and .old_seen == 0'"
chk "… today's untouched (snell's 4 servers and menu's 1; its salt)" bash -c "$(declare -f d1 r); K=$K; TODAY=$TODAY; YDAY=$YDAY; r | jq -e --arg t '$TODAY' '.today_seen == 5 and .salts == \$t'"
chk "Docker Hub: jinqians/snell-server's pull count read" bash -c "$(declare -f d1 r); K=$K; TODAY=$TODAY; YDAY=$YDAY; r | jq -e '.pulls > 1000'"
TOTAL=$(r | jq -r '.pulls // 0')
# the next hour's run: nothing closed twice, Docker Hub not read again today
d1 "UPDATE pulls SET total = $((TOTAL - 7)) WHERE day = '$TODAY'" >/dev/null
docker exec "$K" curl -s -o /dev/null "$B/__scheduled?cron=7+*+*+*+*"; sleep 6
chk "run again an hour later: yesterday as it was, today's reading kept (read once a day)" bash -c \
    "$(declare -f d1 r); K=$K; TODAY=$TODAY; YDAY=$YDAY; r | jq -e '(.closed | split(\",\") | sort) == [\"*:3\", \"@snell.sh:3\", \"menu:1\", \"snell:3\"] and .today_seen == 5 and .pulls == $((TOTAL - 7))'"
d1 "UPDATE pulls SET total = $TOTAL WHERE day = '$TODAY'" >/dev/null
d1 "INSERT INTO pulls (day, repo, total) VALUES ('$YDAY', 'jinqians/snell-server', $((TOTAL - 50)))" >/dev/null
api '/api/stats?days=7' > "$T/stats2.json"
chk "the stats: yesterday's 3 snell servers (3 over all), 4 runs; its pulls (50) from the two readings" jq -e \
    '.unique.snell[-2] == 3 and .uniqueAll[-2] == 3 and .projects[0].unique[-2] == 3 and .runs.snell[-2] == 4 and .pulls[0].repo == "jinqians/snell-server" and .pulls[0].days[-2] == 50 and .pulls[0].total >= '"$TOTAL" "$T/stats2.json"
chk "… today's servers still counted live (snell 4, 4 over all)" jq -e '.unique.snell[-1] == 4 and .uniqueAll[-1] == 4' "$T/stats2.json"

sec "the time zone a day is counted in"
for tz in Pacific/Kiritimati Etc/GMT+12 Asia/Shanghai; do
    jq --arg tz "$tz" '.timezone = $tz' "$T/conf.json" > "$T/tz.json"
    chk "$tz: today is $(TZ=$tz date +%F) there" bash -c \
        "$(declare -f put code api); K=$K B=$B COOKIE='$COOKIE'; [[ \$(put $T/tz.json) == 200 ]] && api '/api/stats?days=7' | jq -e --arg d \$(TZ=$tz date +%F) --arg tz $tz '.today == \$d and .timezone == \$tz'"
done

sec "badges (shields.io endpoint): a project's runs as one number"
chk "snell today: 7 runs (snell 6 and menu 1, as one); English by default" bash -c "docker exec $K curl -s '$B/badge/snell.json?period=today' | jq -e '.schemaVersion == 1 and .message == \"7\" and .label == \"runs today\"'"
chk "… all time: 11; by the repository's name too (snell.sh); in Chinese with lang=zh" bash -c "docker exec $K curl -s '$B/badge/snell.sh.json?lang=zh' | jq -e '.message == \"11\" and .label == \"累计运行\"'"
chk "… a label of one's own; proxy-stack: 0; a project named in the settings (demo): 0" bash -c \
    "docker exec $K curl -s '$B/badge/snell.json?label=installs' | jq -e '.label == \"installs\"' && docker exec $K curl -s '$B/badge/proxy-stack.json' | jq -e '.message == \"0\"' && docker exec $K curl -s '$B/badge/demo.json' | jq -e '.message == \"0\"'"
chk "no badge for one script, nor for servers: those stay on the stats page" bash -c \
    "for b in menu snell.jinqians.com nope; do [[ \$(docker exec $K curl -s -o /dev/null -w '%{http_code}' $B/badge/\$b.json) == 404 ]] || exit 1; done; docker exec $K curl -s '$B/badge/snell.json?period=today&kind=unique' | jq -e '.message == \"7\"'"

sec "the chart for a README: a project's runs per day, all its scripts as one"
CH="$B/chart"
docker exec "$K" curl -s -D /tmp/ch -o /tmp/chart.svg "$CH/snell.svg"; docker cp "$K":/tmp/chart.svg "$T/chart.svg" >/dev/null; docker cp "$K":/tmp/ch "$T/chart.h" >/dev/null
chk "an SVG (well-formed), cached an hour, readable from anywhere" bash -c \
    "grep -qi '^content-type: image/svg+xml' $T/chart.h && grep -qi '^cache-control: public, max-age=3600' $T/chart.h && grep -qi '^access-control-allow-origin: \\*' $T/chart.h && python3 -c 'import sys, xml.dom.minidom; xml.dom.minidom.parse(sys.argv[1])' $T/chart.svg"
chk "… 30 days; snell.sh today 7 (snell and menu as one), yesterday 4, 11 in all" bash -c \
    "grep -q 'daily runs, last 30 days' $T/chart.svg && grep -q '>11 runs<' $T/chart.svg && grep -q '<title>$TODAY: 7</title>' $T/chart.svg && grep -q '<title>$YDAY: 4</title>' $T/chart.svg && [[ \$(grep -o '<rect ' $T/chart.svg | wc -l) == 2 ]]"
chk "… no script by name, nothing but the project's runs" bash -c "! grep -qE 'menu|snell-centos|install' $T/chart.svg"
chk "… in Chinese, dark, over 7 days" bash -c \
    "docker exec $K curl -s '$CH/snell.sh.svg?lang=zh&theme=dark&days=7' > $T/chart-zh.svg && grep -q '近 7 天每日运行' $T/chart-zh.svg && grep -q '共 11 次' $T/chart-zh.svg && grep -q '#3987e5' $T/chart-zh.svg && grep -q '>今日<' $T/chart-zh.svg"
chk "… a project with no runs: an empty chart (proxy-stack); no chart for one script or no project (404)" bash -c \
    "docker exec $K curl -s '$CH/proxy-stack.svg' | grep -q '>0 runs<' && for c in menu nope; do [[ \$(docker exec $K curl -s -o /dev/null -w '%{http_code}' $CH/\$c.svg) == 404 ]] || exit 1; done"
chk "a script cannot be named chart (the page's own path)" bash -c \
    "jq '.scripts[0].name = \"chart\"' $T/conf.json > $T/bad.json && $(declare -f put code body); K=$K B=$B COOKIE='$COOKIE'; [[ \$(put $T/bad.json) == 400 ]] && body | jq -e '.field == \"reserved\"'"

sec "the page, in a browser (Playwright)"
docker run -d --name "$U" --network "container:$K" -v "$N/tests:/tests:ro" -v "$T:/out" -w /ui node:22 sleep infinity >/dev/null
chk "Playwright + Chromium" docker exec "$U" sh -c 'npm init -y >/dev/null && npm install --no-audit --no-fund playwright >/dev/null 2>&1 && npx playwright install --with-deps chromium >/dev/null 2>&1'
# localhost: the session cookie is Secure, which a browser keeps over http only there
docker exec "$U" sh -c "cp /tests/ui.mjs /ui/ && node /ui/ui.mjs http://localhost:8787 /out $ADMIN" > "$T/ui.out" 2>&1; ui=$?
sed 's/^/  /' "$T/ui.out"
(( ui == 0 )) && ok "the page" || bad "the page"
pass=$((pass + $(grep -c '^ok ' "$T/ui.out"))); fail=$((fail + $(grep -c '^FAIL ' "$T/ui.out")))
chk "what the page saved is what the Worker has (the demo script it added, then removed)" bash -c \
    "$(declare -f api); K=$K B=$B COOKIE='$COOKIE'; api /api/config | jq -e '(.scripts | length) == 9 and ([.scripts[].name] | index(\"demo2\")) == null'"

sec "no password set"
docker exec "$K" sh -c "printf 'ADMIN_PASSWORD=short\n' > .dev.vars"
docker exec "$K" sh -c 'pkill -f "wrangler dev"; pkill -f workerd; true'; sleep 2
start_dev
chk "it answers again" wait_for 120 bash -c "[[ \$(docker exec $K curl -s -o /dev/null -w '%{http_code}' $B/) == 200 ]]"
chk "a password under 8 characters: stats, settings and sign-in say to set one (503)" bash -c \
    "for p in /api/stats /api/config; do [[ \$(docker exec $K curl -s -o /dev/null -w '%{http_code}' $B\$p) == 503 ]] || exit 1; done; [[ \$(docker exec $K curl -s -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -d '{\"password\":\"short\"}' $B/api/login) == 503 ]]"
chk "… the scripts are still served (the settings are in D1) and counted: tool → demo" bash -c \
    "[[ \$($(declare -f hit); K=$K B=$B; hit snell.jinqians.com 203.0.113.1 curl/8 /) == '302 $SNELL' && \$($(declare -f hit); K=$K B=$B; hit 127.0.0.1:8787 203.0.113.1 curl/8 /tool) == '302 https://example.com/tool.sh' ]] && sleep 2 && docker exec $K curl -s '$B/badge/demo.json?period=today' | jq -e '.message == \"1\"'"

echo
echo "=== RESULT: $pass ok, $fail failed"
(( fail == 0 ))
