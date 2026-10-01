#!/usr/bin/env bash
# install-stats under `wrangler dev`, on a test machine with Docker (the
# project under $W, default /root/w): the redirect every script domain answers
# with (and the script it leads to, fetched from GitHub), what is counted and
# what is not, unique servers, the daily job (Docker Hub's real pull count),
# the stats behind the password, the badges, and the page in a browser.
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
cleanup() { docker cp "$K":/tmp/wrangler.log "$T/wrangler.log" >/dev/null 2>&1; docker rm -f "$K" "$U" >/dev/null 2>&1; rm -f "$N/wrangler.dev.json"; true; }
trap cleanup EXIT
cleanup
ADMIN=stats-admin-pass-123
B=http://127.0.0.1:8787

# one request for a script, as a client makes it: <host> [ip] [user agent] [path] [curl options…]
hit() { docker exec "$K" curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -H "Host: $1" -H "CF-Connecting-IP: ${2:-203.0.113.1}" -A "${3:-curl/8.5.0}" "${@:5}" "$B${4:-/}"; }
d1() { docker exec "$K" npx wrangler d1 execute install-stats -c wrangler.dev.json --local --json --command "$1" 2>/dev/null | jq -c '.[0].results'; }
api() { docker exec "$K" curl -s -H "Cookie: $COOKIE" "$B$1"; }
code() { docker exec "$K" curl -s -o /tmp/body -w '%{http_code}' -H 'Content-Type: application/json' "$@"; }

sec "the Worker (wrangler dev)"
docker run -d --name "$K" -v "$N:/app" -w /app node:22 sleep infinity >/dev/null
rm -rf "$N/.wrangler"
chk "npm install" docker exec "$K" npm install --no-audit --no-fund
chk "typecheck" docker exec "$K" npx tsc --noEmit
docker exec "$K" sh -c "printf 'ADMIN_PASSWORD=$ADMIN\n' > .dev.vars"
# the config without its routes (tests/dev-config.mjs says why)
chk "the dev config" docker exec "$K" node tests/dev-config.mjs
docker exec -d "$K" sh -c 'npx wrangler dev -c wrangler.dev.json --ip 0.0.0.0 --port 8787 --test-scheduled > /tmp/wrangler.log 2>&1'
chk "it answers" wait_for 120 bash -c "[[ \$(docker exec $K curl -s -o /dev/null -w '%{http_code}' $B/) == 200 ]]"

sec "every script domain: a redirect to its script, as the redirect rules did"
# TARGETS from wrangler.jsonc (its comments are whole lines)
sed -E '/^[[:space:]]*\/\//d' "$N/wrangler.jsonc" > "$T/wrangler.json"
jq '.vars.TARGETS' "$T/wrangler.json" > "$T/targets.json"
chk "eight script domains in wrangler.jsonc" test "$(jq 'length' "$T/targets.json")" = 8
chk "… each with its route (or Cloudflare never hands it to the Worker)" jq -e \
    '(.vars.TARGETS | keys | sort) == ([.routes[] | select(.custom_domain != true) | .pattern | sub("/\\*$"; "")] | sort)' "$T/wrangler.json"
while IFS=$'\t' read -r h u; do
    chk "$h → 302 $u" test "$(hit "$h" 198.51.100.200 'curl/8.5.0' / -I)" = "302 $u"
done < <(jq -r 'to_entries[] | [.key, .value] | @tsv' "$T/targets.json")
chk "a crawler's guess (/wp-login.php) goes to the script too" test "$(hit menu.jinqians.com 198.51.100.200 Mozilla/5.0 /wp-login.php)" = "302 $(jq -r '."menu.jinqians.com"' "$T/targets.json")"
URL=$(hit snell.jinqians.com 198.51.100.201 curl/8.5.0 / -I | cut -d' ' -f2)
chk "the redirect leads to the real script (fetched from GitHub)" bash -c "docker exec $K curl -fsSL '$URL' | head -c 4000 > $T/snell.sh; head -1 $T/snell.sh | grep -q '^#!' && grep -qi snell $T/snell.sh"

sec "what is counted"
for ip in 203.0.113.1 203.0.113.1 203.0.113.2 203.0.113.2 203.0.113.3; do hit snell.jinqians.com "$ip" >/dev/null; done
hit snell.jinqians.com 203.0.113.4 'Wget/1.21.4' >/dev/null
hit snell.jinqians.com 203.0.113.5 'Mozilla/5.0 (X11; Linux x86_64)' >/dev/null
hit snell.jinqians.com 203.0.113.6 'curl/8.5.0' /favicon.ico >/dev/null
hit menu.jinqians.com 203.0.113.1 >/dev/null
hit "[2001:db8::7]" 203.0.113.9 >/dev/null   # not a script: the stats page
sleep 3
q() { d1 "SELECT (SELECT SUM(n) FROM hits WHERE host = 'snell.jinqians.com' AND agent != 'other') AS runs,
               (SELECT SUM(n) FROM hits WHERE host = 'snell.jinqians.com' AND agent = 'other') AS other,
               (SELECT SUM(n) FROM hits WHERE host = 'snell.jinqians.com' AND agent = 'wget') AS wget,
               (SELECT COUNT(*) FROM seen WHERE host = 'snell.jinqians.com') AS uniq,
               (SELECT SUM(n) FROM hits WHERE host = 'menu.jinqians.com') AS menu,
               (SELECT COUNT(*) FROM salts) AS salts, (SELECT SUM(n) FROM hits) AS all_hits,
               (SELECT COUNT(DISTINCT h) FROM seen) AS servers" | jq -c '.[0]'; }
q | sed 's/^/       /'
chk "snell: 6 runs (5 curl, 1 wget), the favicon not one" bash -c "$(declare -f d1 q); K=$K; q | jq -e '.runs == 6 and .wget == 1'"
chk "… a browser counted apart (other: 1)" bash -c "$(declare -f d1 q); K=$K; q | jq -e '.other == 1'"
chk "… 4 servers ran it: 5 curl from 3 addresses, wget from a 4th (the browser is no server)" bash -c "$(declare -f d1 q); K=$K; q | jq -e '.uniq == 4'"
chk "menu: 1; one salt for the day" bash -c "$(declare -f d1 q); K=$K; q | jq -e '.menu == 1 and .salts == 1'"
chk "… 4 servers over both (menu's is one of snell's): one hash per server and day" bash -c "$(declare -f d1 q); K=$K; q | jq -e '.servers == 4'"
chk "nothing else counted: the HEADs, /wp-login.php, the favicon (8 in all)" bash -c "$(declare -f d1 q); K=$K; q | jq -e '.all_hits == 8'"
chk "no address is stored: neither in D1 nor in its files" bash -c "! docker exec $K grep -rqF '203.0.113.' /app/.wrangler/state/v3/d1"

sec "the stats, behind the password"
chk "no session → 401" test "$(code $B/api/stats)" = 401
start=$SECONDS
chk "a wrong password → 401" test "$(code -d '{"password":"guess-guess"}' $B/api/login)" = 401
chk "… and it took a second" test $((SECONDS - start)) -ge 1
chk "a sign-in from another site → 403" test "$(code -H 'Sec-Fetch-Site: cross-site' -d "{\"password\":\"$ADMIN\"}" $B/api/login)" = 403
docker exec "$K" curl -s -D /tmp/h -o /dev/null -H 'Content-Type: application/json' -d "{\"password\":\"$ADMIN\"}" $B/api/login
COOKIE=$(docker exec "$K" sh -c "tr -d '\r' < /tmp/h | sed -n 's/^set-cookie: \(st=[^;]*\).*/\1/ip'")
chk "the right one → a session cookie (HttpOnly, Secure, SameSite=Strict)" bash -c "docker exec $K grep -i '^set-cookie: st=' /tmp/h | grep -q 'HttpOnly; Secure; SameSite=Strict' && [[ -n '$COOKIE' ]]"
api '/api/stats?days=7' > "$T/stats.json"
chk "the stats: today's runs, servers, other per script; servers over all, each once" jq -e '.runs["snell.jinqians.com"][-1] == 6 and .unique["snell.jinqians.com"][-1] == 4 and .other["snell.jinqians.com"][-1] == 1 and .runs["menu.jinqians.com"][-1] == 1 and .unique["menu.jinqians.com"][-1] == 1 and .uniqueAll[-1] == 4' "$T/stats.json"
chk "… seven days, every script in TARGETS, in order" jq -e '(.days | length) == 7 and .days[-1] == .today and ([.hosts[].host] | length) == 8 and .hosts[0].host == "install.jinqians.com"' "$T/stats.json"
chk "… in their projects (the repository each comes from): snell.sh has six, its servers today 4" jq -e \
    '[.projects[].name] == ["snell.sh", "ss-2022.sh", "proxy-stack"] and (.projects[0].hosts | length) == 6 and .projects[0].unique[-1] == 4 and .projects[1].unique[-1] == 0' "$T/stats.json"
chk "… clients: 6 curl, 1 wget, 1 other; countries add up to the runs" jq -e '.agents.curl == 6 and .agents.wget == 1 and .agents.other == 1 and ([.countries[].n] | add) == 7' "$T/stats.json"
chk "a forged session → 401" test "$(docker exec $K curl -s -o /dev/null -w '%{http_code}' -H "Cookie: st=9999999999.$(printf 'x%.0s' $(seq 43))" $B/api/stats)" = 401
chk "an expired one → 401" test "$(docker exec $K curl -s -o /dev/null -w '%{http_code}' -H "Cookie: st=1000.${COOKIE##*.}" $B/api/stats)" = 401
chk "the page: a Content-Security-Policy with no inline script; no framing" bash -c \
    "docker exec $K curl -s -D - -o /dev/null $B/ | tr -d '\r' | tee $T/h | grep -i '^content-security-policy:' | grep -q \"script-src 'self';\" && grep -qi '^x-frame-options: DENY' $T/h"

sec "the daily job: yesterday closed, Docker Hub read"
TODAY=$(jq -r .today "$T/stats.json"); YDAY=$(date -u -d "$TODAY -1 day" +%F); OLD=$(date -u -d "$TODAY -2 day" +%F)
d1 "INSERT INTO seen (day, host, h) VALUES ('$YDAY', 'snell.jinqians.com', 'a'), ('$YDAY', 'snell.jinqians.com', 'b'), ('$YDAY', 'snell.jinqians.com', 'c'), ('$YDAY', 'menu.jinqians.com', 'a')" >/dev/null
d1 "INSERT INTO salts (day, salt) VALUES ('$YDAY', 'y'), ('$OLD', 'o')" >/dev/null
d1 "INSERT INTO hits (day, host, country, agent, n) VALUES ('$YDAY', 'snell.jinqians.com', 'JP', 'curl', 4)" >/dev/null
chk "the trigger runs" bash -c "docker exec $K curl -s -o /dev/null -w '%{http_code}' '$B/__scheduled?cron=5+16+*+*+*' | grep -q 200"
sleep 6
r() { d1 "SELECT (SELECT group_concat(host || ':' || n) FROM uniques WHERE day = '$YDAY') AS closed,
               (SELECT COUNT(*) FROM seen WHERE day < '$TODAY') AS old_seen, (SELECT COUNT(*) FROM seen WHERE day = '$TODAY') AS today_seen,
               (SELECT group_concat(day) FROM salts) AS salts, (SELECT total FROM pulls WHERE day = '$TODAY' AND repo = 'jinqians/snell-server') AS pulls" | jq -c '.[0]'; }
r | sed 's/^/       /'
chk "yesterday's servers counted (snell 3, menu 1, 3 over both and over the project), their hashes and salt gone" bash -c \
    "$(declare -f d1 r); K=$K; TODAY=$TODAY; YDAY=$YDAY; r | jq -e '(.closed | split(\",\") | sort) == [\"*:3\", \"@snell.sh:3\", \"menu.jinqians.com:1\", \"snell.jinqians.com:3\"] and .old_seen == 0'"
chk "… today's untouched (snell's 4 servers and menu's 1; its salt)" bash -c "$(declare -f d1 r); K=$K; TODAY=$TODAY; YDAY=$YDAY; r | jq -e --arg t '$TODAY' '.today_seen == 5 and .salts == \$t'"
chk "Docker Hub: jinqians/snell-server's pull count read" bash -c "$(declare -f d1 r); K=$K; TODAY=$TODAY; YDAY=$YDAY; r | jq -e '.pulls > 1000'"
TOTAL=$(r | jq -r '.pulls // 0')
d1 "INSERT INTO pulls (day, repo, total) VALUES ('$YDAY', 'jinqians/snell-server', $((TOTAL - 50)))" >/dev/null
api '/api/stats?days=7' > "$T/stats2.json"
chk "the stats: yesterday's 3 snell servers (3 over all), 4 runs; its pulls (50) from the two readings" jq -e \
    '.unique["snell.jinqians.com"][-2] == 3 and .uniqueAll[-2] == 3 and .projects[0].unique[-2] == 3 and .runs["snell.jinqians.com"][-2] == 4 and .pulls[0].repo == "jinqians/snell-server" and .pulls[0].days[-2] == 50 and .pulls[0].total >= '"$TOTAL" "$T/stats2.json"
chk "… today's servers still counted live (snell 4, 4 over all)" jq -e '.unique["snell.jinqians.com"][-1] == 4 and .uniqueAll[-1] == 4' "$T/stats2.json"

sec "badges (shields.io endpoint): a project's runs as one number"
chk "snell today: 7 runs (snell 6 and menu 1, as one)" bash -c "docker exec $K curl -s '$B/badge/snell.json?period=today' | jq -e '.schemaVersion == 1 and .message == \"7\" and .label == \"今日运行\"'"
chk "… all time: 11; by the repository's name too (snell.sh)" bash -c "docker exec $K curl -s '$B/badge/snell.sh.json' | jq -e '.message == \"11\" and .label == \"累计运行\"'"
chk "… a label of one's own; proxy-stack: 0" bash -c \
    "docker exec $K curl -s '$B/badge/snell.json?label=installs' | jq -e '.label == \"installs\"' && docker exec $K curl -s '$B/badge/proxy-stack.json' | jq -e '.message == \"0\"'"
chk "no badge for one script, nor for servers: those stay on the stats page" bash -c \
    "for b in menu snell.jinqians.com nope; do [[ \$(docker exec $K curl -s -o /dev/null -w '%{http_code}' $B/badge/\$b.json) == 404 ]] || exit 1; done; docker exec $K curl -s '$B/badge/snell.json?period=today&kind=unique' | jq -e '.message == \"7\"'"

sec "the page, in a browser (Playwright)"
docker run -d --name "$U" --network "container:$K" -v "$N/tests:/tests:ro" -v "$T:/out" -w /ui node:22 sleep infinity >/dev/null
chk "Playwright + Chromium" docker exec "$U" sh -c 'npm init -y >/dev/null && npm install --no-audit --no-fund playwright >/dev/null 2>&1 && npx playwright install --with-deps chromium >/dev/null 2>&1'
# localhost: the session cookie is Secure, which a browser keeps over http only there
docker exec "$U" sh -c "cp /tests/ui.mjs /ui/ && node /ui/ui.mjs http://localhost:8787 /out $ADMIN" > "$T/ui.out" 2>&1; ui=$?
sed 's/^/  /' "$T/ui.out"
(( ui == 0 )) && ok "the page" || bad "the page"
pass=$((pass + $(grep -c '^ok ' "$T/ui.out"))); fail=$((fail + $(grep -c '^FAIL ' "$T/ui.out")))

sec "no password set; a script of another project, named"
# TARGETS as a secret would give it: a JSON string, one script in the { url, project } form
cat > "$T/dev.vars" <<'EOF'
ADMIN_PASSWORD=short
TARGETS='{"snell.jinqians.com":"https://raw.githubusercontent.com/jinqians/snell.sh/main/snell.sh","x.example.net":{"url":"https://example.com/x.sh","project":"demo"}}'
EOF
docker cp "$T/dev.vars" "$K":/app/.dev.vars
docker exec "$K" sh -c 'pkill -f "wrangler dev"; pkill -f workerd; true'; sleep 2
docker exec -d "$K" sh -c 'npx wrangler dev -c wrangler.dev.json --ip 0.0.0.0 --port 8787 --test-scheduled >> /tmp/wrangler.log 2>&1'
chk "it answers again" wait_for 120 bash -c "[[ \$(docker exec $K curl -s -o /dev/null -w '%{http_code}' $B/) == 200 ]]"
chk "a password under 8 characters: the stats say to set one (503), no sign-in" bash -c \
    "[[ \$(docker exec $K curl -s -o /dev/null -w '%{http_code}' $B/api/stats) == 503 && \$(docker exec $K curl -s -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -d '{\"password\":\"short\"}' $B/api/login) == 503 ]]"
chk "… the scripts are still served and counted" bash -c "[[ \$(docker exec $K curl -s -o /dev/null -w '%{http_code}' -H 'Host: snell.jinqians.com' -A curl/8 $B/) == 302 ]]"
chk "x.example.net → 302 to its URL, and counted in its project (demo)" bash -c \
    "[[ \$(docker exec $K curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -H 'Host: x.example.net' -A curl/8 $B/) == '302 https://example.com/x.sh' ]] && sleep 2 && docker exec $K curl -s '$B/badge/demo.json?period=today' | jq -e '.message == \"1\"'"
chk "… snell.sh is snell alone now: 6 + the one just now; menu.jinqians.com, out of TARGETS, is the stats page" bash -c "docker exec $K curl -s '$B/badge/snell.json?period=today' | jq -e '.message == \"7\"' && [[ \$(docker exec $K curl -s -o /dev/null -w '%{http_code}' -H 'Host: menu.jinqians.com' -A curl/8 $B/) == 200 ]]"

echo
echo "=== RESULT: $pass ok, $fail failed"
(( fail == 0 ))
