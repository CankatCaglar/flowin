"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { parseDateKey } from "@/lib/dates";
import { bucketChartSeries } from "@/lib/metrics";
import { formatNumber, formatPercent } from "@/lib/utils";
import type { ChartMetric } from "@/types";

interface Point {
  date: string;
  sentCount: number;
  repliedCount: number;
  successRate: number;
}

const metrics: ChartMetric[] = ["successRate", "sent", "replied"];

function ChartDot({
  cx,
  cy,
  active = false,
}: {
  cx?: number;
  cy?: number;
  active?: boolean;
}) {
  if (cx == null || cy == null) return null;
  const outer = active ? 6 : 5;
  const inner = active ? 3.5 : 3;
  return (
    <g>
      <circle cx={cx} cy={cy} r={outer} fill="#FFFFFF" />
      <circle
        cx={cx}
        cy={cy}
        r={inner}
        fill="#FFFFFF"
        stroke="#AE1BB6"
        strokeWidth={2}
      />
    </g>
  );
}

function formatAxisLabel(date: string, locale: string, grain: "day" | "week" | "month") {
  const parsed = parseDateKey(date);
  const tag = locale === "tr" ? "tr-TR" : "en-US";
  if (grain === "month") {
    return new Intl.DateTimeFormat(tag, { month: "short", year: "2-digit" }).format(parsed);
  }
  return new Intl.DateTimeFormat(tag, { day: "numeric", month: "short" }).format(parsed);
}

export function PerformanceChart({ data }: { data: Point[] }) {
  const t = useTranslations("dashboard.chart");
  const locale = useLocale();
  const [metric, setMetric] = useState<ChartMetric>("successRate");

  const { points, grain } = useMemo(() => bucketChartSeries(data), [data]);
  const showDots = grain === "day";

  const chartData = useMemo(
    () =>
      points.map((point) => ({
        ...point,
        label: formatAxisLabel(point.date, locale, grain),
        value: Math.max(
          0,
          metric === "sent"
            ? point.sentCount
            : metric === "replied"
              ? point.repliedCount
              : point.successRate,
        ),
      })),
    [grain, locale, metric, points],
  );

  const yMax = useMemo(() => {
    const peak = chartData.reduce((max, point) => Math.max(max, point.value), 0);
    if (metric === "successRate") {
      return Math.max(50, Math.ceil(peak / 10) * 10);
    }
    if (peak <= 4) return 4;
    const magnitude = 10 ** Math.floor(Math.log10(peak));
    return Math.ceil(peak / magnitude) * magnitude;
  }, [chartData, metric]);

  const yTicks = useMemo(() => {
    const steps = metric === "successRate" ? 5 : 4;
    const step = yMax / steps;
    return Array.from({ length: steps + 1 }, (_, index) => index * step);
  }, [metric, yMax]);

  return (
    <article className="surface-card rounded-2xl p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">{t("title")}</h2>
        <SelectMenu
          id="performance-metric"
          align="right"
          className="w-56"
          ariaLabel={t("metric")}
          value={metric}
          options={metrics.map((option) => ({ value: option, label: t(option) }))}
          onChange={(value) => setMetric(value as ChartMetric)}
        />
      </div>
      <div
        className="h-72 select-none outline-none [&_*]:outline-none [&_svg]:outline-none"
        onMouseDown={(event) => event.preventDefault()}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 16, right: 16, left: 4, bottom: 8 }}
            style={{ outline: "none" }}
          >
            <defs>
              <linearGradient id="barneyFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#AE1BB6" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#AE1BB6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#efe7f2" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#7a6680", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              minTickGap={32}
              padding={{ left: 12, right: 12 }}
              height={32}
            />
            <YAxis
              domain={[0, yMax]}
              ticks={yTicks}
              allowDecimals={false}
              tick={{ fill: "#7a6680", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={56}
              tickFormatter={(value) =>
                metric === "successRate"
                  ? formatPercent(Number(value), locale, 0)
                  : formatNumber(Number(value), locale)
              }
            />
            <Tooltip
              cursor={{ stroke: "#AE1BB6", strokeWidth: 1, strokeDasharray: "4 4" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const raw = Number(payload[0]?.value ?? 0);
                const value =
                  metric === "successRate"
                    ? formatPercent(raw, locale)
                    : formatNumber(raw, locale);
                return (
                  <div className="rounded-lg border border-purple-jam/10 bg-white px-3 py-2 text-xs shadow-md">
                    <p className="text-muted">{label}</p>
                    <p className="mt-1 font-medium text-ink">
                      {t(metric)}: {value}
                    </p>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="none"
              fill="url(#barneyFill)"
              tooltipType="none"
              legendType="none"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#AE1BB6"
              strokeWidth={2}
              dot={showDots ? <ChartDot /> : false}
              activeDot={<ChartDot active />}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
