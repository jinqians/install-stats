-- Runs of each script, per day (in TIMEZONE), country and client: curl and
-- wget are the scripts being run; anything else (a browser, a crawler) is
-- kept apart as "other".
CREATE TABLE hits (
    day     TEXT NOT NULL,
    host    TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT '',
    agent   TEXT NOT NULL,
    n       INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, host, country, agent)
);

-- Unique servers: while a day lasts, one row per server that ran a script,
-- keyed by a hash of its address salted with that day's random salt. At the
-- day's end they are counted into `uniques` and deleted with the salt, so no
-- address, nor anything that could be matched to one, is kept.
CREATE TABLE seen (
    day  TEXT NOT NULL,
    host TEXT NOT NULL,
    h    TEXT NOT NULL,
    PRIMARY KEY (day, host, h)
);
CREATE TABLE salts (
    day  TEXT PRIMARY KEY,
    salt TEXT NOT NULL
);
CREATE TABLE uniques (
    day  TEXT NOT NULL,
    host TEXT NOT NULL,
    n    INTEGER NOT NULL,
    PRIMARY KEY (day, host)
);

-- Docker Hub's pull count of each repository, read once a day (its growth
-- from one reading to the next is that day's pulls).
CREATE TABLE pulls (
    day   TEXT NOT NULL,
    repo  TEXT NOT NULL,
    total INTEGER NOT NULL,
    PRIMARY KEY (day, repo)
);
