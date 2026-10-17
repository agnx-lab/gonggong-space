import { createTranslator } from '@gonggong/protocol'
import { locale } from '@web/i18n/locale'
import type { en } from './en'

export { locale, setLocale } from '@web/i18n/locale'

// Same as the web app: only English downloads the dictionary.
const dict = locale === 'en' ? (await import('./en')).en : ({} as typeof en)
export const t = createTranslator(locale, dict)
