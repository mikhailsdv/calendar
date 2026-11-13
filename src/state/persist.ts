import {isLang, type Lang, MAX_COUNTRIES, STORAGE_KEY} from '../config'

export type View = 'year' | 'month'
export type Theme = 'light' | 'dark'

/** Настройки, которые переживают перезагрузку страницы */
export interface Settings {
	theme: Theme
	/** Только явно выбранный язык; автоопределение сюда не пишет */
	lang: Lang | null
	/** Выбранные для сравнения страны по порядку, первая — основная. Помнятся и при выключенном сравнении */
	countries: string[]
	/** Сравнение включено: на календаре все выбранные страны, иначе только основная */
	compare: boolean
	view: View
	weekStart: 'auto' | 1 | 7
	hoursNorm: 40 | 36 | 24
	/** Пятидневная или шестидневная рабочая неделя */
	workWeek: 5 | 6
	/** Колонка с номерами ISO-недель в месячном виде */
	showWeekNumbers: boolean
}

const VIEWS: View[] = ['year', 'month']

const pick = <T>(value: unknown, allowed: readonly T[], fallback: T): T =>
	allowed.includes(value as T) ? (value as T) : fallback

/** Приводит что угодно из localStorage к валидным настройкам, подставляя значения по умолчанию */
export const sanitizeSettings = (
	raw: unknown,
	defaults: Settings,
	knownCountries: string[]
): Settings => {
	const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
	const countries = Array.isArray(value.countries)
		? [...new Set(value.countries.filter(id => knownCountries.includes(id as string)))]
		: []
	return {
		theme: pick(value.theme, ['light', 'dark'] as const, defaults.theme),
		lang: isLang(value.lang) ? value.lang : defaults.lang,
		countries: countries.length
			? (countries as string[]).slice(0, MAX_COUNTRIES)
			: defaults.countries,
		// Старые настройки без флага: несколько стран значит, что человек уже сравнивал
		compare: typeof value.compare === 'boolean' ? value.compare : countries.length > 1,
		view: pick(value.view, VIEWS, defaults.view),
		weekStart: pick(value.weekStart, ['auto', 1, 7] as const, defaults.weekStart),
		hoursNorm: pick(value.hoursNorm, [40, 36, 24] as const, defaults.hoursNorm),
		workWeek: pick(value.workWeek, [5, 6] as const, defaults.workWeek),
		showWeekNumbers:
			typeof value.showWeekNumbers === 'boolean' ? value.showWeekNumbers : defaults.showWeekNumbers,
	}
}

const storage = (): Storage | null => {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage
	} catch {
		return null
	}
}

export const loadSettings = (defaults: Settings, knownCountries: string[]): Settings => {
	try {
		const raw = storage()?.getItem(STORAGE_KEY)
		return sanitizeSettings(raw ? JSON.parse(raw) : null, defaults, knownCountries)
	} catch {
		return defaults
	}
}

export const saveSettings = (settings: Settings) => {
	try {
		storage()?.setItem(STORAGE_KEY, JSON.stringify(settings))
	} catch {
		// Приватный режим или переполненное хранилище: настройки просто не сохранятся
	}
}
