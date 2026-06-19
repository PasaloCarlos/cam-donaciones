"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
} from "recharts";
import { formatCents } from "@/lib/money";
import { donor } from "@/config/donor.config";
import type { Trends } from "@/actions/metrics";

const CAM_PALETTE = ["#E8964B", "#5B8C7B", "#B5651D", "#8A8D91", "#C7A27C"];

interface PanelChartsProps {
  trends: Trends;
  bySource: Record<string, { netCents: number; count: number }>;
  byGoal: Record<string, { netCents: number; count: number }>;
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="mb-3 font-display text-xs uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

// Custom tooltip helpers (avoid recharts Formatter type conflicts)
function MonthlyTooltip({ active, payload, label }: {
  active?: boolean;
  label?: string;
  payload?: Array<{ payload?: { netCents?: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const netCents = payload[0]?.payload?.netCents ?? 0;
  return (
    <div className="rounded border border-border bg-card px-3 py-2 text-xs shadow">
      <p className="font-medium">{label}</p>
      <p>{formatCents(netCents, donor.currency)}</p>
    </div>
  );
}

function CountTooltip({ active, payload, label, name }: {
  active?: boolean;
  label?: string;
  payload?: Array<{ value?: number }>;
  name: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-border bg-card px-3 py-2 text-xs shadow">
      <p className="font-medium">{label}</p>
      <p>{name}: {payload[0]?.value}</p>
    </div>
  );
}

function PieTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ name?: string; payload?: { netCents?: number; name?: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  const label = entry?.payload?.name ?? entry?.name ?? "";
  const netCents = entry?.payload?.netCents ?? 0;
  return (
    <div className="rounded border border-border bg-card px-3 py-2 text-xs shadow">
      <p className="font-medium">{label}</p>
      <p>{formatCents(netCents, donor.currency)}</p>
    </div>
  );
}

function ChangesTooltip({ active, payload, label }: {
  active?: boolean;
  label?: string;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-border bg-card px-3 py-2 text-xs shadow">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
}

export function PanelCharts({ trends, bySource, byGoal }: PanelChartsProps) {
  const monthlyData = trends.monthlyNet.map((d) => ({
    month: d.month,
    dollars: d.netCents / 100,
    netCents: d.netCents,
  }));

  const activeData = trends.activeDonors;
  const changesData = trends.subscriptionChanges;

  const sourceData = Object.entries(bySource).map(([key, val]) => ({
    name: donor.sources[key as keyof typeof donor.sources] ?? key,
    value: val.netCents,
    netCents: val.netCents,
  }));

  const goalData = Object.entries(byGoal).map(([key, val]) => ({
    name:
      key === "sin_objetivo"
        ? "Sin objetivo"
        : (donor.goals[key as keyof typeof donor.goals] ?? key),
    value: val.netCents,
    netCents: val.netCents,
  }));

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {/* 1. Recaudo mensual */}
      <ChartCard title="Recaudo mensual">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="camGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#E8964B" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#E8964B" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => `$${v.toLocaleString()}`}
              width={64}
            />
            <Tooltip content={<MonthlyTooltip />} />
            <Area
              type="monotone"
              dataKey="dollars"
              stroke="#E8964B"
              strokeWidth={2}
              fill="url(#camGrad)"
              dot={false}
              name="Recaudo neto"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 2. Donantes activos por mes */}
      <ChartCard title="Donantes activos por mes">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={activeData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} width={36} allowDecimals={false} />
            <Tooltip content={<CountTooltip name="Donantes" />} />
            <Bar dataKey="donors" fill="#E8964B" radius={[3, 3, 0, 0]} name="Donantes" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 3. Por fuente */}
      <ChartCard title="Por fuente">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={sourceData}
              cx="50%"
              cy="45%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={3}
              dataKey="value"
            >
              {sourceData.map((_entry, i) => (
                <Cell key={i} fill={CAM_PALETTE[i % CAM_PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip content={<PieTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 3b. Por objetivo */}
      <ChartCard title="Por objetivo">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={goalData}
              cx="50%"
              cy="45%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={3}
              dataKey="value"
            >
              {goalData.map((_entry, i) => (
                <Cell key={i} fill={CAM_PALETTE[i % CAM_PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip content={<PieTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 4. Altas vs bajas por mes — spans full width on sm+ */}
      <div className="sm:col-span-2">
        <ChartCard title="Altas vs bajas por mes">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={changesData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={36} allowDecimals={false} />
              <Tooltip content={<ChangesTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="started" fill="#5B8C7B" radius={[3, 3, 0, 0]} name="Altas" />
              <Bar dataKey="cancelled" fill="#C0431F" radius={[3, 3, 0, 0]} name="Bajas" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
