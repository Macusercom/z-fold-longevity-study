/* Z Fold Longevity Study 2026 — chart wiring */
(function () {
  "use strict";

  const COLORS = {
    cyan: "#22d3ee",
    violet: "#a78bfa",
    pink: "#f472b6",
    green: "#34d399",
    amber: "#fbbf24",
    red: "#f87171",
    grey: "#6f6f82",
    line: "#1f1f2e",
    text: "#e7e7ee",
    textDim: "#a4a4b6",
    textMuted: "#6f6f82",
  };

  // Generation → accent. Keep historical continuity (older = cooler colors, Fold 7 = headline cyan).
  const GEN_COLOR = {
    "Z Fold 1": "#475569",
    "Z Fold 2": "#64748b",
    "Z Fold 3": "#f87171",
    "Z Fold 4": "#fbbf24",
    "Z Fold 5": "#a78bfa",
    "Z Fold 6": "#34d399",
    "Z Fold 7": "#22d3ee",
  };

  const METRIC_LABELS = {
    rma_pct: "RMA rate",
    inner_break_pct: "Inner screen broke",
    default_protector_peeled_pct: "Default protector peeled",
    micro_cracks_pct: "Micro cracks visible",
    not_flat_pct: "Screen not fully flat",
  };

  const Y1_METRICS = [
    "rma_pct",
    "inner_break_pct",
    "default_protector_peeled_pct",
    "micro_cracks_pct",
    "not_flat_pct",
  ];

  // ---------- helpers ----------
  function fmt(v) {
    if (v == null || Number.isNaN(v)) return "—";
    return `${v.toFixed(1)}%`;
  }

  function defaultChartOpts(extra) {
    const base = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: "#0b0b14",
          borderColor: COLORS.line,
          borderWidth: 1,
          titleColor: COLORS.text,
          bodyColor: COLORS.textDim,
          padding: 12,
          cornerRadius: 8,
          boxPadding: 6,
          titleFont: { weight: "600", family: "Inter, system-ui, sans-serif" },
          bodyFont: { family: "JetBrains Mono, ui-monospace, monospace" },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: COLORS.line },
          ticks: { color: COLORS.textDim, font: { family: "Inter, system-ui, sans-serif", size: 11 } },
        },
        y: {
          grid: { color: COLORS.line },
          border: { display: false },
          ticks: {
            color: COLORS.textDim,
            font: { family: "JetBrains Mono, monospace", size: 11 },
            callback: (v) => `${v}%`,
          },
          beginAtZero: true,
        },
      },
    };
    return mergeDeep(base, extra || {});
  }

  function mergeDeep(target, src) {
    for (const k of Object.keys(src)) {
      if (src[k] && typeof src[k] === "object" && !Array.isArray(src[k])) {
        target[k] = mergeDeep(target[k] || {}, src[k]);
      } else {
        target[k] = src[k];
      }
    }
    return target;
  }

  // ---------- main render ----------
  function render(stats) {
    if (typeof Chart === "undefined") {
      console.warn("Chart.js failed to load. Charts will be skipped.");
    } else {
      Chart.defaults.font.family = "Inter, system-ui, sans-serif";
      Chart.defaults.color = COLORS.textDim;
      renderHeadline(stats);
      renderCohort(stats);
      renderFolds(stats);
      renderUsage(stats);
      renderSurface(stats);
    }
    renderCounters();
    renderGenerationCards(stats);
    renderProtectorTable(stats);
    renderChain(stats);
    renderMethExclusions(stats);
  }

  // ---------- counters ----------
  function renderCounters() {
    const els = document.querySelectorAll("[data-counter]");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          observer.unobserve(e.target);
          const target = parseInt(e.target.dataset.target, 10);
          let current = 0;
          const start = performance.now();
          const dur = 900;
          const step = (now) => {
            const t = Math.min(1, (now - start) / dur);
            const eased = 1 - Math.pow(1 - t, 3);
            const val = Math.round(eased * target);
            if (val !== current) {
              e.target.textContent = val.toLocaleString();
              current = val;
            }
            if (t < 1) requestAnimationFrame(step);
            else e.target.textContent = target.toLocaleString();
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.4 }
    );
    els.forEach((el) => observer.observe(el));
  }

  // ---------- headline chart: year-1 issues across gens ----------
  function renderHeadline(stats) {
    const el = document.getElementById("chart-headline");
    if (!el) return;
    const gensWithYear1 = ["Z Fold 4", "Z Fold 5", "Z Fold 6", "Z Fold 7"].filter(
      (g) => stats.cohort_stats[g] && stats.cohort_stats[g]["Year 1"] && stats.cohort_stats[g]["Year 1"].n >= 5
    );
    const datasets = gensWithYear1.map((g) => {
      const c = stats.cohort_stats[g]["Year 1"];
      return {
        label: `${g} (n=${c.n})`,
        data: Y1_METRICS.map((m) => c[m] ?? 0),
        backgroundColor: GEN_COLOR[g],
        borderRadius: 6,
        maxBarThickness: 36,
      };
    });

    new Chart(el, {
      type: "bar",
      data: {
        labels: Y1_METRICS.map((m) => METRIC_LABELS[m]),
        datasets: datasets,
      },
      options: defaultChartOpts({
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}`,
            },
          },
        },
      }),
    });

    // legend
    const legend = document.getElementById("legend-headline");
    if (legend) {
      legend.innerHTML = datasets
        .map(
          (d, i) =>
            `<span class="lg-item"><span class="lg-swatch" style="background:${d.backgroundColor}"></span>${gensWithYear1[i]} <span style="color:var(--text-muted)">· n=${stats.cohort_stats[gensWithYear1[i]]["Year 1"].n}</span></span>`
        )
        .join("");
    }
  }

  // ---------- cohort interactive ----------
  let cohortChart = null;
  function renderCohort(stats) {
    const el = document.getElementById("chart-cohort");
    const select = document.getElementById("metric-select");
    if (!el || !select) return;

    const gens = ["Z Fold 3", "Z Fold 4", "Z Fold 5", "Z Fold 6", "Z Fold 7"];
    const cohorts = ["Year 1", "Year 2", "Beyond Year 2"];

    const build = (metric) => {
      const datasets = gens.map((g) => ({
        label: g,
        data: cohorts.map((c) => {
          const stat = stats.cohort_stats[g] && stats.cohort_stats[g][c];
          if (!stat || stat.n < 5) return null;
          return stat[metric] ?? null;
        }),
        sampleSizes: cohorts.map((c) => {
          const s = stats.cohort_stats[g] && stats.cohort_stats[g][c];
          return s ? s.n : 0;
        }),
        backgroundColor: GEN_COLOR[g],
        borderRadius: 6,
        maxBarThickness: 32,
      }));
      return { datasets };
    };

    const initial = build(select.value);
    cohortChart = new Chart(el, {
      type: "bar",
      data: { labels: cohorts, datasets: initial.datasets },
      options: defaultChartOpts({
        plugins: {
          legend: {
            display: true,
            position: "top",
            align: "end",
            labels: {
              color: COLORS.textDim,
              boxWidth: 12,
              boxHeight: 12,
              padding: 14,
              font: { size: 12 },
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const n = ctx.dataset.sampleSizes ? ctx.dataset.sampleSizes[ctx.dataIndex] : 0;
                if (ctx.parsed.y == null) return `${ctx.dataset.label}: too few responses (n=${n})`;
                return `${ctx.dataset.label}: ${fmt(ctx.parsed.y)} (n=${n})`;
              },
            },
          },
        },
      }),
    });

    select.addEventListener("change", () => {
      const next = build(select.value);
      cohortChart.data.datasets = next.datasets;
      cohortChart.update();
      const note = document.getElementById("cohort-note");
      if (note) {
        note.textContent = `Metric: ${METRIC_LABELS[select.value]}. Empty bars mean the cohort doesn't exist yet (e.g. there are no Fold 7 owners with the device for more than a year in May 2026) or has fewer than 5 responses.`;
      }
    });
  }

  // ---------- folds-per-day chart ----------
  function renderFolds(stats) {
    const el = document.getElementById("chart-folds");
    if (!el) return;
    const buckets = ["0–5 times", "6–10 times", "11–15 times", "16–20 times", "More than 20 times a day"];
    const labels = ["0–5", "6–10", "11–15", "16–20", "20+"];
    const valid = buckets.filter((b) => stats.fold_habit[b] && stats.fold_habit[b].n >= 5);

    new Chart(el, {
      type: "bar",
      data: {
        labels: valid.map((b, i) => labels[buckets.indexOf(b)]),
        datasets: [
          {
            label: "RMA rate",
            data: valid.map((b) => stats.fold_habit[b].rma_pct),
            backgroundColor: COLORS.cyan + "cc",
            borderRadius: 6,
            maxBarThickness: 28,
          },
          {
            label: "Micro cracks",
            data: valid.map((b) => stats.fold_habit[b].micro_cracks_pct),
            backgroundColor: COLORS.violet + "cc",
            borderRadius: 6,
            maxBarThickness: 28,
          },
          {
            label: "Inner break",
            data: valid.map((b) => stats.fold_habit[b].inner_break_pct),
            backgroundColor: COLORS.pink + "cc",
            borderRadius: 6,
            maxBarThickness: 28,
          },
        ],
      },
      options: defaultChartOpts({
        plugins: {
          legend: {
            display: true,
            position: "top",
            align: "end",
            labels: { color: COLORS.textDim, boxWidth: 10, boxHeight: 10, padding: 12, font: { size: 11 } },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const b = valid[ctx.dataIndex];
                const n = stats.fold_habit[b].n;
                return `${ctx.dataset.label}: ${fmt(ctx.parsed.y)} (n=${n})`;
              },
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: "Folds per day", color: COLORS.textMuted, font: { size: 11 } },
          },
        },
      }),
    });
  }

  // ---------- screen usage chart ----------
  function renderUsage(stats) {
    const el = document.getElementById("chart-usage");
    if (!el) return;
    const groups = ["Mostly inner (1–3)", "Balanced (4–7)", "Mostly outer (8–10)"];
    const valid = groups.filter((g) => stats.usage_durability[g] && stats.usage_durability[g].n >= 5);

    new Chart(el, {
      type: "bar",
      data: {
        labels: valid,
        datasets: [
          {
            label: "RMA rate",
            data: valid.map((g) => stats.usage_durability[g].rma_pct),
            backgroundColor: COLORS.cyan + "cc",
            borderRadius: 6,
            maxBarThickness: 28,
          },
          {
            label: "Micro cracks",
            data: valid.map((g) => stats.usage_durability[g].micro_cracks_pct),
            backgroundColor: COLORS.violet + "cc",
            borderRadius: 6,
            maxBarThickness: 28,
          },
          {
            label: "Inner break",
            data: valid.map((g) => stats.usage_durability[g].inner_break_pct),
            backgroundColor: COLORS.pink + "cc",
            borderRadius: 6,
            maxBarThickness: 28,
          },
        ],
      },
      options: defaultChartOpts({
        plugins: {
          legend: {
            display: true,
            position: "top",
            align: "end",
            labels: { color: COLORS.textDim, boxWidth: 10, boxHeight: 10, padding: 12, font: { size: 11 } },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const g = valid[ctx.dataIndex];
                const n = stats.usage_durability[g].n;
                return `${ctx.dataset.label}: ${fmt(ctx.parsed.y)} (n=${n})`;
              },
            },
          },
        },
      }),
    });
  }

  // ---------- surface stacked chart ----------
  function renderSurface(stats) {
    const el = document.getElementById("chart-surface");
    if (!el) return;
    const SURFACE_KEYS = [
      "Completely fine",
      "Small scratches, only visible under a certain light",
      "Small scratches, always visible",
      "Larger scratches, always visible",
    ];
    const SURFACE_COLORS = [COLORS.green, COLORS.cyan, COLORS.amber, COLORS.red];
    const ageOrder = stats.meta.age_order;
    const labelShort = stats.meta.age_label_short;

    const buckets = ageOrder.filter((a) => stats.surface_by_age[a]);
    const datasets = SURFACE_KEYS.map((key, i) => ({
      label: key,
      data: buckets.map((a) => stats.surface_by_age[a][key] ?? 0),
      backgroundColor: SURFACE_COLORS[i],
      borderRadius: 4,
      maxBarThickness: 50,
    }));

    new Chart(el, {
      type: "bar",
      data: { labels: buckets.map((a) => labelShort[a] || a), datasets },
      options: defaultChartOpts({
        plugins: {
          legend: {
            display: true,
            position: "top",
            align: "start",
            labels: { color: COLORS.textDim, boxWidth: 10, boxHeight: 10, padding: 12, font: { size: 11 } },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}`,
              afterBody: (ctx) => {
                const a = buckets[ctx[0].dataIndex];
                return `n = ${stats.surface_by_age[a].n}`;
              },
            },
          },
        },
        scales: {
          x: { stacked: true },
          y: {
            stacked: true,
            max: 100,
            ticks: { color: COLORS.textDim, callback: (v) => `${v}%` },
          },
        },
      }),
    });
  }

  // ---------- generation cards ----------
  function renderGenerationCards(stats) {
    const root = document.getElementById("gen-grid");
    if (!root) return;
    const gens = stats.meta.device_order.filter((g) => stats.per_device[g] && stats.per_device[g].n);
    root.innerHTML = gens
      .map((g) => {
        const d = stats.per_device[g];
        const lowSample = d.n < 10;
        const featured = g === "Z Fold 7";
        const cls = ["gen-card", featured ? "featured" : "", lowSample ? "low-sample" : ""]
          .filter(Boolean)
          .join(" ");

        // status thresholds (rough)
        const status = (val, good, warn) => {
          if (val == null) return "";
          if (val <= good) return "ok";
          if (val <= warn) return "alert";
          return "bad";
        };
        return `
          <article class="${cls}" aria-label="${g} statistics">
            <div class="gen-name">${g}</div>
            <h3 class="gen-title">Generation ${g.replace("Z Fold ", "")}</h3>
            <span class="gen-n">n = ${d.n}${lowSample ? " · sample too small for confident inference" : ""}</span>
            <div class="gen-metrics">
              <div class="gen-metric ${status(d.rma_pct, 7, 25)}">
                <span class="m-label">RMA</span>
                <span class="m-value">${fmt(d.rma_pct)}</span>
              </div>
              <div class="gen-metric ${status(d.inner_break_pct, 5, 15)}">
                <span class="m-label">Inner break</span>
                <span class="m-value">${fmt(d.inner_break_pct)}</span>
              </div>
              <div class="gen-metric ${status(d.default_protector_peeled_pct, 10, 50)}">
                <span class="m-label">Protector peel</span>
                <span class="m-value">${fmt(d.default_protector_peeled_pct)}</span>
              </div>
              <div class="gen-metric ${status(d.micro_cracks_pct, 7, 20)}">
                <span class="m-label">Micro cracks</span>
                <span class="m-value">${fmt(d.micro_cracks_pct)}</span>
              </div>
              <div class="gen-metric ${status(d.not_flat_pct, 5, 25)}">
                <span class="m-label">Not flat</span>
                <span class="m-value">${fmt(d.not_flat_pct)}</span>
              </div>
              <div class="gen-metric">
                <span class="m-label">Folds/day · usage</span>
                <span class="m-value">${d.folds_per_day_avg ?? "—"} · ${d.screen_usage_avg ?? "—"}</span>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  // ---------- protector impact table ----------
  function renderProtectorTable(stats) {
    const tbody = document.querySelector("#sp-table tbody");
    if (!tbody) return;
    const order = ["Default factory (pre-applied)", "None", "3rd party", "Samsung official replacement"];
    tbody.innerHTML = order
      .filter((k) => stats.sp_impact[k] && stats.sp_impact[k].n)
      .map((k) => {
        const d = stats.sp_impact[k];
        return `<tr>
          <td>${k}</td>
          <td class="num">${d.n}</td>
          <td class="num">${fmt(d.micro_cracks_pct)}</td>
          <td class="num">${fmt(d.inner_break_pct)}</td>
          <td class="num">${fmt(d.rma_pct)}</td>
        </tr>`;
      })
      .join("");
  }

  // ---------- causal chain text ----------
  function renderChain(stats) {
    const peel = stats.peel_outcomes;
    const setText = (id, html) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html;
    };
    const x = (a, b) => (b > 0 ? `${(a / b).toFixed(1)}×` : "—");
    setText(
      "chain-peel-text",
      `<strong>${stats.headline.default_protector_peeled_pct.toFixed(1)}%</strong> of cleaned respondents on the factory protector report it peeling or bubbling. The risk increases sharply after month 12 — peeling is rare in a device's first year.`
    );
    setText(
      "chain-crack-text",
      `Owners whose protector peeled report micro cracks <strong>${fmt(peel.cracks_when_peeling)}</strong> of the time, vs <strong>${fmt(peel.cracks_when_no_peeling)}</strong> for those whose protector is fine — about <strong>${x(peel.cracks_when_peeling, peel.cracks_when_no_peeling)}</strong> more likely.`
    );
    setText(
      "chain-break-text",
      `When the inner protector has peeled, <strong>${fmt(peel.break_when_peeling)}</strong> of owners also report a broken inner screen — versus just <strong>${fmt(peel.break_when_no_peeling)}</strong> when it hasn't. That's roughly <strong>${x(peel.break_when_peeling, peel.break_when_no_peeling)}</strong> the risk.`
    );
  }

  // ---------- methodology counts ----------
  function renderMethExclusions(stats) {
    const el = document.getElementById("meth-excluded");
    if (el) el.textContent = (stats.meta.raw_n - stats.meta.cleaned_n).toString();
  }

  // ---------- bootstrap ----------
  function start() {
    fetch("./stats.json", { cache: "no-cache" })
      .then((r) => {
        if (!r.ok) throw new Error("stats.json failed: " + r.status);
        return r.json();
      })
      .then(render)
      .catch((err) => {
        console.error(err);
        const banner = document.createElement("div");
        banner.style.cssText =
          "position:fixed;left:50%;top:80px;transform:translateX(-50%);background:#1f1f2e;color:#f87171;padding:12px 18px;border-radius:8px;border:1px solid #2a2a3d;z-index:200;font-size:0.9rem;";
        banner.textContent =
          "Couldn't load study data. If you're viewing this from a file:// URL, run a local web server first.";
        document.body.appendChild(banner);
      });
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(start, 0);
  } else {
    document.addEventListener("DOMContentLoaded", start);
  }
})();
