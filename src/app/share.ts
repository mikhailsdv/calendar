import {type Lang, MAX_COUNTRIES} from '../config'
import {addDays, diffDays, type ISODate, yearOf} from '../domain/dates'
import {pathFor} from './routes'

/** Отпуск, которым поделились ссылкой: страны по порядку и даты */
export interface SharedVacation {
	countries: string[]
	from: ISODate
	to: ISODate
}

/** Дольше года отпуск по ссылке не открываем: это скорее битая ссылка */
const MAX_DAYS = 366

/** Настоящая ли дата: 2027-02-30 сюда не пройдёт */
const isDate = (value: string | null): value is ISODate =>
	value != null && /^\d{4}-\d{2}-\d{2}$/.test(value) && addDays(value, 0) === value

/** Ссылка вида /ru/2027/?c=ru,kz&from=2027-05-04&to=2027-05-07 */
export const shareUrl = (origin: string, lang: Lang, {countries, from, to}: SharedVacation) => {
	const params = new URLSearchParams({c: countries.join(','), from, to})
	// Запятые оставляем как есть, чтобы ссылка читалась
	return `${origin}${pathFor(lang, yearOf(from))}?${params.toString().replace(/%2C/g, ',')}`
}

/** Разбирает ссылку; неизвестные страны отбрасывает, кривые даты и годы без данных — целиком */
export const readShared = (
	search: string,
	knownCountries: string[],
	years: number[]
): SharedVacation | null => {
	const params = new URLSearchParams(search)
	const from = params.get('from')
	const to = params.get('to')
	if (!isDate(from) || !isDate(to) || to < from || diffDays(from, to) >= MAX_DAYS) return null
	if (!years.includes(yearOf(from)) || !years.includes(yearOf(to))) return null
	const countries = [
		...new Set((params.get('c') ?? '').split(',').filter(id => knownCountries.includes(id))),
	].slice(0, MAX_COUNTRIES)
	return {countries, from, to}
}
