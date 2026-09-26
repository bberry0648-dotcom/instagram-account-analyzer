import type { AccountDataset, DataSourceKind } from '../../shared/types'

/** All browser storage goes through here. Only non-sensitive data — never tokens. */

const RECENT_KEY = 'iaa:recent'
const IMPORT_PREFIX = 'iaa:import:'
const MAX_RECENT = 10

export interface RecentEntry {
  username: string
  source: DataSourceKind
  analyzedAt: string
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function getRecent(): RecentEntry[] {
  const list = read<RecentEntry[]>(RECENT_KEY)
  return Array.isArray(list) ? list.filter((e) => e && typeof e.username === 'string').slice(0, MAX_RECENT) : []
}

export function addRecent(entry: RecentEntry): RecentEntry[] {
  const next = [entry, ...getRecent().filter((e) => !(e.username === entry.username && e.source === entry.source))].slice(
    0,
    MAX_RECENT,
  )
  write(RECENT_KEY, next)
  return next
}

export function removeRecent(username: string, source: DataSourceKind): RecentEntry[] {
  const next = getRecent().filter((e) => !(e.username === username && e.source === source))
  write(RECENT_KEY, next)
  if (source === 'imported') {
    try {
      localStorage.removeItem(IMPORT_PREFIX + username)
    } catch {
      /* ignore */
    }
  }
  return next
}

export function clearRecent(): void {
  for (const e of getRecent()) removeRecent(e.username, e.source)
  write(RECENT_KEY, [])
}

// In-memory fallback when localStorage is full or blocked (lost on reload).
const memoryImports = new Map<string, AccountDataset>()

/** Returns false if the dataset could only be kept in memory. */
export function saveImported(dataset: AccountDataset): boolean {
  memoryImports.set(dataset.profile.username, dataset)
  return write(IMPORT_PREFIX + dataset.profile.username, dataset)
}

export function loadImported(username: string): AccountDataset | null {
  return memoryImports.get(username) ?? read<AccountDataset>(IMPORT_PREFIX + username)
}
