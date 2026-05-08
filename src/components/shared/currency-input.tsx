"use client"

import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * Props for the CurrencyInput component
 */
export interface CurrencyInputProps {
  /** Current numeric value */
  value: number
  /** Callback when value changes */
  onChange: (value: number) => void
  /** Placeholder text when empty */
  placeholder?: string
  /** Whether the input is disabled */
  disabled?: boolean
  /** Additional CSS classes */
  className?: string
  /** Input element ID */
  id?: string
  /** Input name attribute */
  name?: string
  /** Minimum allowed value */
  min?: number
  /** Maximum allowed value */
  max?: number
  /** Number of decimal places (default: 2) */
  decimals?: number
  /** Whether to allow negative values */
  allowNegative?: boolean
  /** Whether to show value as formatted on blur */
  formatOnBlur?: boolean
  /** Size variant */
  size?: "sm" | "default" | "lg"
  /** Text alignment */
  align?: "left" | "center" | "right"
  /** Callback when input is blurred */
  onBlur?: () => void
  /** Callback when input is focused */
  onFocus?: () => void
}

/**
 * A specialized input component for currency/numeric values.
 *
 * Features:
 * - Numeric-only input with decimal support
 * - Mobile-friendly with decimal keyboard
 * - Formatting on blur
 * - Min/max validation
 * - Monospace font for aligned numbers
 *
 * @example
 * ```tsx
 * // Basic usage
 * <CurrencyInput
 *   value={amount}
 *   onChange={setAmount}
 *   placeholder="0.00"
 * />
 *
 * // With validation
 * <CurrencyInput
 *   value={price}
 *   onChange={setPrice}
 *   min={0}
 *   max={10000}
 *   decimals={2}
 * />
 *
 * // In a form field
 * <div className="space-y-2">
 *   <Label htmlFor="amount">Amount</Label>
 *   <CurrencyInput
 *     id="amount"
 *     value={formData.amount}
 *     onChange={(v) => updateForm("amount", v)}
 *   />
 * </div>
 * ```
 */
export function CurrencyInput({
  value,
  onChange,
  placeholder = "0.00",
  disabled = false,
  className,
  id,
  name,
  min,
  max,
  decimals = 2,
  allowNegative = false,
  formatOnBlur = true,
  size = "default",
  align = "right",
  onBlur,
  onFocus,
}: CurrencyInputProps) {
  // Local string state for editing
  const [localValue, setLocalValue] = useState(() =>
    value === 0 ? "" : value.toString()
  )
  const [isFocused, setIsFocused] = useState(false)

  // Sync local value when prop changes (but not while editing)
  useEffect(() => {
    if (!isFocused) {
      // Use a microtask to avoid the setState-in-effect warning
      // This is a valid pattern for syncing controlled input state
      const timeoutId = setTimeout(() => {
        setLocalValue(value === 0 ? "" : value.toFixed(decimals))
      }, 0)
      return () => clearTimeout(timeoutId)
    }
  }, [value, isFocused, decimals])

  // Parse and validate the input value
  const parseValue = useCallback(
    (input: string): number => {
      // Remove non-numeric characters except decimal point and minus
      let cleaned = input.replace(/[^0-9.-]/g, "")

      // Handle negative values
      if (!allowNegative) {
        cleaned = cleaned.replace(/-/g, "")
      } else {
        // Only allow one minus at the start
        const isNegative = cleaned.startsWith("-")
        cleaned = cleaned.replace(/-/g, "")
        if (isNegative) {
          cleaned = "-" + cleaned
        }
      }

      // Handle multiple decimal points
      const parts = cleaned.split(".")
      if (parts.length > 2) {
        cleaned = parts[0] + "." + parts.slice(1).join("")
      }

      // Parse to number
      let numValue = parseFloat(cleaned) || 0

      // Round to specified decimals
      const multiplier = Math.pow(10, decimals)
      numValue = Math.round(numValue * multiplier) / multiplier

      // Apply min/max constraints
      if (min !== undefined && numValue < min) {
        numValue = min
      }
      if (max !== undefined && numValue > max) {
        numValue = max
      }

      return numValue
    },
    [allowNegative, decimals, min, max]
  )

  // Handle input change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value

      // Allow empty string
      if (input === "") {
        setLocalValue("")
        onChange(0)
        return
      }

      // Allow typing minus sign
      if (allowNegative && input === "-") {
        setLocalValue("-")
        return
      }

      // Allow typing decimal point
      if (input === "." || input === "-.") {
        setLocalValue(input)
        return
      }

      // Validate input format (allow partial decimals during typing)
      const validPattern = allowNegative
        ? /^-?\d*\.?\d*$/
        : /^\d*\.?\d*$/

      if (!validPattern.test(input)) {
        return
      }

      setLocalValue(input)

      // Parse and update if valid number
      const numValue = parseFloat(input)
      if (!isNaN(numValue)) {
        // Apply constraints without rounding during typing
        let constrained = numValue
        if (min !== undefined && constrained < min) {
          constrained = min
        }
        if (max !== undefined && constrained > max) {
          constrained = max
        }
        onChange(constrained)
      }
    },
    [allowNegative, min, max, onChange]
  )

  // Handle blur - format the value
  const handleBlur = useCallback(() => {
    setIsFocused(false)

    const numValue = parseValue(localValue)
    onChange(numValue)

    if (formatOnBlur) {
      setLocalValue(numValue === 0 ? "" : numValue.toFixed(decimals))
    }

    onBlur?.()
  }, [localValue, parseValue, onChange, formatOnBlur, onBlur, decimals])

  // Handle focus
  const handleFocus = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true)
      // Select all text on focus for easy replacement
      e.target.select()
      onFocus?.()
    },
    [onFocus]
  )

  // Size classes
  const sizeClasses = {
    sm: "h-8 text-sm px-2",
    default: "h-10 px-3",
    lg: "h-12 text-lg px-4",
  }

  // Alignment classes
  const alignClasses = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  }

  return (
    <Input
      id={id}
      name={name}
      type="text"
      inputMode="decimal"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(
        "font-mono tabular-nums",
        sizeClasses[size],
        alignClasses[align],
        className
      )}
      autoComplete="off"
    />
  )
}

/**
 * Format a number as currency string
 */
export function formatCurrency(
  value: number,
  options?: {
    decimals?: number
    prefix?: string
    suffix?: string
    locale?: string
  }
): string {
  const { decimals = 2, prefix = "", suffix = "", locale = "en-US" } = options || {}

  const formatted = value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  return `${prefix}${formatted}${suffix}`
}

/**
 * Format a number with MVR suffix (Maldivian Rufiyaa)
 */
export function formatMVR(value: number, decimals = 2): string {
  return formatCurrency(value, { decimals, suffix: " MVR" })
}
