import type {Country, HolidayDef, YearLookup} from '../data/types'
import {dayOf} from './calendar'
import {addDays, diffDays, type ISODate} from './dates'
import {computeLeave} from './leave'

export interface UpcomingHoliday {
	date: ISODate
	/** Страны, у которых с этого дня начинается праздничный отдых, в порядке выбора */
	countries: Country[]
	/** Праздник первой из этих стран */
	holiday: HolidayDef | undefined
	/** Непрерывный отдых вокруг праздника в первой стране */
	rest: {from: ISODate; to: ISODate; days: number}
	daysUntil: number
}

/**
 * Ближайшие праздники выбранных стран. Праздники одной страны внутри одного отдыха
 * (новогодние каникулы) склеиваются в один пункт, общие для стран даты — тоже.
 */
export const upcomingHolidays = (
	countries: Country[],
	lookup: YearLookup,
	today: ISODate,
	{limit = 5, horizon = 365} = {}
): UpcomingHoliday[] => {
	const items: UpcomingHoliday[] = []
	/** До какого дня у страны уже учтён отдых */
	const coveredUntil = new Map<string, ISODate>()

	for (let d = today; diffDays(today, d) <= horizon && items.length < limit; d = addDays(d, 1)) {
		const fresh = countries.filter(country => {
			if (dayOf(country, lookup, d).kind !== 'holiday') return false
			const covered = coveredUntil.get(country.id)
			return !covered || covered < d
		})
		if (!fresh.length) continue
		for (const country of fresh) {
			coveredUntil.set(country.id, computeLeave(country, lookup, d, d).rest.to)
		}
		const first = fresh[0]!
		const entry = dayOf(first, lookup, d).entry
		items.push({
			date: d,
			countries: fresh,
			holiday: entry?.holiday ? first.holidays[entry.holiday] : undefined,
			rest: computeLeave(first, lookup, d, d).rest,
			daysUntil: diffDays(today, d),
		})
	}
	return items
}
