import type {Lang} from '../config'
import type {Country} from '../data/types'
import {type Dict, fmt} from '../i18n'

/**
 * Заголовок общей страницы календаря. У страницы года (/ru/2027/) год стоит в начале,
 * у страницы текущего года (/ru/) — в конце. Общий для пререндера и клиента.
 */
export const calendarTitle = (t: Dict, year: number, yearPage: boolean) =>
	yearPage ? fmt(t.meta.title, {year}) : `${t.meta.titleCurrent} · ${year}`

/** Форма названия страны для заголовков её страниц; undefined — на этом языке страницы нет */
export const countryForm = (country: Country | undefined, lang: Lang) => country?.pages[lang]

/** Заголовок страницы страны: «Производственный календарь Казахстана на 2026 год: …» */
export const countryTitle = (t: Dict, form: string, year: number) =>
	fmt(t.meta.countryTitle, {country: form, year})
