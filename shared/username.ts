const USERNAME_RE = /^[a-z0-9._]{1,30}$/

/** Instagram usernames: 1–30 chars of a-z 0-9 . _, no leading/trailing or doubled dots. */
export function isValidUsername(u: string): boolean {
  return USERNAME_RE.test(u) && !u.startsWith('.') && !u.endsWith('.') && !u.includes('..')
}
