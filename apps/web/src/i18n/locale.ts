import { type Locale, resolveLocale } from '@gonggong/protocol'

const KEY = 'gg.locale'

function stored() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

const saved = stored()
export const locale: Locale = saved === 'zh' || saved === 'en' ? saved : resolveLocale(navigator.language)

/** Every text is resolved once at load, so a switch reloads the page. */
export function setLocale(next: Locale) {
  try {
    localStorage.setItem(KEY, next)
  } catch {}
  location.reload()
}
