import { Suspense } from 'react'
import { named } from '../../lib/lazy'
import { Presence } from '../../ui'
import { useSettings } from './store'

const SettingsDialog = named(() => import('./SettingsDialog'), 'SettingsDialog')

/** Mounted once in the shell; `useSettings().open(page)` shows it. */
export function SettingsHost() {
  const page = useSettings((s) => s.page)
  const close = useSettings((s) => s.close)
  return (
    <Presence>
      {page ? (
        <Suspense fallback={null}>
          <SettingsDialog page={page} onClose={close} />
        </Suspense>
      ) : null}
    </Presence>
  )
}
