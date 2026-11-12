import {isLang, type Lang, LANGS} from '../config'

export type Route =
	{kind: 'root'} | {kind: 'app'; lang: Lang; year: number | null} | {kind: 'notFound'; lang: Lang}

export const pathFor = (lang: Lang, year: number | null = null) =>
	year == null ? `/${lang}/` : `/${lang}/${year}/`

/** Все страницы для пререндера и sitemap */
export const allPaths = (years: number[]) => [
	'/',
	...LANGS.flatMap(lang => [pathFor(lang), ...years.map(year => pathFor(lang, year))]),
]

export const parseRoute = (pathname: string, years: number[]): Route => {
	const parts = pathname.split('/').filter(Boolean)
	if (parts.length === 0) return {kind: 'root'}
	const [first, second, ...rest] = parts
	const lang = isLang(first) ? first : null
	if (!lang) return {kind: 'notFound', lang: 'ru'}
	if (second == null) return {kind: 'app', lang, year: null}
	const year = Number(second)
	if (rest.length === 0 && /^\d{4}$/.test(second) && years.includes(year)) {
		return {kind: 'app', lang, year}
	}
	return {kind: 'notFound', lang}
}
