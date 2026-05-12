# Stats pipeline

This folder regenerates `docs/stats.json` — the single file every chart and
card on the live site renders from — from a Google Forms response CSV.

```
analysis/
├── analyze.py     One script. Reads the published CSV, applies five
│                  filter rules, writes docs/stats.json.
└── README.md      You are here. Spec, filter rules, schema and the
                   recipe for next year's rebuild.
```

The pipeline is intentionally a single file. There are no dependencies
beyond the Python standard library, and the input and output both live in
`docs/` so anyone with the repo can reproduce every number on the site.

> [!IMPORTANT]
> If you ask an AI agent to refresh the stats from a newer CSV, point it at
> this file. It is the exact specification for what filtering and aggregation
> the site expects.

---

## 1. The one-command rebuild

After dropping a new Google Forms export at
`docs/Samsung-Z-Fold-Questionnaire-2026.csv` (overwriting the existing one):

```bash
python3 analysis/analyze.py
```

That single command:

- reads the CSV at `docs/Samsung-Z-Fold-Questionnaire-2026.csv`
- applies all five filter rules in section 3
- writes `docs/stats.json`
- prints raw / cleaned / per-device counts so you can sanity-check

Everything that is **rendered dynamically** by `docs/app.js` — every per-gen
card, every chart, every percentage, every sample size, the causal-chain
multipliers, the methodology "Excluded" count — will pick up the new
numbers automatically on the next page load.

Numbers that are **hardcoded** in `docs/index.html` need a manual update —
see section 6.

---

## 2. The input CSV — expected schema

`analyze.py` reads columns by index, not by header name, so the column
order matters. Expected layout (15 columns, in this order):

| # | Column | Allowed values |
| - | ------ | -------------- |
| 0 | Zeitstempel | timestamp |
| 1 | Which device do you own? | `Z Fold 1` … `Z Fold 7`, `Z Fold SE`, `Z TriFold`, `I don't own any of them` |
| 2 | In what condition did you receive your device? | `Factory new` &middot; `Used` &middot; `Refurbished` &middot; `Damaged/broken` |
| 3 | How long have you owned the device for? | `0–6 months` &middot; `7–12 months` &middot; `13–18 months` &middot; `19–24 months` &middot; `Over 24 months` &middot; `25–36 months (2–3 years)` &middot; `37–48 months (3–4 years)` &middot; `49-60 months (4–5 years)` |
| 4 | Have you had to RMA your device? | `No` &middot; `Yes, 1x` &middot; `Yes, 2x` &middot; `Yes, 3x` &middot; `Yes, more than 3x` |
| 5 | Does your foldable screen open all the way? | `Yes` &middot; `No, 1–20° …` &middot; `No, 21–45° …` &middot; `No, more than 45° …` |
| 6 | Did your **outer (small)** screen break with no fault of your own? | `No` &middot; `Yes, but at fault of my own` &middot; `Yes, after …` |
| 7 | Did your **inner (large)** screen break with no fault of your own? | same shape as the outer-break column |
| 8 | What kind of screen protector do you use for your **outer** screen? | `3rd party` &middot; `None` &middot; `Default factory one that is pre-applied` &middot; `A purchased Samsung Official Screen Protector` |
| 9 | What kind of screen protector do you use for your **inner** screen? | `Default factory one that is pre-applied` &middot; `None` &middot; `3rd party` &middot; `Samsung official replacement (e. g. at a Service Centre)` |
| 10 | Did your inner default screen protector peel or bubble up? | `No` &middot; `Yes, after …` |
| 11 | Are you seeing micro cracks on the inner screen? | `No` &middot; `Yes, since …` |
| 12 | How is the surface of the inner screen holding up? | `Completely fine` &middot; `Small scratches, only visible under a certain light` &middot; `Small scratches, always visible` &middot; `Larger scratches, always visible` |
| 13 | What is your screen usage? | integer `1` – `10` (1 = mostly inner, 10 = mostly outer) |
| 14 | How often do you fold your device in a day? | `0–5 times` &middot; `6–10 times` &middot; `11–15 times` &middot; `16–20 times` &middot; `More than 20 times a day` |

If Google Forms introduces new answer options (a new device, a new
age bucket, etc.) you'll need to update a handful of constants in
`analyze.py` — see section 4.

---

## 3. The five filter rules

A row is **included** in the cleaned dataset only if **none** of these
reasons apply. A row can fail multiple checks; `analyze.py` records every
failure separately, so the sum of exclusion-reason counts can exceed
`raw_n − cleaned_n`. The website's "Excluded" count is simply
`raw_n − cleaned_n`.

### Rule 1 — Factory new only

Exclude any row where column [2] is not exactly `Factory new`.

> Used, refurbished or damaged devices have unknown history and unknown
> true age. Their durability and ownership-duration self-report can't be
> trusted.

### Rule 2 — Outer-protector sanity check

Exclude any row where column [8] equals
`Default factory one that is pre-applied`.

> The Z Fold has never shipped with a pre-applied **outer** screen
> protector. Anyone selecting that option misread the question — treat
> their entire row as unreliable.

### Rule 3 — Outer-screen self-break

Exclude any row where column [6] starts with `Yes,` **and** does not
contain `fault of my own`.

> "My outer screen broke with no fault of my own" almost always reflects
> a drop the respondent didn't admit to. Drops at user fault are kept
> (they're factually neutral for durability).

### Rule 4 — Niche devices

Exclude any row where column [1] is one of `I don't own any of them`,
blank, `Z TriFold`, or `Z Fold SE`.

> Sample sizes for the niche devices are < 10 — too small for
> per-generation claims. Monitor them year over year; promote to
> first-class generations once their sample is meaningful.

### Rule 5 — Device-age sanity caps

Exclude any row where the reported ownership duration exceeds the
maximum physically possible duration given the device's launch date and
the study's cutoff. As of the 2026 study (cutoff ≈ May 2026):

| Generation | Launched | Cap |
| ---------- | -------- | --- |
| Z Fold 7 | Jul 2025 | `7–12 months` |
| Z Fold 6 | Jul 2024 | `19–24 months` |
| Z Fold 5 | Jul 2023 | `25–36 months (2–3 years)` |
| Z Fold 4 | Aug 2022 | `37–48 months (3–4 years)` |
| Z Fold 3 | Sep 2021 | `49-60 months (4–5 years)` |
| Z Fold 2 | Sep 2020 | no cap |
| Z Fold 1 | Sep 2019 | no cap |

> This rule catches respondents who didn't read carefully or who picked
> the wrong device. In the 2026 dataset only one row was caught — but the
> rule is critical for the newest generation each year: a Fold 7 owner
> reporting "Over 24 months" is impossible by construction.

---

## 4. Updating for a future study (2027 and beyond)

Each new study year you must adjust three things:

### 4a. `analyze.py` — `ALLOWED_AGES`

Add the new generation (e.g. `Z Fold 8` released the prior July gets
`{"0–6 months", "7–12 months"}`) and **bump every existing generation's
cap forward** by roughly 12 months.

**Quick rule:** the cap is the largest age bucket that fits inside
`study_cutoff − launch_date`. When in doubt, round generously — false
exclusions hurt more than false inclusions, since rule 5 only catches
gross misentries.

### 4b. `analyze.py` — `DEVICE_ORDER`

Append the new generation in chronological order. This list controls
the order of per-generation cards and the legend in every chart.

### 4c. `docs/app.js` — `COHORT_POSSIBLE`

This map controls when the year-by-year deep dive shows `×` (impossible
cohort) vs `n<5` (possible but too few responses). Apply the same logic
as the age caps:

| Time since launch | Cohorts |
| ----------------- | ------- |
| < 12 months | `["Year 1"]` |
| 12 – 24 months | `["Year 1", "Year 2"]` |
| 24+ months | `["Year 1", "Year 2", "Beyond Year 2"]` |

### 4d. If Forms adds new age buckets

Add them to **all four** of these constants in `analyze.py`:

- `ALLOWED_AGES` (per-device caps)
- `AGE_ORDER` (display order)
- `AGE_LABEL_SHORT` (short labels for the surface-degradation chart)
- `AGE_GROUP` (which cohort each bucket belongs to: Year 1 / Year 2 / Beyond Year 2)

---

## 5. Output schema — `docs/stats.json`

Top-level keys consumed by the website:

| Key | What it contains |
| --- | ---------------- |
| `meta` | `study_year`, `raw_n`, `cleaned_n`, `exclusions {reason: count}`, `device_order`, `age_order`, `age_label_short` |
| `distributions` | Raw value counts for `device`, `age`, `outer_sp`, `inner_sp`, `rma`, `flat`, `peeling`, `cracks`, `surface`, `usage`, `fold_freq` |
| `headline` | `screen_opens_fully_pct`, `inner_screen_break_pct`, `default_protector_peeled_pct`, `micro_cracks_pct`, `rma_any_pct` |
| `per_device` | For each `Z Fold N`: `n`, `rma_pct`, `not_flat_pct`, `inner_break_pct`, `default_protector_peeled_pct`, `micro_cracks_pct`, `screen_usage_avg`, `folds_per_day_avg` |
| `cohort_stats` | For each `Z Fold N` × `Year 1` / `Year 2` / `Beyond Year 2`: `n` plus the same five percent fields as `per_device` (cohorts with `n < 5` only include `n`) |
| `sp_impact` | Per inner-screen-protector type: `n`, `rma_pct`, `inner_break_pct`, `micro_cracks_pct` |
| `peel_outcomes` | RMA / cracks / break rates split by whether the default protector peeled, plus the n on each side |
| `fold_habit` | Per folds-per-day bucket: `n`, `rma_pct`, `micro_cracks_pct`, `inner_break_pct` |
| `usage_durability` | Per inner-vs-outer usage group: same shape as `fold_habit` |
| `surface_by_age` | Per age bucket: `n` plus the share for each surface-condition label |
| `flat_vs_cracks` &middot; `cracks_vs_break` &middot; `break_timing_pct` | Computed but **not currently consumed by `docs/app.js`** — kept in the JSON for transparency and possible future charts |

Adding a new field doesn't break the site. Removing one breaks the chart
that consumes it — grep for the key in `docs/app.js` to confirm what
depends on it before deleting.

---

## 6. Hardcoded copy in `docs/index.html`

About 90 % of what the site shows is dynamically rendered from
`stats.json`. The remaining ~10 % is narrative copy that lives directly
in `index.html` and **must be updated by hand** each study year.

### Hero section

- The four big stats: `745 raw responses` / `527 cleaned dataset` /
  `7 Fold generations` / `3rd annual study` (search for `data-counter
  data-target=`)
- The lede paragraph: *"An independent reliability survey of 745
  Samsung Galaxy Z Fold owners…"*

### TL;DR cards

- Fold 7 headline numbers (`3.33%` RMA, `1.67%` break, etc.)
- Flatness regression numbers (`25%`, `20.3%`, `0.5%`)
- Fold 4 numbers (`47%` RMA, `80%` peeling)
- Causal-chain multipliers (`8.8×`, `7.9×`)

### Headline section

- Both callouts ("What improved" / "What got worse") — re-read against
  the new numbers and rewrite bullets as needed

### Methodology card — "Sample sizes"

- `Raw responses` — hardcoded `<strong>745</strong>`
- `Cleaned dataset` — hardcoded `<strong>527</strong>`
- `Excluded` — **dynamically rendered** by `app.js` into
  `<strong id="meth-excluded">`, so this one auto-updates. The initial
  value in the HTML is the pre-JS fallback

### Prior-studies callout

- Update the row reading `2026 (this study, n = … → … cleaned)` each year
- When this becomes a prior study, copy the cleaned-n into a new callout
  and add the new year's row

### Conclusion

- The narrative claims (Fold 7 best ever, Fold 4 still the lemon, age
  dominates everything…) — re-read against the new numbers and rewrite

### `docs/og-image.svg`

- The three hero stat tiles (`3.3%`, `0%`, `25%`) are baked into the SVG

---

## 7. Manual filter logic (without `analyze.py`)

If you (or another AI agent) need to reproduce just the headline numbers
without running `analyze.py`, here is the exact filter logic:

```python
for row in csv_rows:
    device      = row[1]   # "Which device do you own?"
    condition   = row[2]   # "In what condition did you receive your device?"
    age         = row[3]   # "How long have you owned the device for?"
    outer_break = row[6]   # outer-screen break
    outer_sp    = row[8]   # outer screen protector

    if device in {"I don't own any of them", "", "Z TriFold", "Z Fold SE"}:
        EXCLUDE("non_main_device"); continue
    if condition != "Factory new":
        EXCLUDE("not_factory_new"); continue
    if outer_sp == "Default factory one that is pre-applied":
        EXCLUDE("impossible_outer_protector"); continue
    if outer_break.startswith("Yes,") and "fault of my own" not in outer_break:
        EXCLUDE("outer_break_likely_misread"); continue
    if device in ALLOWED_AGES and ALLOWED_AGES[device] is not None \
            and age not in ALLOWED_AGES[device]:
        EXCLUDE("device_age_impossible"); continue
    ACCEPT(row)
```

A row needs to pass **all** checks to be accepted. The downstream
predicates used to compute percentages on the cleaned dataset:

```python
is_rma(row)            = row[4].startswith("Yes,")
is_not_flat(row)       = row[5].startswith("No,")
is_break_genuine(row)  = row[7].startswith("Yes,") and "fault of my own" not in row[7]
is_peeling(row)        = row[10].startswith("Yes,")
has_cracks(row)        = row[11].startswith("Yes,")
```

---

## 8. Sanity checks after a rebuild

Before pushing:

- [ ] `python3 analysis/analyze.py` exits cleanly and prints the expected
      raw / cleaned / per-device counts
- [ ] `docs/stats.json` is roughly 12 – 20 KB (not a few hundred bytes,
      which would mean the script errored silently)
- [ ] Local preview works: `python3 -m http.server 8000 --directory docs`
- [ ] Every metric in the year-by-year selector still renders bars
      and/or `×` / `n<5` markers — no blank chart on any metric
- [ ] The methodology "Excluded" count matches the sum of exclusion
      reasons the script printed
- [ ] Hovering a 0 % bar still shows a tooltip with the sample size
- [ ] On mobile width the hero phone stack still shows generations
      3 / 4 / 5 / 6 / 7

If a fresh generation was added this year, also confirm:

- [ ] The new generation appears in the per-generation snapshot section
- [ ] The cyan **NEWEST** badge moved to it (search
      `renderGenerationCards` in `docs/app.js`)
- [ ] `COHORT_POSSIBLE` in `docs/app.js` includes the new generation
- [ ] The hero phone stack updates to include the new generation
- [ ] The age-cap warn callout above the per-gen grid still reads
      correctly with the new caps

---

_For the live report itself, see [`docs/index.html`](../docs/index.html) and the deployed site at <https://macusercom.github.io/z-fold-longevity-study/>._
