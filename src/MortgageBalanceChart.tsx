import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { MouseEvent, PointerEvent } from "react";
import { money } from "./data";
import { shortDate } from "./mortgage";
import type { MortgageAnalysis, MortgageLoan } from "./mortgage";
import { interpolateBalance, mortgageBalancePoints } from "./mortgageBalance";

const labels = {
  standard: "Standard payments",
  extras: "With extra principal",
};
type Series = keyof typeof labels;
const series: Series[] = ["standard", "extras"];
const monthLabel = (date: string) =>
  new Date(date + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

export default function MortgageBalanceChart({
  loan,
  analysis,
}: {
  loan: Pick<MortgageLoan, "balanceDate" | "balance">;
  analysis: MortgageAnalysis;
}) {
  const id = useId();
  const points = useMemo(
    () => mortgageBalancePoints(loan, analysis),
    [loan.balanceDate, loan.balance, analysis],
  );
  const last = points.length - 1;
  const [range, setRange] = useState("all");
  const [month, setMonth] = useState(() => Math.min(120, Math.floor(last / 2)));
  const [visible, setVisible] = useState({ standard: true, extras: true });
  const [hover, setHover] = useState<{
    index: number;
    x: number;
    y: number;
    pinned: boolean;
  } | null>(null);
  const plot = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 500, height: 260 });
  useEffect(() => {
    const element = plot.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0)
        setSize((previous) =>
          previous.width === width && previous.height === height
            ? previous
            : { width, height },
        );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const end = Math.min(last, range === "all" ? last : Number(range));
  const selected = Math.min(month, end);
  const active = series.filter((key) => visible[key]);
  const left = 64,
    right = Math.max(left + 30, size.width - 12),
    top = 28,
    bottom = size.height - 46;
  const max = Math.max(
    ...points.slice(0, end + 1).flatMap((p) => [p.standard, p.extras]),
    1,
  );
  const magnitude = 10 ** Math.floor(Math.log10(max / 4));
  const normalized = max / 4 / magnitude;
  const step =
    (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) *
    magnitude;
  const ceiling = Math.ceil(max / step) * step;
  const yTicks = Array.from(
    { length: Math.round(ceiling / step) + 1 },
    (_, i) => i * step,
  );
  const x = (index: number) =>
    left + 5 + (index / Math.max(1, end)) * (right - left - 10);
  const y = (value: number) =>
    bottom - 5 - (value / ceiling) * (bottom - top - 10);
  const tickCount = size.width < 400 ? 3 : 5;
  const xTicks = [
    ...new Set(
      Array.from({ length: tickCount }, (_, i) =>
        Math.round((end * i) / (tickCount - 1)),
      ),
    ),
  ];
  const shortRange = end < 36;
  const line = (key: Series) =>
    points
      .slice(0, end + 1)
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p[key])}`)
      .join(" ");
  const band =
    line("standard") +
    points
      .slice(0, end + 1)
      .map((p, i) => ` L${x(i)},${y(p.extras)}`)
      .reverse()
      .join("") +
    " Z";
  const focusIndex = Math.min(hover?.index ?? selected, end);
  const inspected = interpolateBalance(points, focusIndex);
  const detail = points[selected];
  const payoff = points.findIndex(
    (p) => p.date === analysis.accelerated.payoffDate,
  );
  const showPayoff =
    analysis.monthsSaved > 0 && visible.extras && payoff > 0 && payoff <= end;
  // Keep the label inside the space between the two paths, or show only the payoff dot.
  const labelStart = Math.max(
    0,
    ((x(payoff) - 64 - x(0)) / (x(Math.max(1, end)) - x(0))) * end,
  );
  const labelTop = payoff >= 0 ? y(points[payoff].standard) + 5 : 0;
  const labelBottom = y(interpolateBalance(points, labelStart).extras) - 5;
  const showPayoffLabel =
    showPayoff &&
    size.width > 440 &&
    x(payoff) - left > 70 &&
    labelBottom - labelTop >= 18;
  const payoffLabelY = (labelTop + labelBottom) / 2 + 4;
  const tipWidth = Math.min(270, size.width - 16);
  const tipLeft = hover
    ? Math.max(8, Math.min(hover.x + 12, size.width - tipWidth - 8))
    : 0;
  const tipTop = hover
    ? Math.max(8, Math.min(hover.y - 120, size.height - 120))
    : 0;
  function inspect(
    event: MouseEvent<SVGRectElement> | PointerEvent<SVGRectElement>,
    pinned = false,
  ) {
    const bounds = event.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const px = Math.max(x(0), Math.min(x(end), event.clientX - bounds.left));
    const index = end === 0 ? 0 : ((px - x(0)) / (x(end) - x(0))) * end;
    setHover({ index, x: px, y: event.clientY - bounds.top, pinned });
    if (pinned) setMonth(Math.round(index));
  }
  function clearHover() {
    setHover(null);
  }
  return (
    <section
      className="panel mortgage-chart"
      aria-labelledby={`${id}-title`}
      onKeyDown={(event) => {
        if (event.key === "Escape") clearHover();
      }}
    >
      <div className="panel-heading">
        <div>
          <h2 id={`${id}-title`}>Watch your balance fall</h2>
          <p>Same mortgage. A clearer path to your last payment.</p>
        </div>
      </div>
      <div className="mortgage-chart-toolbar">
        <div className="mortgage-chart-legend" aria-label="Chart series">
          {series.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={visible[key]}
              disabled={active.length === 1 && visible[key]}
              onClick={() => {
                setVisible((previous) => ({
                  ...previous,
                  [key]: !previous[key],
                }));
                clearHover();
              }}
            >
              <span
                className={`mortgage-chart-swatch ${key}`}
                aria-hidden="true"
              />
              {labels[key]}
            </button>
          ))}
        </div>
        {last > 60 && (
          <label className="mortgage-chart-period" htmlFor={`${id}-range`}>
            View
            <select
              id={`${id}-range`}
              aria-label="Chart time range"
              value={range}
              onChange={(event) => {
                setRange(event.target.value);
                clearHover();
              }}
            >
              <option value="all">Full mortgage</option>
              <option value="60">First 5 years</option>
              {last > 120 && <option value="120">First 10 years</option>}
            </select>
          </label>
        )}
      </div>
      <div className="mortgage-balance-plot" ref={plot}>
        <svg
          className="mortgage-balance-svg"
          viewBox={`0 0 ${size.width} ${size.height}`}
          role="img"
          aria-labelledby={`${id}-chart-title ${id}-chart-description`}
        >
          <title id={`${id}-chart-title`}>Projected mortgage balances</title>
          <desc id={`${id}-chart-description`}>
            Standard payoff {shortDate(analysis.baseline.payoffDate)}. Payoff
            with extras {shortDate(analysis.accelerated.payoffDate)}. Use the
            payment month slider below for balances and interest saved.
          </desc>
          <rect
            x={left}
            y={top}
            width={right - left}
            height={bottom - top}
            className="mortgage-plot-frame"
          />
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={left}
                x2={right}
                y1={y(tick)}
                y2={y(tick)}
                className="mortgage-plot-grid"
              />
              <text x={left - 8} y={y(tick)} dy=".35em" textAnchor="end">
                {tick >= 1000000
                  ? `$${Number((tick / 1000000).toFixed(2))}m`
                  : tick >= 1000
                    ? `$${Number((tick / 1000).toFixed(1))}k`
                    : `$${Number(tick.toFixed(2))}`}
              </text>
            </g>
          ))}
          <text x={left} y={13}>
            Remaining balance (USD)
          </text>
          {xTicks.map((tick, i) => (
            <text
              key={tick}
              x={x(tick)}
              y={bottom + 21}
              textAnchor={
                i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"
              }
            >
              {shortRange
                ? monthLabel(points[tick].date)
                : points[tick].date.slice(0, 4)}
            </text>
          ))}
          <text x={(left + right) / 2} y={size.height - 3} textAnchor="middle">
            {shortRange ? "Payment date" : "Payment year"}
          </text>
          {visible.standard && visible.extras && (
            <path d={band} className="mortgage-balance-band" />
          )}
          {active.map((key) => (
            <path
              key={key}
              d={line(key)}
              className={`mortgage-balance-line ${key}`}
            />
          ))}
          {showPayoff && (
            <g className="mortgage-payoff-marker">
              {showPayoffLabel && (
                <>
                  <line
                    x1={x(payoff)}
                    x2={x(payoff)}
                    y1={payoffLabelY + 4}
                    y2={y(0) - 8}
                    className="mortgage-plot-grid"
                  />
                  <text x={x(payoff) - 7} y={payoffLabelY} textAnchor="end">
                    Paid off
                  </text>
                </>
              )}
              <circle cx={x(payoff)} cy={y(0)} r={4} className="extras" />
            </g>
          )}
          <g pointerEvents="none">
            <line
              x1={x(focusIndex)}
              x2={x(focusIndex)}
              y1={top}
              y2={bottom}
              className={`mortgage-chart-guide ${hover ? "hovered" : ""}`}
            />
            {active.map((key) => (
              <circle
                key={key}
                cx={x(focusIndex)}
                cy={y(inspected[key])}
                r={4}
                className={`mortgage-chart-dot ${key}`}
              />
            ))}
          </g>
          <rect
            x={left}
            y={top}
            width={right - left}
            height={bottom - top}
            fill="transparent"
            onPointerMove={(event) => {
              if (!hover?.pinned && event.pointerType !== "touch")
                inspect(event);
            }}
            onPointerLeave={() => {
              if (!hover?.pinned) clearHover();
            }}
            onClick={(event) => inspect(event, true)}
          />
        </svg>
        {hover && (
          <div
            className="mortgage-chart-tooltip"
            role="tooltip"
            style={{ left: tipLeft, top: tipTop, width: tipWidth }}
          >
            <strong>Around {monthLabel(inspected.date)}</strong>
            {active.map((key) => (
              <div key={key}>
                <span>
                  {key === "standard" ? "Standard balance" : "With extras"}
                </span>
                <b>≈ {money(inspected[key])}</b>
              </div>
            ))}
            <div>
              <span>Interest saved to date</span>
              <b>≈ {money(inspected.interestSaved)}</b>
            </div>
          </div>
        )}
      </div>
      <div className="mortgage-chart-inspector">
        <label htmlFor={`${id}-month`}>
          <span>Inspect payment month</span>
          <output id={`${id}-date`}>{monthLabel(detail.date)}</output>
        </label>
        <input
          id={`${id}-month`}
          type="range"
          min={0}
          max={end}
          step={1}
          value={selected}
          disabled={end === 0}
          aria-describedby={`${id}-date`}
          aria-valuetext={shortDate(detail.date)}
          onChange={(event) => {
            setMonth(Number(event.target.value));
            clearHover();
          }}
        />
        <dl
          className="mortgage-chart-details"
          aria-live="polite"
          aria-atomic="true"
        >
          {visible.standard && (
            <div>
              <dt>Standard balance</dt>
              <dd>{money(detail.standard)}</dd>
            </div>
          )}
          {visible.extras && (
            <div>
              <dt>Balance with extras</dt>
              <dd>{money(detail.extras)}</dd>
            </div>
          )}
          <div className="mortgage-chart-saved">
            <dt>Interest saved by this date</dt>
            <dd>{money(detail.interestSaved)}</dd>
          </div>
        </dl>
        <p className="mortgage-chart-note">
          Monthly projections · escrow excluded.
        </p>
      </div>
    </section>
  );
}
