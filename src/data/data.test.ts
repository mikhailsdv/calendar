import {describe, expect, it} from 'vitest'

import {LANGS} from '../config'
import {yearTotals} from '../domain/calendar'
import {isoWeekday} from '../domain/dates'
import {allCountries, allYears} from '../test/data'

const DAY_TYPES = ['holiday', 'dayoff', 'workday', 'observance']

describe('data/countries', () => {
	for (const c of Object.values(allCountries)) {
		describe(c.id, () => {
			it('has names in every language', () => {
				for (const lang of LANGS) expect(c.name[lang], lang).toBeTruthy()
				for (const [id, h] of Object.entries(c.holidays)) {
					for (const lang of LANGS) expect(h.name[lang], `${id}.${lang}`).toBeTruthy()
				}
			})

			it('has a valid week and leave rules', () => {
				expect([1, 7]).toContain(c.week.start)
				for (const d of c.week.weekend) expect(d >= 1 && d <= 7).toBe(true)
				expect(['calendar', 'working']).toContain(c.leave.unit)
				for (const t of c.leave.notCounted) expect(DAY_TYPES).toContain(t)
				expect(c.workTime.hoursPerDay['40']).toBeGreaterThan(0)
			})
		})
	}
})

describe('data/years', () => {
	for (const y of allYears) {
		const c = allCountries[y.country]!
		describe(`${y.country}/${y.year}`, () => {
			it('references known holidays and valid types', () => {
				expect(c).toBeTruthy()
				expect(['official', 'forecast']).toContain(y.status)
				expect(y.sources.length).toBeGreaterThan(0)
				for (const [date, entry] of Object.entries(y.days)) {
					expect(date.startsWith(String(y.year)), date).toBe(true)
					expect(DAY_TYPES).toContain(entry.type)
					if (entry.holiday) expect(c.holidays[entry.holiday], date).toBeTruthy()
					if (entry.regime) expect(c.regimes?.[entry.regime], date).toBeTruthy()
				}
			})

			it('has consistent transfers', () => {
				for (const [date, entry] of Object.entries(y.days)) {
					const weekend = c.week.weekend.includes(isoWeekday(date))
					if (entry.type === 'dayoff') {
						expect(weekend, `${date}: day off on a weekend`).toBe(false)
						const from = entry.transfer?.from
						expect(from, `${date}: day off without a source`).toBeTruthy()
						const source = y.days[from!]
						if (source?.type === 'workday') expect(source.transfer?.to).toBe(date)
						else
							expect(
								source?.type === 'holiday' || c.week.weekend.includes(isoWeekday(from!)),
								`${date}: source ${from} is neither a holiday nor a weekend`
							).toBe(true)
					}
					if (entry.type === 'workday' && entry.transfer?.to) {
						expect(weekend, `${date}: transferred workday on a weekday`).toBe(true)
						expect(y.days[entry.transfer.to]?.type).toBe('dayoff')
					}
				}
			})

			if (y.officialNorms) {
				it('matches official norms', () => {
					const {total} = yearTotals(c, y, y.year)
					if (y.officialNorms!.workdays != null) {
						expect(total.workdays).toBe(y.officialNorms!.workdays)
					}
					for (const [norm, hours] of Object.entries(y.officialNorms!.hours ?? {})) {
						expect(total.hours[norm], `hours ${norm}`).toBeCloseTo(hours, 1)
					}
				})
			}
		})
	}
})
