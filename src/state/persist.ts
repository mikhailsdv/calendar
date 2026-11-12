import {isLang, type Lang, MAX_COUNTRIES, STORAGE_KEY} from '../config'

export type View = 'year' | 'month' | 'lanes'
export type Theme = 'light' | 'dark'

/** Настройки, которые переживают перезагрузку страницы */
export interface Settings {
	theme: Theme
	/** Только явно выбранный язык; автоопределение сюда не пишет */
	lang: Lang | null
	/** Активные страны по порядку, первая — основная */
	countries: string[]
	view: View
	weekStart: 'auto' | 1 | 7
	hoursNorm: 40 | 36 | 24
	showObservances: boolean
	/** Колонка с номерами ISO-недель в месячном виде */
	showWeekNumbers: boolean
	budget: number
}

const VIEWS: View[] = ['year', 'month', 'lanes']

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
	const budget = Number(value.budget)
	return {
		theme: pick(value.theme, ['light', 'dark'] as const, defaults.theme),
		lang: isLang(value.lang) ? value.lang : defaults.lang,
		countries: countries.length
			? (countries as string[]).slice(0, MAX_COUNTRIES)
			: defaults.countries,
		view: pick(value.view, VIEWS, defaults.view),
		weekStart: pick(value.weekStart, ['auto', 1, 7] as const, defaults.weekStart),
		hoursNorm: pick(value.hoursNorm, [40, 36, 24] as const, defaults.hoursNorm),
		showObservances:
			typeof value.showObservances === 'boolean' ? value.showObservances : defaults.showObservances,
		showWeekNumbers:
			typeof value.showWeekNumbers === 'boolean' ? value.showWeekNumbers : defaults.showWeekNumbers,
		budget: Number.isInteger(budget) && budget >= 1 && budget <= 60 ? budget : defaults.budget,
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
