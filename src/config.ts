export const SITE_ORIGIN = 'https://calendar.mishasaidov.com'

export const LANGS = ['ru', 'en', 'kk', 'hy', 'be', 'uk'] as const
export type Lang = (typeof LANGS)[number]
export const DEFAULT_LANG: Lang = 'ru'

/** Названия языков на них самих: нужны селектору без загрузки всех словарей */
export const LANG_NAMES: Record<Lang, string> = {
	ru: 'Русский',
	en: 'English',
	kk: 'Қазақша',
	hy: 'Հայերեն',
	be: 'Беларуская',
	uk: 'Українська',
}

export const OG_LOCALES: Record<Lang, string> = {
	ru: 'ru_RU',
	en: 'en_US',
	kk: 'kk_KZ',
	hy: 'hy_AM',
	be: 'be_BY',
	uk: 'uk_UA',
}

/** Сколько стран можно наложить одновременно */
export const MAX_COUNTRIES = 5

export const STORAGE_KEY = 'workcalendar:settings:v1'

export const AUTHOR_LINKS = {
	telegramChannel: 'https://t.me/FilteredInternet',
	telegramDm: 'https://t.me/mikhailsdv',
	cv: 'https://cv.mishasaidov.com/',
	projects: 'https://articles.mishasaidov.com/projects',
} as const

export const isLang = (value: unknown): value is Lang =>
	typeof value === 'string' && (LANGS as readonly string[]).includes(value)
