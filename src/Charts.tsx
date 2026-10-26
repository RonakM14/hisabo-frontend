import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { easeOut } from "./motion";
import * as echarts from "echarts/core";
import { LineChart, PieChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  AriaComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useChartColors } from "./theme";
import type { EChartsCoreOption } from "echarts/core";
import type { MonthLedger, YearLedger } from "./types";
import {
  annualSeries,
  categoryMap,
  categorySpending,
  visibleBudgetCategories,
  money,
} from "./data";
echarts.use([
  LineChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  AriaComponent,
  CanvasRenderer,
]);
/** Draw-in on first render, eased morph when the data changes. */
const chartMotion = {
  animationDuration: 1100,
  animationEasing: "cubicOut",
  animationDurationUpdate: 650,
  animationEasingUpdate: "cubicInOut",
} satisfies EChartsCoreOption;
export function Chart({
  option,
  label,
  className = "",
}: {
  option: EChartsCoreOption;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null),
    chart = useRef<echarts.EChartsType | null>(null);
  const latestOption = useRef(option);
  latestOption.current = option;
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let frame = 0;
    const resize = () => {
      // A profile can keep another workspace hidden; initialize once it has a real size.
      if (!element.clientWidth || !element.clientHeight) return;
      if (!chart.current) {
        chart.current = echarts.init(element);
        chart.current.setOption(
          {
            ...latestOption.current,
            animation: !window.matchMedia("(prefers-reduced-motion: reduce)")
              .matches,
            aria: { enabled: true },
          },
          true,
        );
      } else chart.current.resize();
    };
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(resize);
    });
    observer.observe(element);
    resize();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      chart.current?.dispose();
      chart.current = null;
    };
  }, []);
  useEffect(() => {
    chart.current?.setOption(
      {
        ...option,
        animation: !window.matchMedia("(prefers-reduced-motion: reduce)")
          .matches,
        aria: { enabled: true },
      },
      true,
    );
  }, [option]);
  return (
    <div
      ref={ref}
      role="img"
      aria-label={label}
      className={`echart ${className}`}
    />
  );
}
export function CashflowChart({
  ledger,
  month,
  range,
}: {
  ledger: YearLedger;
  month: number;
  range: "six" | "year";
}) {
  const colors = useChartColors();
  const series = annualSeries(ledger);
  const rows =
    range === "six" ? series.slice(Math.max(0, month - 6), month) : series;
  const option: EChartsCoreOption = {
    ...chartMotion,
    color: [colors.income, colors.expense],
    textStyle: { fontFamily: "Inter, system-ui, sans-serif" },
    grid: { left: 54, right: 15, top: 18, bottom: 30 },
    tooltip: {
      trigger: "axis",
      backgroundColor: colors.tooltip,
      borderWidth: 0,
      textStyle: { color: colors.tooltipText },
      valueFormatter: (v: unknown) => money(Number(v), 2),
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: rows.map((r) => r.month),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: colors.text, fontSize: 12, margin: 14 },
    },
    yAxis: {
      type: "value",
      splitNumber: 4,
      axisLabel: {
        color: colors.text,
        fontSize: 12,
        formatter: (v: number) => (v >= 1000 ? `$${v / 1000}k` : `$${v}`),
      },
      splitLine: { lineStyle: { color: colors.grid, type: "dashed" } },
    },
    series: [
      {
        name: "Income",
        type: "line",
        smooth: 0.35,
        symbol: "circle",
        symbolSize: 7,
        showSymbol: false,
        lineStyle: { width: 3 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: `${colors.income}25` },
            { offset: 1, color: `${colors.income}00` },
          ]),
        },
        data: rows.map((r) => r.income),
      },
      {
        name: "Expenses",
        type: "line",
        smooth: 0.3,
        symbol: "circle",
        symbolSize: 7,
        showSymbol: false,
        lineStyle: { width: 3 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: `${colors.expense}17` },
            { offset: 1, color: `${colors.expense}00` },
          ]),
        },
        data: rows.map((r) => r.expense),
      },
    ],
  };
  return (
    <Chart
      option={option}
      label={`Monthly income and expenses for ${ledger.year}. ${rows.map((r) => `${r.month}: income ${money(r.income)}, expenses ${money(r.expense)}`).join(". ")}`}
      className="cashflow-chart"
    />
  );
}
export function SpendingDonut({
  month,
  categories,
}: {
  month: MonthLedger;
  categories: import("./types").BudgetCategory[];
}) {
  const colors = useChartColors();
  const CATEGORY = categoryMap(categories);
  const data = visibleBudgetCategories(categories, month).map(({ id: c }) => ({
    name: CATEGORY[c].label,
    value: categorySpending(month, c),
    itemStyle: { color: CATEGORY[c].color },
  }));
  return (
    <Chart
      label={`Spending by category. ${data.map((d) => `${d.name}: ${money(d.value)}`).join(". ")}`}
      className="donut-chart"
      option={{
        ...chartMotion,
        tooltip: {
          renderMode: "richText",
          trigger: "item",
          formatter: "{b}\n{c} USD ({d}%)",
          borderWidth: 0,
          backgroundColor: colors.tooltip,
          textStyle: { color: colors.tooltipText },
        },
        series: [
          {
            type: "pie",
            radius: ["73%", "90%"],
            center: ["50%", "50%"],
            padAngle: 3,
            itemStyle: { borderRadius: 5 },
            label: { show: false },
            emphasis: { scale: true, scaleSize: 4 },
            data: data.some((d) => d.value > 0)
              ? data.filter((d) => d.value > 0)
              : [
                  {
                    name: "No net spending",
                    value: 1,
                    itemStyle: { color: colors.empty },
                    tooltip: { show: false },
                  },
                ],
          },
        ],
      }}
    />
  );
}
export function Sparkline({
  values,
  color,
}: {
  values: number[];
  color: string;
}) {
  const reduce = useReducedMotion();
  const width = 104,
    height = 35,
    max = Math.max(...values, 1),
    min = Math.min(...values, 0),
    points = values
      .map(
        (v, i) =>
          `${(i * width) / Math.max(1, values.length - 1)},${height - 4 - ((v - min) / (max - min || 1)) * (height - 8)}`,
      )
      .join(" ");
  return (
    <svg
      aria-hidden="true"
      className="sparkline"
      viewBox={`0 0 ${width} ${height}`}
    >
      <motion.polyline
        key={points}
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinejoin="round"
        strokeLinecap="round"
        initial={reduce ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1, ease: easeOut }}
      />
    </svg>
  );
}
