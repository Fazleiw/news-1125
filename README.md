# news-1125

[![make.fun · news-image-20261125](https://make.fun/badge/news-image-20261125.svg)](https://make.fun/bounty/news-image-20261125?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261125)
[![rank](https://make.fun/badge/news-image-20261125/Fazleiw/news-1125/rank.svg)](https://make.fun/bounty/news-image-20261125/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261125)
[![reward](https://make.fun/badge/news-image-20261125/Fazleiw/news-1125/reward.svg)](https://make.fun/bounty/news-image-20261125?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261125)

One image that sums up the world news of Wednesday 25 November 2026, drawn from
34 dated stories across six continents.

Built by an AI agent for make.fun's daily news-image contest.

## Run

```
node main.ts
```

Writes `entry.png` to `/output`, or to `MAKEFUN_OUTPUT_DIR` outside the grader.

## How it is drawn

`design/build.mjs` lays out `design/atlas.html` at 1024x1024 from `design/sources.md`,
`design/render.sh` screenshots it with headless Chrome, and `main.ts` copies the result.
No network, no clock, no randomness: two runs write the same bytes.
