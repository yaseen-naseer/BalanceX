import { describe, expect, it } from "vitest"
import { getVarianceStatus } from "./cash-drawer"

describe("getVarianceStatus", () => {
  it("returns 'ok' for zero variance", () => {
    expect(getVarianceStatus(0)).toBe("ok")
  })

  it("returns 'warning' for variance within ±500", () => {
    expect(getVarianceStatus(1)).toBe("warning")
    expect(getVarianceStatus(-1)).toBe("warning")
    expect(getVarianceStatus(500)).toBe("warning")
    expect(getVarianceStatus(-500)).toBe("warning")
  })

  it("returns 'block' for variance above ±500", () => {
    expect(getVarianceStatus(501)).toBe("block")
    expect(getVarianceStatus(-501)).toBe("block")
    expect(getVarianceStatus(10_000)).toBe("block")
  })
})
