import { type ComponentType, lazy } from 'react'

/** `React.lazy` for a named export. */
// biome-ignore lint/suspicious/noExplicitAny: the bound React.lazy itself puts on a component
export const named = <K extends string, M extends Record<K, ComponentType<any>>>(
  load: () => Promise<M>,
  name: K,
) => lazy(() => load().then((m) => ({ default: m[name] })))
