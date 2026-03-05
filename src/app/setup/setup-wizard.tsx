"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, ChevronRight, ChevronLeft, Loader2 } from "lucide-react"

type Step = 1 | 2 | 3

interface FormData {
  name: string
  username: string
  password: string
  confirmPassword: string
  bankBalance: string
  bankDate: string
  walletBalance: string
  walletDate: string
}

const today = new Date().toISOString().slice(0, 10)

const initialForm: FormData = {
  name: "",
  username: "",
  password: "",
  confirmPassword: "",
  bankBalance: "0",
  bankDate: today,
  walletBalance: "0",
  walletDate: today,
}

const STEPS = [
  { num: 1 as Step, label: "Owner Account" },
  { num: 2 as Step, label: "Bank Balance" },
  { num: 3 as Step, label: "Wallet Balance" },
]

export function SetupWizard() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<FormData>(initialForm)
  const [errors, setErrors] = useState<Partial<FormData>>({})
  const [submitError, setSubmitError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function validateStep1(): boolean {
    const errs: Partial<FormData> = {}
    if (!form.name.trim()) errs.name = "Name is required"
    if (!form.username.trim()) errs.username = "Username is required"
    else if (form.username.length < 3) errs.username = "At least 3 characters"
    else if (!/^[a-zA-Z0-9_]+$/.test(form.username)) errs.username = "Letters, numbers and underscores only"
    if (!form.password) errs.password = "Password is required"
    else if (form.password.length < 8) errs.password = "At least 8 characters"
    else if (!/[a-z]/.test(form.password)) errs.password = "Must contain a lowercase letter"
    else if (!/[A-Z]/.test(form.password)) errs.password = "Must contain an uppercase letter"
    else if (!/[0-9]/.test(form.password)) errs.password = "Must contain a number"
    if (form.password !== form.confirmPassword) errs.confirmPassword = "Passwords do not match"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function validateStep2(): boolean {
    const errs: Partial<FormData> = {}
    const val = parseFloat(form.bankBalance)
    if (isNaN(val) || val < 0) errs.bankBalance = "Enter a valid amount (0 or more)"
    if (!form.bankDate) errs.bankDate = "Date is required"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function validateStep3(): boolean {
    const errs: Partial<FormData> = {}
    const val = parseFloat(form.walletBalance)
    if (isNaN(val) || val < 0) errs.walletBalance = "Enter a valid amount (0 or more)"
    if (!form.walletDate) errs.walletDate = "Date is required"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleNext() {
    if (step === 1 && validateStep1()) setStep(2)
    else if (step === 2 && validateStep2()) setStep(3)
  }

  async function handleComplete() {
    if (!validateStep3()) return
    setIsSubmitting(true)
    setSubmitError("")

    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: {
            name: form.name.trim(),
            username: form.username.trim(),
            password: form.password,
          },
          bank: {
            openingBalance: parseFloat(form.bankBalance) || 0,
            openingDate: form.bankDate,
          },
          wallet: {
            openingBalance: parseFloat(form.walletBalance) || 0,
            openingDate: form.walletDate,
          },
        }),
      })

      const data = await res.json()
      if (!data.success) {
        setSubmitError(data.error || "Setup failed")
        setIsSubmitting(false)
        return
      }

      // Auto-login the new owner
      const result = await signIn("credentials", {
        username: form.username.trim(),
        password: form.password,
        redirect: false,
      })

      if (result?.ok) {
        router.push("/")
        router.refresh()
      } else {
        // Setup succeeded but login failed — send to login page
        router.push("/login")
      }
    } catch {
      setSubmitError("An unexpected error occurred")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Welcome to BalanceX</h1>
          <p className="text-sm text-muted-foreground">Complete setup to get started</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.num} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                  step > s.num
                    ? "bg-emerald-600 text-white"
                    : step === s.num
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s.num ? <CheckCircle2 className="h-4 w-4" /> : s.num}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-px w-8 ${step > s.num ? "bg-emerald-600" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1 — Owner Account */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Owner Account</CardTitle>
              <CardDescription>Create the administrator account for this system</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Full Name" error={errors.name}>
                <Input placeholder="e.g. Ahmed Ali" value={form.name} onChange={set("name")} autoFocus />
              </Field>
              <Field label="Username" error={errors.username}>
                <Input placeholder="e.g. owner" value={form.username} onChange={set("username")} autoComplete="username" />
              </Field>
              <Field label="Password" error={errors.password}>
                <Input type="password" placeholder="Min. 8 characters" value={form.password} onChange={set("password")} autoComplete="new-password" />
              </Field>
              <Field label="Confirm Password" error={errors.confirmPassword}>
                <Input type="password" placeholder="Re-enter password" value={form.confirmPassword} onChange={set("confirmPassword")} autoComplete="new-password" />
              </Field>
              <Button className="w-full" onClick={handleNext}>
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2 — Bank Opening Balance */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Bank Opening Balance</CardTitle>
              <CardDescription>
                The bank balance before any transactions were recorded in this system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Opening Balance (MVR)" error={errors.bankBalance}>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.bankBalance}
                  onChange={set("bankBalance")}
                  autoFocus
                />
              </Field>
              <Field label="As of Date" error={errors.bankDate}>
                <Input type="date" value={form.bankDate} onChange={set("bankDate")} />
              </Field>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                <Button className="flex-1" onClick={handleNext}>
                  Next <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3 — Wallet Opening Balance */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Wallet Opening Balance</CardTitle>
              <CardDescription>
                The telco wallet balance before any top-ups or sales were recorded in this system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Opening Balance (MVR)" error={errors.walletBalance}>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.walletBalance}
                  onChange={set("walletBalance")}
                  autoFocus
                />
              </Field>
              <Field label="As of Date" error={errors.walletDate}>
                <Input type="date" value={form.walletDate} onChange={set("walletDate")} />
              </Field>
              {submitError && (
                <p className="text-sm text-destructive">{submitError}</p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(2)} disabled={isSubmitting}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                <Button className="flex-1" onClick={handleComplete} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Setting up…</>
                  ) : (
                    "Complete Setup"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Step {step} of {STEPS.length} — {STEPS[step - 1].label}
        </p>
      </div>
    </div>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
