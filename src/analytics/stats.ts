export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}

/** 1-based rank from the top among `values` (ties share the better rank). */
export function rankFromTop(value: number, values: number[]): number {
  return values.filter((v) => v > value).length + 1
}

/** Fraction of values strictly below `value` (0..1). */
export function percentileBelow(value: number, values: number[]): number {
  if (values.length <= 1) return 0.5
  return values.filter((v) => v < value).length / (values.length - 1)
}

export function geometricMean(values: number[]): number | null {
  const pos = values.filter((v) => v > 0)
  if (values.length === 0) return null
  if (pos.length < values.length) {
    // any zero ratio → treat as a very small ratio instead of -Infinity
    values = values.map((v) => Math.max(v, 0.05))
  }
  return Math.exp(values.reduce((a, v) => a + Math.log(v), 0) / values.length)
}

export function nonNull<T>(v: T | null | undefined): v is T {
  return v !== null && v !== undefined
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

function logChoose(n: number, k: number): number {
  let s = 0
  for (let i = 1; i <= k; i++) s += Math.log((n - k + i) / i)
  return s
}

/** P(X ≥ k) for X ~ Binomial(n, p). */
export function binomialUpperTail(k: number, n: number, p: number): number {
  if (k <= 0) return 1
  if (p <= 0) return 0
  if (p >= 1) return 1
  let sum = 0
  for (let i = k; i <= n; i++) sum += Math.exp(logChoose(n, i) + i * Math.log(p) + (n - i) * Math.log(1 - p))
  return Math.min(1, sum)
}

/** P(X ≤ k) for X ~ Binomial(n, p). */
export function binomialLowerTail(k: number, n: number, p: number): number {
  return 1 - binomialUpperTail(k + 1, n, p)
}
