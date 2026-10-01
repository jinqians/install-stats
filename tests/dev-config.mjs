// wrangler.jsonc without its routes, as wrangler.dev.json, for the tests:
// with routes, `wrangler dev` rewrites every request's URL and Host header to
// the first route's host, and every script would look like install.jinqians.com.
// On Cloudflare a request keeps its own host. Usage (in the project): node tests/dev-config.mjs
import { readFileSync, writeFileSync } from 'node:fs'

// wrangler.jsonc's comments are whole lines
const src = readFileSync('wrangler.jsonc', 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')
const config = JSON.parse(src)
delete config.routes
delete config.$schema
writeFileSync('wrangler.dev.json', JSON.stringify(config, null, 2))
