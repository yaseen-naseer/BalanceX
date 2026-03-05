"use client"

import { useState, useCallback, useMemo } from "react"

/**
 * Validator function type
 */
type Validator<T> = (value: T) => string | null

/**
 * Options for useFormField hook
 */
interface UseFormFieldOptions<T> {
  /** Initial value for the field */
  initialValue: T
  /** Validation function that returns error message or null */
  validator?: Validator<T>
  /** Whether to validate on change (default: only after blur) */
  validateOnChange?: boolean
}

/**
 * Return type for useFormField hook
 */
interface UseFormFieldReturn<T> {
  /** Current field value */
  value: T
  /** Validation error message, if any */
  error: string | null
  /** Whether the field has been interacted with */
  touched: boolean
  /** Whether the field value differs from initial */
  isDirty: boolean
  /** Whether the field is valid (no error) */
  isValid: boolean
  /** Handle value change */
  handleChange: (newValue: T) => void
  /** Handle field blur */
  handleBlur: () => void
  /** Reset field to initial state */
  reset: () => void
  /** Set value directly (without triggering validation) */
  setValue: (value: T) => void
  /** Set error directly */
  setError: (error: string | null) => void
  /** Validate the current value and return whether it's valid */
  validate: () => boolean
  /** Clear the touched state */
  clearTouched: () => void
}

/**
 * Hook for managing individual form field state with validation.
 *
 * Provides:
 * - Value management with dirty tracking
 * - Validation on blur (and optionally on change)
 * - Touched state for showing errors only after interaction
 * - Reset functionality
 *
 * @example
 * ```tsx
 * // Basic usage
 * const nameField = useFormField({
 *   initialValue: "",
 *   validator: (value) => value.length < 2 ? "Name must be at least 2 characters" : null
 * })
 *
 * <Input
 *   value={nameField.value}
 *   onChange={(e) => nameField.handleChange(e.target.value)}
 *   onBlur={nameField.handleBlur}
 * />
 * {nameField.touched && nameField.error && (
 *   <span className="text-red-500">{nameField.error}</span>
 * )}
 *
 * // With number input
 * const amountField = useFormField({
 *   initialValue: 0,
 *   validator: (value) => value < 0 ? "Amount cannot be negative" : null,
 *   validateOnChange: true
 * })
 * ```
 */
export function useFormField<T>(
  options: UseFormFieldOptions<T>
): UseFormFieldReturn<T> {
  const { initialValue, validator, validateOnChange = false } = options

  const [value, setValue] = useState<T>(initialValue)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  const isDirty = useMemo(() => value !== initialValue, [value, initialValue])
  const isValid = useMemo(() => error === null, [error])

  const validate = useCallback((): boolean => {
    if (validator) {
      const validationError = validator(value)
      setError(validationError)
      return validationError === null
    }
    return true
  }, [validator, value])

  const handleChange = useCallback(
    (newValue: T) => {
      setValue(newValue)
      if (validateOnChange || touched) {
        if (validator) {
          setError(validator(newValue))
        }
      }
    },
    [validateOnChange, touched, validator]
  )

  const handleBlur = useCallback(() => {
    setTouched(true)
    validate()
  }, [validate])

  const reset = useCallback(() => {
    setValue(initialValue)
    setError(null)
    setTouched(false)
  }, [initialValue])

  const clearTouched = useCallback(() => {
    setTouched(false)
  }, [])

  return useMemo(
    () => ({
      value,
      error,
      touched,
      isDirty,
      isValid,
      handleChange,
      handleBlur,
      reset,
      setValue,
      setError,
      validate,
      clearTouched,
    }),
    [
      value,
      error,
      touched,
      isDirty,
      isValid,
      handleChange,
      handleBlur,
      reset,
      setValue,
      setError,
      validate,
      clearTouched,
    ]
  )
}

/**
 * Common validators for form fields
 */
export const validators = {
  /** Require a non-empty value */
  required: (message = "This field is required") => (value: unknown) => {
    if (value === "" || value === null || value === undefined) {
      return message
    }
    if (typeof value === "string" && value.trim() === "") {
      return message
    }
    return null
  },

  /** Require minimum length for strings */
  minLength:
    (min: number, message?: string) =>
    (value: string): string | null => {
      if (value.length < min) {
        return message || `Must be at least ${min} characters`
      }
      return null
    },

  /** Require maximum length for strings */
  maxLength:
    (max: number, message?: string) =>
    (value: string): string | null => {
      if (value.length > max) {
        return message || `Must be at most ${max} characters`
      }
      return null
    },

  /** Require minimum numeric value */
  min:
    (min: number, message?: string) =>
    (value: number): string | null => {
      if (value < min) {
        return message || `Must be at least ${min}`
      }
      return null
    },

  /** Require maximum numeric value */
  max:
    (max: number, message?: string) =>
    (value: number): string | null => {
      if (value > max) {
        return message || `Must be at most ${max}`
      }
      return null
    },

  /** Require positive number */
  positive:
    (message = "Must be a positive number") =>
    (value: number): string | null => {
      if (value <= 0) {
        return message
      }
      return null
    },

  /** Require non-negative number */
  nonNegative:
    (message = "Cannot be negative") =>
    (value: number): string | null => {
      if (value < 0) {
        return message
      }
      return null
    },

  /** Validate email format */
  email:
    (message = "Invalid email address") =>
    (value: string): string | null => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (value && !emailRegex.test(value)) {
        return message
      }
      return null
    },

  /** Validate phone number format */
  phone:
    (message = "Invalid phone number") =>
    (value: string): string | null => {
      const phoneRegex = /^[\d\s\-+()]{7,}$/
      if (value && !phoneRegex.test(value)) {
        return message
      }
      return null
    },

  /** Combine multiple validators */
  compose:
    <T>(...validators: Validator<T>[]) =>
    (value: T): string | null => {
      for (const validator of validators) {
        const error = validator(value)
        if (error) return error
      }
      return null
    },
}

/**
 * Hook for managing multiple form fields together.
 *
 * @example
 * ```tsx
 * const form = useForm({
 *   name: { initialValue: "", validator: validators.required() },
 *   email: { initialValue: "", validator: validators.compose(
 *     validators.required(),
 *     validators.email()
 *   )},
 *   age: { initialValue: 0, validator: validators.min(18) }
 * })
 *
 * <Input
 *   value={form.fields.name.value}
 *   onChange={(e) => form.fields.name.handleChange(e.target.value)}
 *   onBlur={form.fields.name.handleBlur}
 * />
 *
 * const handleSubmit = () => {
 *   if (form.validateAll()) {
 *     console.log(form.values) // { name: "...", email: "...", age: ... }
 *   }
 * }
 * ```
 */
export function useForm<
  TFields extends Record<string, UseFormFieldOptions<unknown>>
>(fieldConfigs: TFields) {
  type FieldValues = {
    [K in keyof TFields]: TFields[K]["initialValue"]
  }

  // Create individual field hooks
  const fields = Object.fromEntries(
    Object.entries(fieldConfigs).map(([key, config]) => [
      key,
      // eslint-disable-next-line react-hooks/rules-of-hooks
      useFormField(config as UseFormFieldOptions<unknown>),
    ])
  ) as { [K in keyof TFields]: UseFormFieldReturn<TFields[K]["initialValue"]> }

  // Get all current values
  const values = Object.fromEntries(
    Object.entries(fields).map(([key, field]) => [key, field.value])
  ) as FieldValues

  // Check if any field is dirty
  const isDirty = Object.values(fields).some((field) => field.isDirty)

  // Check if all fields are valid
  const isValid = Object.values(fields).every((field) => field.isValid)

  // Validate all fields
  const validateAll = useCallback((): boolean => {
    let allValid = true
    Object.values(fields).forEach((field) => {
      if (!field.validate()) {
        allValid = false
      }
    })
    return allValid
  }, [fields])

  // Reset all fields
  const resetAll = useCallback(() => {
    Object.values(fields).forEach((field) => field.reset())
  }, [fields])

  return {
    fields,
    values,
    isDirty,
    isValid,
    validateAll,
    resetAll,
  }
}
