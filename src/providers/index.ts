import type { DataSourceKind } from '../../shared/types'
import type { InstagramDataProvider } from './InstagramDataProvider'
import { ExternalProvider } from './ExternalProvider'
import { ImportedDataProvider } from './ImportedDataProvider'
import { MetaInstagramProvider } from './MetaInstagramProvider'

const registry: Record<DataSourceKind, InstagramDataProvider> = {
  meta: new MetaInstagramProvider(),
  external: new ExternalProvider(),
  imported: new ImportedDataProvider(),
}

export function getProvider(kind: DataSourceKind): InstagramDataProvider {
  return registry[kind]
}

export type { InstagramDataProvider }
