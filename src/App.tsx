import type { DataSourceKind } from '../shared/types'
import { isValidUsername } from '../shared/username'
import { lazy, Suspense } from 'react'
import { HomePage } from './pages/HomePage'
import { useRoute } from './lib/router'

// Recharts + dashboard load only when an account is opened.
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))

const SOURCES: DataSourceKind[] = ['meta', 'external', 'imported']

export default function App() {
  const { path, query } = useRoute()
  if (path[0] === 'a' && SOURCES.includes(path[1] as DataSourceKind) && path[2] && isValidUsername(path[2])) {
    return (
      <Suspense fallback={null}>
        <DashboardPage
        key={`${path[1]}:${path[2]}`}
        source={path[1] as DataSourceKind}
        username={path[2]}
        tab={path[3] ?? 'overview'}
        period={query.get('period')}
        />
      </Suspense>
    )
  }
  return <HomePage />
}
