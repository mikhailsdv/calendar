import {type Dict, fmt} from '../i18n'

/**
 * Заголовок страницы календаря. У страницы года (/ru/2027/) год стоит в начале,
 * у страницы текущего года (/ru/) — в конце. Общий для пререндера и клиента.
 */
export const calendarTitle = (t: Dict, year: number, yearPage: boolean) =>
	yearPage ? fmt(t.meta.title, {year}) : `${t.meta.titleCurrent} · ${year}`
