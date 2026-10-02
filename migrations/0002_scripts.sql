-- What is counted is set on the stats page, not in wrangler.jsonc: the
-- scripts, the Docker Hub repositories and the time zone a day is counted in.
--
-- A script has a name and the URL it is served from. It is reached at
-- https://<the stats page's host>/<name>, and on each of its hostnames that a
-- Worker route sends here; either way its runs are counted under its name.
-- Its project is the one named, or else the GitHub repository it is served
-- from. hosts: space separated.
CREATE TABLE scripts (
    name    TEXT PRIMARY KEY,
    url     TEXT NOT NULL,
    project TEXT NOT NULL DEFAULT '',
    hosts   TEXT NOT NULL DEFAULT '',
    pos     INTEGER NOT NULL DEFAULT 0
);

-- timezone (an IANA name), docker_repos ("owner/name", space separated)
CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- the counts are by script now (they were by hostname)
ALTER TABLE hits RENAME COLUMN host TO script;
ALTER TABLE seen RENAME COLUMN host TO script;
ALTER TABLE uniques RENAME COLUMN host TO script;
