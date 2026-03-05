/**
 * Environment variable validation.
 * Validates required environment variables on startup.
 */

interface EnvConfig {
  /** Required environment variables that must be set */
  required: string[]
  /** Optional environment variables with default values */
  optional: Record<string, string>
}

const envConfig: EnvConfig = {
  required: [
    "DATABASE_URL",
    "NEXTAUTH_SECRET",
  ],
  optional: {
    NEXTAUTH_URL: "http://localhost:3000",
    NODE_ENV: "development",
    // Variance thresholds
    VARIANCE_CASH_BLOCK_LIMIT: "500",
    VARIANCE_WALLET_BLOCK_LIMIT: "500",
  },
}

/**
 * Validate that all required environment variables are set.
 * Throws an error if any required variable is missing.
 * Should be called during application startup.
 */
export function validateEnv(): void {
  const missing: string[] = []

  for (const key of envConfig.required) {
    if (!process.env[key]) {
      missing.push(key)
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n  - ${missing.join("\n  - ")}\n\n` +
      `Please ensure these variables are set in your .env file or environment.`
    )
  }
}

/**
 * Get an environment variable with an optional default value.
 * For required variables, use process.env directly after validateEnv().
 */
export function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key]
  if (value !== undefined) {
    return value
  }
  if (defaultValue !== undefined) {
    return defaultValue
  }
  if (key in envConfig.optional) {
    return envConfig.optional[key]
  }
  throw new Error(`Environment variable ${key} is not set and has no default value`)
}

/**
 * Get a numeric environment variable.
 */
export function getEnvNumber(key: string, defaultValue?: number): number {
  const value = process.env[key]
  if (value !== undefined) {
    const num = Number(value)
    if (!isNaN(num)) {
      return num
    }
  }
  if (defaultValue !== undefined) {
    return defaultValue
  }
  throw new Error(`Environment variable ${key} is not set or is not a valid number`)
}

/**
 * Get a boolean environment variable.
 * Recognizes: "true", "1", "yes" as true; "false", "0", "no" as false.
 */
export function getEnvBoolean(key: string, defaultValue?: boolean): boolean {
  const value = process.env[key]?.toLowerCase()
  if (value !== undefined) {
    if (["true", "1", "yes"].includes(value)) {
      return true
    }
    if (["false", "0", "no"].includes(value)) {
      return false
    }
  }
  if (defaultValue !== undefined) {
    return defaultValue
  }
  throw new Error(`Environment variable ${key} is not set or is not a valid boolean`)
}

// Validate environment on module load in production
// In development, Next.js handles .env loading
if (process.env.NODE_ENV === "production") {
  validateEnv()
}
