import { describe, expect, it } from "vitest"
import { toNum } from "./decimal"

describe("toNum", () => {
  it("returns 0 for null and undefined", () => {
    expect(toNum(null)).toBe(0)
    expect(toNum(undefined)).toBe(0)
  })

  it("returns numbers as-is", () => {
    expect(toNum(42)).toBe(42)
    expect(toNum(0)).toBe(0)
    expect(toNum(-3.14)).toBe(-3.14)
  })

  it("parses string numbers", () => {
    expect(toNum("123.45")).toBe(123.45)
    expect(toNum("0")).toBe(0)
  })

  it("uses .toNumber() on Decimal-like objects", () => {
    const fakeDecimal = { toNumber: () => 99.9 }
    expect(toNum(fakeDecimal)).toBe(99.9)
  })
})
