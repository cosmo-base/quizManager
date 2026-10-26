"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"

export interface BarDatum {
  name: string
  value: number
}

export function SimpleBarChart({ data, label, unit, color = "var(--chart-1)" }: { data: BarDatum[]; label: string; unit?: string; color?: string }) {
  const config: ChartConfig = { value: { label, color } }
  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
        <YAxis tickLine={false} axisLine={false} width={40} fontSize={12} unit={unit} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={4} maxBarSize={48} />
      </BarChart>
    </ChartContainer>
  )
}
