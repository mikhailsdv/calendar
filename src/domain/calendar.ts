import type {Country, DayEntry, DayType, YearData, YearLookup} from '../data/types'
import {addDays, daysInMonth, type ISODate, isoWeekday, monthOf, toISO, yearOf} from './dates'

/**
 * Как день выглядит на календаре:
 * holiday — нерабочий праздник, transfer — выходной по переносу,
 * workweekend — рабочий день на выходном (рабочая суббота), short — сокращённый будний,
 * weekend — обычный выходной, work — обычный рабочий
 */
export type DayKind = 'holiday' | 'transfer' | 'workweekend' | 'short' | 'weekend' | 'work'

export interface DayInfo {
	date: ISODate
	kind: DayKind
	off: boolean
	/** Выходной по обычной неделе страны */
	weekend: boolean
	entry?: DayEntry
	/** id праздника без выходного (памятная дата, праздник при военном положении) */
	observance?: string
	shortBy: number
	/** По этому году нет данных: показываем только обычную неделю */
	noData: boolean
}

export const resolveDay = (
	country: Country,
	year: YearData | undefined,
	date: ISODate
): DayInfo => {
	const weekend = country.week.weekend.includes(isoWeekday(date))
	const entry = year?.days[date]
	const base = {date, weekend, entry, shortBy: entry?.shortBy ?? 0, noData: !year}
	switch (entry?.type) {
		case 'holiday':
			return {...base, kind: 'holiday', off: true}
		case 'dayoff':
			return {...base, kind: 'transfer', off: true}
		case 'workday':
			return {
				...base,
				kind: weekend ? 'workweekend' : base.shortBy ? 'short' : 'work',
				off: false,
			}
		case 'observance':
			return {...base, kind: weekend ? 'weekend' : 'work', off: weekend, observance: entry.holiday}
		default:
			return {...base, kind: weekend ? 'weekend' : 'work', off: weekend}
	}
}

export const dayOf = (country: Country, lookup: YearLookup, date: ISODate) =>
	resolveDay(country, lookup(country.id, yearOf(date)), date)

/** Рабочие часы дня для недельной нормы; null — норма не определена для страны */
export const dayHours = (country: Country, info: DayInfo, weekHours: number) => {
	const perDay = country.workTime.hoursPerDay[String(weekHours)]
	if (perDay == null) return null
	return info.off ? 0 : perDay - info.shortBy
}

/** Какие типы дней не списываются из отпуска в эту дату (учитывая особые режимы) */
export const leaveNotCountedOn = (
	country: Country,
	year: YearData | undefined,
	date: ISODate
): DayType[] => {
	const active = year?.regimes?.find(r => r.from <= date && date <= r.to)
	const regime = active && country.regimes?.[active.id]
	return regime ? regime.effects.leaveNotCounted : country.leave.notCounted
}

export const activeRegime = (country: Country, year: YearData | undefined, date: ISODate) => {
	const active = year?.regimes?.find(r => r.from <= date && date <= r.to)
	return active ? country.regimes?.[active.id] : undefined
}

export interface PeriodTotals {
	workdays: number
	offdays: number
	/** Дней с типом holiday, включая выпавшие на выходные */
	holidays: number
	/** Праздники, выпавшие на выходной и не давшие дня отдыха сверху */
	holidaysOnWeekend: number
	/** Часы по нормам 40/36/24; null — норма для страны не задана */
	hours: Record<string, number | null>
}

const NORMS = [40, 36, 24]

const emptyTotals = (): PeriodTotals => ({
	workdays: 0,
	offdays: 0,
	holidays: 0,
	holidaysOnWeekend: 0,
	hours: Object.fromEntries(NORMS.map(n => [String(n), 0])),
})

const addDay = (totals: PeriodTotals, country: Country, info: DayInfo) => {
	if (info.off) totals.offdays++
	else totals.workdays++
	if (info.kind === 'holiday') {
		totals.holidays++
		if (info.weekend) totals.holidaysOnWeekend++
	}
	for (const norm of NORMS) {
		const key = String(norm)
		const hours = dayHours(country, info, norm)
		const prev = totals.hours[key]
		totals.hours[key] = hours == null || prev == null ? null : prev + hours
	}
}

const roundHours = (totals: PeriodTotals) => {
	for (const key of Object.keys(totals.hours)) {
		const value = totals.hours[key]
		if (value != null) totals.hours[key] = Math.round(value * 10) / 10
	}
	return totals
}

/** Итоги года и по месяцам; считаются из данных, а не хранятся в них */
export const yearTotals = (country: Country, data: YearData | undefined, year: number) => {
	const total = emptyTotals()
	const months = Array.from({length: 12}, emptyTotals)
	for (let m = 1; m <= 12; m++) {
		for (let d = 1; d <= daysInMonth(year, m); d++) {
			const info = resolveDay(country, data, toISO(year, m, d))
			addDay(total, country, info)
			addDay(months[m - 1]!, country, info)
		}
	}
	return {total: roundHours(total), months: months.map(roundHours)}
}

/** Рабочие дни строго после from и до to включительно */
export const workdaysBetween = (
	country: Country,
	lookup: YearLookup,
	from: ISODate,
	to: ISODate
) => {
	let count = 0
	for (let d = addDays(from, 1); d <= to; d = addDays(d, 1)) {
		if (!dayOf(country, lookup, d).off) count++
	}
	return count
}

/** Праздники и переносы года списком, по порядку дат */
export const yearEvents = (data: YearData | undefined) =>
	Object.entries(data?.days ?? {})
		.filter(([, entry]) => entry.type !== 'workday' || entry.transfer)
		.map(([date, entry]) => ({date, entry, month: monthOf(date)}))
