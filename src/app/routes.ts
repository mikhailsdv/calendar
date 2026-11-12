import {isLang, type Lang, LANGS} from '../config'
import type {Country} from '../data/types'

export type Route =
	| {kind: 'root'}
	| {kind: 'app'; lang: Lang; year: number | null; country: string | null}
	| {kind: 'notFound'; lang: Lang}

/** Страницы страны: на каких языках и за какие годы они есть */
export interface CountryPage {
	id: string
	langs: Lang[]
	years: number[]
}

/** Страницы стран из профилей: языки берутся из поля pages, годы — из данных */
export const countryPages = (
	countries: Country[],
	yearsOf: (countryId: string) => number[]
): CountryPage[] =>
	countries.map(country => ({
		id: country.id,
		langs: LANGS.filter(lang => country.pages[lang]),
		years: yearsOf(country.id),
	}))

/** /ru/, /ru/2027/, /ru/kz/, /ru/kz/2027/ */
export const pathFor = (lang: Lang, year: number | null = null, country: string | null = null) =>
	`/${lang}/${country ? `${country}/` : ''}${year == null ? '' : `${year}/`}`

/**
 * Страницы, которые отличаются только языком. Общие страницы есть на всех языках,
 * страницы стран — только на языках из белого списка страны. Нужны для пререндера, hreflang и sitemap
 */
export const pageGroups = (years: number[], countries: CountryPage[]) => [
	...[null, ...years].map(year => LANGS.map(lang => ({lang, path: pathFor(lang, year)}))),
	...countries.flatMap(country =>
		[null, ...country.years].map(year =>
			country.langs.map(lang => ({lang, path: pathFor(lang, year, country.id)}))
		)
	),
]

/** Все страницы для пререндера и sitemap */
export const allPaths = (years: number[], countries: CountryPage[]) => [
	'/',
	...pageGroups(years, countries).flatMap(group => group.map(page => page.path)),
]

const yearOrNull = (part: string | undefined, years: number[]) =>
	part != null && /^\d{4}$/.test(part) && years.includes(Number(part)) ? Number(part) : null

export const parseRoute = (pathname: string, years: number[], countries: CountryPage[]): Route => {
	const parts = pathname.split('/').filter(Boolean)
	if (parts.length === 0) return {kind: 'root'}
	const [first, second, third, ...rest] = parts
	const lang = isLang(first) ? first : null
	if (!lang) return {kind: 'notFound', lang: 'ru'}
	if (second == null) return {kind: 'app', lang, year: null, country: null}

	const year = yearOrNull(second, years)
	if (year != null && third == null) return {kind: 'app', lang, year, country: null}

	const country = countries.find(c => c.id === second && c.langs.includes(lang))
	if (country && rest.length === 0) {
		if (third == null) return {kind: 'app', lang, year: null, country: country.id}
		const countryYear = yearOrNull(third, country.years)
		if (countryYear != null) return {kind: 'app', lang, year: countryYear, country: country.id}
	}
	return {kind: 'notFound', lang}
}
