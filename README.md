# Z Fold Longevity Study — 2026

A community-sourced reliability study of every Samsung Galaxy Z Fold generation, from the original Fold through the Fold 7, published as a static site on GitHub Pages.

**Live site:** https://macusercom.github.io/z-fold-longevity-study/

This is the third annual edition of the study (2024 / 2025 / 2026). The 2026 dataset has **745 raw responses** from 745 owners. After applying the agreed filtering rules, **527 responses** are used for the per-generation analysis.

## What's in the report

- Headline TL;DR comparing the Fold 7 against every prior generation in their first year of ownership only (apples-to-apples)
- Per-generation snapshot cards (RMA, inner-screen breaks, default-protector peeling, micro cracks, hinge flatness, folds-per-day, screen-usage)
- Interactive year-by-year breakdown across Year 1, Year 2 and Beyond Year 2
- The "peeling → cracks → break" causal chain, with risk multipliers
- Inner-screen-protector impact comparison
- Myth-busting charts on folds-per-day and inner-vs-outer screen usage
- Stacked surface-degradation breakdown by ownership duration
- Methodology, exclusion rules and limitations

## Filtering rules

The cleaned dataset excludes responses where any of the following apply:

1. **Not factory new** — used or refurbished devices have unknown history.
2. **Outer protector sanity check** — the Fold doesn't ship with a pre-applied outer protector, so anyone selecting that option is treated as a misread.
3. **Outer-screen self-break** — outer breaks "with no fault of my own" are nearly always drops; excluded to reduce noise.
4. **Device-age sanity caps** — calibrated to each generation's launch date as of May 2026:
   - Fold 7 (Jul 2025): max 7–12 mo
   - Fold 6 (Jul 2024): max 19–24 mo
   - Fold 5 (Jul 2023): max 25–36 mo
5. **"I don't own any of them"** plus the very small **Z TriFold** and **Z Fold SE** samples (sample sizes < 10) are excluded.

## Running locally

The site is fully static. Any HTTP server in the `docs/` directory works:

```bash
python3 -m http.server 8000 --directory docs
# then open http://localhost:8000
```

Opening `index.html` directly with `file://` won't work because the page fetches `stats.json` at runtime.

## Regenerating the stats

`docs/stats.json` is the aggregated data the page renders from. It is generated locally from the raw response CSV by an analysis script that applies the filters above and computes every per-generation, per-cohort and per-protector breakdown.

The raw CSV that drives the analysis is published alongside the site at [`docs/Samsung-Z-Fold-Questionnaire-2026.csv`](docs/Samsung-Z-Fold-Questionnaire-2026.csv) for transparency. The analysis script itself is kept locally and not committed to this repository.

## Source layout

```
docs/                                       Static site (GitHub Pages root)
  index.html                                Main report
  style.css                                 Theme (dark / neon)
  app.js                                    Chart.js wiring and dynamic content
  stats.json                                Aggregated study data (generated)
  Samsung-Z-Fold-Questionnaire-2026.csv     Raw response CSV (downloadable)
  privacy.html                              Privacy policy
  imprint.html                              Legal notice
  og-image.svg                              Social card
  sitemap.xml / robots.txt                  SEO
```

## Prior studies

- [2024 results on r/GalaxyFold](https://www.reddit.com/r/GalaxyFold/comments/1c7vflv/results_study_about_the_z_fold_series/)
- [2025 results on r/GalaxyFold](https://www.reddit.com/r/GalaxyFold/comments/1jrzlyb/results_study_about_the_z_fold_series_2025_edition/)

## License

MIT. See `LICENSE`.

This project is independent and not affiliated with, endorsed by, or sponsored by Samsung Electronics Co., Ltd.
