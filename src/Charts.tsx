import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart, PieChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  AriaComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";
import type { MonthLedger, YearLedger } from "./types";
import { annualSeries, CATEGORY, EXPENSE_CATEGORIES, money, sum } from "./data";
echarts.use([
  LineChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  AriaComponent,
  CanvasRenderer,
]);
function Chart({
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
  useEffect(() => {
    if (!ref.current) return;
    const instance = echarts.init(ref.current);
    chart.current = instance;
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      instance.dispose();
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
  const series = annualSeries(ledger);
  const rows =
    range === "six" ? series.slice(Math.max(0, month - 6), month) : series;
  const option: EChartsCoreOption = {
    color: ["#4263eb", "#24aa97"],
    textStyle: { fontFamily: "Inter, system-ui, sans-serif" },
    grid: { left: 54, right: 15, top: 18, bottom: 30 },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#101c34",
      borderWidth: 0,
      textStyle: { color: "#fff" },
      valueFormatter: (v: unknown) => money(Number(v), 2),
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: rows.map((r) => r.month),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: "#8892a5", fontSize: 12, margin: 14 },
    },
    yAxis: {
      type: "value",
      splitNumber: 4,
      axisLabel: {
        color: "#8892a5",
        fontSize: 12,
        formatter: (v: number) => (v >= 1000 ? `$${v / 1000}k` : `$${v}`),
      },
      splitLine: { lineStyle: { color: "#edf0f5", type: "dashed" } },
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
            { offset: 0, color: "#4263eb25" },
            { offset: 1, color: "#4263eb00" },
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
            { offset: 0, color: "#24aa9717" },
            { offset: 1, color: "#24aa9700" },
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
export function SpendingDonut({ month }: { month: MonthLedger }) {
  const data = EXPENSE_CATEGORIES.map((c) => ({
    name: CATEGORY[c].label,
    value: sum(
      month.transactions.filter((t) => t.category === c).map((t) => t.amount),
    ),
    itemStyle: { color: CATEGORY[c].color },
  }));
  return (
    <Chart
      label={`Spending by category. ${data.map((d) => `${d.name}: ${money(d.value)}`).join(". ")}`}
      className="donut-chart"
      option={{
        tooltip: {
          trigger: "item",
          formatter: "{b}<br/>{c} USD ({d}%)",
          borderWidth: 0,
          backgroundColor: "#101c34",
          textStyle: { color: "#fff" },
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
              ? data
              : [
                  {
                    name: "No expenses",
                    value: 1,
                    itemStyle: { color: "#edf0f5" },
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
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
