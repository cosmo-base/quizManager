"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

export interface SelectOption<T extends string> {
  value: T
  label: string
}

export function SimpleSelect<T extends string>({
  value,
  onChange,
  options,
  placeholder,
  className,
  id,
  disabled,
  size,
  "aria-label": ariaLabel,
}: {
  value: T
  onChange: (v: T) => void
  options: SelectOption<T>[]
  placeholder?: string
  className?: string
  id?: string
  disabled?: boolean
  size?: "sm" | "default"
  "aria-label"?: string
}) {
  return (
    <Select items={options} value={value} onValueChange={(v) => v !== null && onChange(v as T)} disabled={disabled}>
      <SelectTrigger id={id} size={size} aria-label={ariaLabel} className={cn("w-full min-w-0", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
