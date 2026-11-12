/** Дата в формате YYYY-MM-DD. Вся арифметика в UTC, чтобы не зависеть от часового пояса */
export type ISODate = string

const DAY_MS = 86_400_000

const pad = (n: number) => String(n).padStart(2, '0')

export const toISO = (year: number, month: number, day: number): ISODate =>
	`${year}-${pad(month)}-${pad(day)}`

export const parseISO = (date: ISODate) => {
	const [year, month, day] = date.split('-').map(Number) as [number, number, number]
	return {year, month, day}
}

const toUTC = (date: ISODate) => {
	const {year, month, day} = parseISO(date)
	return Date.UTC(year, month - 1, day)
}

const fromUTC = (ms: number): ISODate => {
	const d = new Date(ms)
	return toISO(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

export const addDays = (date: ISODate, days: number) => fromUTC(toUTC(date) + days * DAY_MS)

/** Сколько дней от a до b (b − a) */
export const diffDays = (a: ISODate, b: ISODate) => Math.round((toUTC(b) - toUTC(a)) / DAY_MS)

/** 1 — понедельник … 7 — воскресенье */
export const isoWeekday = (date: ISODate) => {
	const day = new Date(toUTC(date)).getUTCDay()
	return day === 0 ? 7 : day
}

export const yearOf = (date: ISODate) => Number(date.slice(0, 4))

export const monthOf = (date: ISODate) => Number(date.slice(5, 7))

export const daysInMonth = (year: number, month: number) =>
	new Date(Date.UTC(year, month, 0)).getUTCDate()

export const isLeapYear = (year: number) => daysInMonth(year, 2) === 29

export const minDate = (a: ISODate, b: ISODate) => (a < b ? a : b)
export const maxDate = (a: ISODate, b: ISODate) => (a > b ? a : b)

/** Все даты от from до to включительно */
export const eachDay = (from: ISODate, to: ISODate): ISODate[] => {
	const result: ISODate[] = []
	for (let d = from; d <= to; d = addDays(d, 1)) result.push(d)
	return result
}

/** Номер недели по ISO 8601 */
export const isoWeekNumber = (date: ISODate) => {
	const thursday = addDays(date, 4 - isoWeekday(date))
	const firstOfYear = toISO(yearOf(thursday), 1, 1)
	return Math.floor(diffDays(firstOfYear, thursday) / 7) + 1
}

/** Сегодня в локальном часовом поясе пользователя */
export const todayISO = (now = new Date()): ISODate =>
	toISO(now.getFullYear(), now.getMonth() + 1, now.getDate())

/**
 * Сетка месяца по неделям: массив недель по 7 ячеек, null — дни соседних месяцев.
 * weekStart: 1 — неделя с понедельника, 7 — с воскресенья.
 */
export const monthGrid = (year: number, month: number, weekStart: 1 | 7) => {
	const first = toISO(year, month, 1)
	const lead = (isoWeekday(first) - weekStart + 7) % 7
	const cells: (ISODate | null)[] = Array.from({length: lead}, () => null)
	for (let day = 1; day <= daysInMonth(year, month); day++) cells.push(toISO(year, month, day))
	while (cells.length % 7) cells.push(null)
	const weeks: (ISODate | null)[][] = []
	for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
	return weeks
}

/** ISO-дни недели в порядке отображения */
export const weekdayOrder = (weekStart: 1 | 7) =>
	weekStart === 1 ? [1, 2, 3, 4, 5, 6, 7] : [7, 1, 2, 3, 4, 5, 6]
