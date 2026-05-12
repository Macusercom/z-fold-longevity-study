"""
Z Fold Longevity Study — aggregation pipeline.

Reads the published raw response CSV from docs/, applies the five agreed
filter rules, computes every per-generation / per-cohort / per-protector
statistic the website renders, and writes docs/stats.json.

Run from anywhere:

    python3 analysis/analyze.py

See analysis/README.md for the full reproduction guide.
"""
import csv
import json
from collections import Counter
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = REPO_ROOT / "docs" / "Samsung-Z-Fold-Questionnaire-2026.csv"
OUT_PATH = REPO_ROOT / "docs" / "stats.json"

# --------------------------------------------------------------------------- #
#  Filter rule 5: device-age sanity caps.
#  Update these each study year so that they reflect the maximum age a given
#  generation can physically have on the study cutoff date.
#  Cutoff for the 2026 study: ~May 2026.
# --------------------------------------------------------------------------- #
ALLOWED_AGES = {
    "Z Fold 7": {"0–6 months", "7–12 months"},
    "Z Fold 6": {"0–6 months", "7–12 months", "13–18 months", "19–24 months"},
    "Z Fold 5": {"0–6 months", "7–12 months", "13–18 months", "19–24 months", "Over 24 months", "25–36 months (2–3 years)"},
    "Z Fold 4": {"0–6 months", "7–12 months", "13–18 months", "19–24 months", "Over 24 months", "25–36 months (2–3 years)", "37–48 months (3–4 years)"},
    "Z Fold 3": {"0–6 months", "7–12 months", "13–18 months", "19–24 months", "Over 24 months", "25–36 months (2–3 years)", "37–48 months (3–4 years)", "49-60 months (4–5 years)"},
    "Z Fold 2": None,  # no cap
    "Z Fold 1": None,  # no cap
}
DEVICE_ORDER = ["Z Fold 1", "Z Fold 2", "Z Fold 3", "Z Fold 4", "Z Fold 5", "Z Fold 6", "Z Fold 7"]

AGE_ORDER = [
    "0–6 months", "7–12 months", "13–18 months", "19–24 months",
    "Over 24 months", "25–36 months (2–3 years)",
    "37–48 months (3–4 years)", "49-60 months (4–5 years)",
]
AGE_LABEL_SHORT = {
    "0–6 months": "0–6 mo",
    "7–12 months": "7–12 mo",
    "13–18 months": "13–18 mo",
    "19–24 months": "19–24 mo",
    "Over 24 months": "24+ mo",
    "25–36 months (2–3 years)": "2–3 yr",
    "37–48 months (3–4 years)": "3–4 yr",
    "49-60 months (4–5 years)": "4–5 yr",
}

# Year cohort grouping for the year-by-year deep-dive chart.
AGE_GROUP = {
    "0–6 months": "Year 1",
    "7–12 months": "Year 1",
    "13–18 months": "Year 2",
    "19–24 months": "Year 2",
    "Over 24 months": "Beyond Year 2",
    "25–36 months (2–3 years)": "Beyond Year 2",
    "37–48 months (3–4 years)": "Beyond Year 2",
    "49-60 months (4–5 years)": "Beyond Year 2",
}


def load_rows():
    if not CSV_PATH.exists():
        raise FileNotFoundError(
            f"Raw response CSV not found at {CSV_PATH}.\n"
            "Place the latest Google Forms export there before running. "
            "See analysis/README.md for the expected schema."
        )
    with CSV_PATH.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def make_filter_pass(row, columns):
    """Apply the 5 filter rules. Returns a list of exclusion reasons
    (empty list = row is included)."""
    _ts, device_col, cond_col, age_col, _, _, outer_break_col, _, outer_sp_col, *_ = columns
    device = row[device_col].strip()
    cond = row[cond_col].strip()
    age = row[age_col].strip()
    outer_sp = row[outer_sp_col].strip()
    outer_break = row[outer_break_col].strip()
    reasons = []
    # Filter 4 — niche devices and blank rows
    if device in {"I don't own any of them", "", "Z TriFold", "Z Fold SE"}:
        reasons.append("non_main_device")
    # Filter 1 — factory new only
    if cond != "Factory new":
        reasons.append("not_factory_new")
    # Filter 2 — outer protector sanity check
    if outer_sp == "Default factory one that is pre-applied":
        reasons.append("impossible_outer_protector")
    # Filter 3 — outer-screen self-break excluded
    if outer_break.startswith("Yes,") and "fault of my own" not in outer_break:
        reasons.append("outer_break_likely_misread")
    # Filter 5 — device-age sanity cap
    if device in ALLOWED_AGES and ALLOWED_AGES[device] is not None:
        if age and age not in ALLOWED_AGES[device]:
            reasons.append("device_age_impossible")
    return reasons


def pct(num, denom):
    return round(100 * num / denom, 2) if denom else 0.0


def safe_int(s):
    try:
        return int(s)
    except Exception:
        return None


def main():
    rows = load_rows()
    columns = list(rows[0].keys())
    (_, device_col, cond_col, age_col, rma_col, flat_col,
     _outer_break_col, inner_break_col, _outer_sp_col, inner_sp_col,
     peel_col, crack_col, surface_col, usage_col, fold_freq_col) = columns

    # First pass: raw totals + filter exclusion reasons
    raw_n = len(rows)
    exclusion_counter = Counter()
    cleaned = []
    for r in rows:
        reasons = make_filter_pass(r, columns)
        if reasons:
            for reason in reasons:
                exclusion_counter[reason] += 1
            continue
        cleaned.append(r)
    cleaned_n = len(cleaned)

    # ---- Headline distributions on cleaned ----
    device_count = Counter(r[device_col] for r in cleaned)
    age_count = Counter(r[age_col] for r in cleaned)
    rma_count = Counter(r[rma_col] for r in cleaned)
    flat_count = Counter(r[flat_col] for r in cleaned)
    inner_sp_count = Counter(r[inner_sp_col] for r in cleaned)
    peel_count = Counter(r[peel_col] for r in cleaned)
    crack_count = Counter(r[crack_col] for r in cleaned)
    surface_count = Counter(r[surface_col] for r in cleaned)
    usage_count = Counter(r[usage_col] for r in cleaned)
    fold_freq_count = Counter(r[fold_freq_col] for r in cleaned)
    outer_sp_count = Counter(r[_outer_sp_col] for r in cleaned)

    def is_break_genuine(row):
        v = row[inner_break_col].strip()
        return v.startswith("Yes,") and "fault of my own" not in v

    def is_rma(row):
        return row[rma_col].strip().startswith("Yes,")

    def is_not_flat(row):
        return row[flat_col].strip().startswith("No,")

    def is_peeling(row):
        return row[peel_col].strip().startswith("Yes,")

    def has_cracks(row):
        return row[crack_col].strip().startswith("Yes,")

    headline = {
        "screen_opens_fully_pct": pct(sum(1 for r in cleaned if r[flat_col].strip() == "Yes"), cleaned_n),
        "inner_screen_break_pct": pct(sum(1 for r in cleaned if is_break_genuine(r)), cleaned_n),
        "default_protector_peeled_pct": pct(sum(1 for r in cleaned if is_peeling(r)), cleaned_n),
        "micro_cracks_pct": pct(sum(1 for r in cleaned if has_cracks(r)), cleaned_n),
        "rma_any_pct": pct(sum(1 for r in cleaned if is_rma(r)), cleaned_n),
    }

    # ---- Per-device durability summary ----
    FOLD_BUCKET_MID = {
        "0–5 times": 2.5, "6–10 times": 8, "11–15 times": 13,
        "16–20 times": 18, "More than 20 times a day": 22,
    }
    per_device = {}
    for dev in DEVICE_ORDER:
        subset = [r for r in cleaned if r[device_col] == dev]
        n = len(subset)
        if n == 0:
            per_device[dev] = {"n": 0}
            continue
        rma_n = sum(1 for r in subset if is_rma(r))
        not_flat_n = sum(1 for r in subset if is_not_flat(r))
        break_n = sum(1 for r in subset if is_break_genuine(r))
        peel_n = sum(1 for r in subset if is_peeling(r))
        crack_n = sum(1 for r in subset if has_cracks(r))
        usage_vals = [safe_int(r[usage_col]) for r in subset]
        usage_vals = [v for v in usage_vals if v is not None]
        usage_avg = round(sum(usage_vals) / len(usage_vals), 2) if usage_vals else None
        fold_vals = [FOLD_BUCKET_MID[r[fold_freq_col].strip()]
                     for r in subset if r[fold_freq_col].strip() in FOLD_BUCKET_MID]
        fold_avg = round(sum(fold_vals) / len(fold_vals), 1) if fold_vals else None
        per_device[dev] = {
            "n": n,
            "rma_pct": pct(rma_n, n),
            "not_flat_pct": pct(not_flat_n, n),
            "inner_break_pct": pct(break_n, n),
            "default_protector_peeled_pct": pct(peel_n, n),
            "micro_cracks_pct": pct(crack_n, n),
            "screen_usage_avg": usage_avg,
            "folds_per_day_avg": fold_avg,
        }

    # ---- Per-device × time cohort (Year 1 / Year 2 / Beyond Year 2) ----
    cohort_stats = {}
    for dev in DEVICE_ORDER:
        cohort_stats[dev] = {}
        for cohort in ["Year 1", "Year 2", "Beyond Year 2"]:
            subset = [r for r in cleaned
                      if r[device_col] == dev and AGE_GROUP.get(r[age_col].strip()) == cohort]
            n = len(subset)
            if n < 5:
                cohort_stats[dev][cohort] = {"n": n}
                continue
            cohort_stats[dev][cohort] = {
                "n": n,
                "rma_pct": pct(sum(1 for r in subset if is_rma(r)), n),
                "not_flat_pct": pct(sum(1 for r in subset if is_not_flat(r)), n),
                "inner_break_pct": pct(sum(1 for r in subset if is_break_genuine(r)), n),
                "default_protector_peeled_pct": pct(sum(1 for r in subset if is_peeling(r)), n),
                "micro_cracks_pct": pct(sum(1 for r in subset if has_cracks(r)), n),
            }

    # ---- Inner SP impact ----
    sp_groups = {
        "Default factory (pre-applied)": "Default factory one that is pre-applied",
        "None": "None",
        "3rd party": "3rd party",
        "Samsung official replacement": "Samsung official replacement (e. g. at a Service Centre)",
    }
    sp_impact = {}
    for label, raw in sp_groups.items():
        subset = [r for r in cleaned if r[inner_sp_col] == raw]
        n = len(subset)
        if n == 0:
            sp_impact[label] = {"n": 0}
            continue
        sp_impact[label] = {
            "n": n,
            "rma_pct": pct(sum(1 for r in subset if is_rma(r)), n),
            "inner_break_pct": pct(sum(1 for r in subset if is_break_genuine(r)), n),
            "micro_cracks_pct": pct(sum(1 for r in subset if has_cracks(r)), n),
        }

    # ---- Peeling → cracks/RMA risk multiplier ----
    default_subset = [r for r in cleaned if r[inner_sp_col] == "Default factory one that is pre-applied"]
    peeling_subset = [r for r in default_subset if is_peeling(r)]
    no_peel_subset = [r for r in default_subset if r[peel_col].strip() == "No"]
    peel_outcomes = {
        "rma_when_peeling": pct(sum(1 for r in peeling_subset if is_rma(r)), len(peeling_subset)),
        "rma_when_no_peeling": pct(sum(1 for r in no_peel_subset if is_rma(r)), len(no_peel_subset)),
        "cracks_when_peeling": pct(sum(1 for r in peeling_subset if has_cracks(r)), len(peeling_subset)),
        "cracks_when_no_peeling": pct(sum(1 for r in no_peel_subset if has_cracks(r)), len(no_peel_subset)),
        "break_when_peeling": pct(sum(1 for r in peeling_subset if is_break_genuine(r)), len(peeling_subset)),
        "break_when_no_peeling": pct(sum(1 for r in no_peel_subset if is_break_genuine(r)), len(no_peel_subset)),
        "n_peeling": len(peeling_subset),
        "n_no_peeling": len(no_peel_subset),
    }

    # ---- Not-fully-flat → cracks association ----
    flat_subset = [r for r in cleaned if r[flat_col].strip() == "Yes"]
    not_flat_subset = [r for r in cleaned if is_not_flat(r)]
    flat_vs_cracks = {
        "n_flat": len(flat_subset),
        "cracks_when_flat": pct(sum(1 for r in flat_subset if has_cracks(r)), len(flat_subset)),
        "n_not_flat": len(not_flat_subset),
        "cracks_when_not_flat": pct(sum(1 for r in not_flat_subset if has_cracks(r)), len(not_flat_subset)),
    }

    # ---- Cracks → break association ----
    cracks_subset = [r for r in cleaned if has_cracks(r)]
    no_cracks_subset = [r for r in cleaned if r[crack_col].strip() == "No"]
    cracks_vs_break = {
        "n_with_cracks": len(cracks_subset),
        "break_when_cracks": pct(sum(1 for r in cracks_subset if is_break_genuine(r)), len(cracks_subset)),
        "n_no_cracks": len(no_cracks_subset),
        "break_when_no_cracks": pct(sum(1 for r in no_cracks_subset if is_break_genuine(r)), len(no_cracks_subset)),
    }

    # ---- Folding habit vs durability (sanity check) ----
    FOLD_BUCKETS = ["0–5 times", "6–10 times", "11–15 times", "16–20 times", "More than 20 times a day"]
    fold_habit = {}
    for bucket in FOLD_BUCKETS:
        subset = [r for r in cleaned if r[fold_freq_col].strip() == bucket]
        n = len(subset)
        if n < 5:
            fold_habit[bucket] = {"n": n}
            continue
        fold_habit[bucket] = {
            "n": n,
            "rma_pct": pct(sum(1 for r in subset if is_rma(r)), n),
            "micro_cracks_pct": pct(sum(1 for r in subset if has_cracks(r)), n),
            "inner_break_pct": pct(sum(1 for r in subset if is_break_genuine(r)), n),
        }

    # ---- Inner-vs-outer screen usage vs durability ----
    usage_groups = {
        "Mostly inner (1–3)": lambda v: 1 <= v <= 3,
        "Balanced (4–7)": lambda v: 4 <= v <= 7,
        "Mostly outer (8–10)": lambda v: 8 <= v <= 10,
    }
    usage_durability = {}
    for label, pred in usage_groups.items():
        subset = []
        for r in cleaned:
            v = safe_int(r[usage_col])
            if v is not None and pred(v):
                subset.append(r)
        n = len(subset)
        if n < 5:
            usage_durability[label] = {"n": n}
            continue
        usage_durability[label] = {
            "n": n,
            "rma_pct": pct(sum(1 for r in subset if is_rma(r)), n),
            "micro_cracks_pct": pct(sum(1 for r in subset if has_cracks(r)), n),
            "inner_break_pct": pct(sum(1 for r in subset if is_break_genuine(r)), n),
        }

    # ---- When breaks happen (timing) ----
    break_timing = Counter()
    for r in cleaned:
        v = r[inner_break_col].strip()
        if v.startswith("Yes,"):
            break_timing[v] += 1
    break_timing_pct = {k: pct(v, cleaned_n) for k, v in break_timing.items()}
    break_timing_pct["No"] = pct(sum(1 for r in cleaned if r[inner_break_col].strip() == "No"), cleaned_n)

    # ---- Surface degradation by age bucket ----
    SURFACE_ORDER = [
        "Completely fine",
        "Small scratches, only visible under a certain light",
        "Small scratches, always visible",
        "Larger scratches, always visible",
    ]
    surface_by_age = {}
    for age in AGE_ORDER:
        subset = [r for r in cleaned if r[age_col].strip() == age]
        n = len(subset)
        if n < 5:
            continue
        surface_by_age[age] = {"n": n}
        for s in SURFACE_ORDER:
            surface_by_age[age][s] = pct(sum(1 for r in subset if r[surface_col].strip() == s), n)

    out = {
        "meta": {
            "study_year": 2026,
            "raw_n": raw_n,
            "cleaned_n": cleaned_n,
            "exclusions": dict(exclusion_counter),
            "device_order": DEVICE_ORDER,
            "age_order": AGE_ORDER,
            "age_label_short": AGE_LABEL_SHORT,
        },
        "distributions": {
            "device": dict(device_count),
            "age": dict(age_count),
            "outer_sp": dict(outer_sp_count),
            "inner_sp": dict(inner_sp_count),
            "rma": dict(rma_count),
            "flat": dict(flat_count),
            "peeling": dict(peel_count),
            "cracks": dict(crack_count),
            "surface": dict(surface_count),
            "usage": dict(usage_count),
            "fold_freq": dict(fold_freq_count),
        },
        "headline": headline,
        "per_device": per_device,
        "cohort_stats": cohort_stats,
        "sp_impact": sp_impact,
        "peel_outcomes": peel_outcomes,
        "flat_vs_cracks": flat_vs_cracks,
        "cracks_vs_break": cracks_vs_break,
        "fold_habit": fold_habit,
        "usage_durability": usage_durability,
        "break_timing_pct": break_timing_pct,
        "surface_by_age": surface_by_age,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(out, indent=2, ensure_ascii=False))
    print(f"Wrote {OUT_PATH.relative_to(REPO_ROOT)}")
    print(f"Raw: {raw_n}  Cleaned: {cleaned_n}  Excluded: {raw_n - cleaned_n}")
    print("Exclusion reasons (a row can have multiple):", dict(exclusion_counter))
    print("Per-device n:", {d: per_device[d]["n"] for d in DEVICE_ORDER})


if __name__ == "__main__":
    main()
