import {describe, expect, it} from 'vitest'

import {
	addDays,
	diffDays,
	eachDay,
	isoWeekday,
	isoWeekNumber,
	monthGrid,
	todayISO,
	weekdayOrder,
} from './dates'

describe('dates', () => {
	it('adds days across months and years', () => {
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
		expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
		expect(addDays('2027-03-01', -1)).toBe('2027-02-28')
	})

	it('counts differences', () => {
		expect(diffDays('2026-11-12', '2027-05-10')).toBe(179)
		expect(eachDay('2027-05-01', '2027-05-03')).toEqual(['2027-05-01', '2027-05-02', '2027-05-03'])
	})

	it('returns ISO weekdays', () => {
		expect(isoWeekday('2027-05-01')).toBe(6)
		expect(isoWeekday('2027-05-02')).toBe(7)
		expect(isoWeekday('2027-05-03')).toBe(1)
	})

	it('computes ISO week numbers', () => {
		expect(isoWeekNumber('2027-01-01')).toBe(53)
		expect(isoWeekNumber('2027-01-04')).toBe(1)
		expect(isoWeekNumber('2026-12-31')).toBe(53)
	})

	it('builds a month grid starting on Monday or Sunday', () => {
		const monday = monthGrid(2027, 5, 1)
		expect(monday[0]!.slice(0, 6)).toEqual([null, null, null, null, null, '2027-05-01'])
		const sunday = monthGrid(2027, 5, 7)
		expect(sunday[0]!.indexOf('2027-05-01')).toBe(6)
		expect(sunday[1]![0]).toBe('2027-05-02')
		expect(monday.every(week => week.length === 7)).toBe(true)
		expect(weekdayOrder(7)[0]).toBe(7)
	})

	it('formats today in local time', () => {
		expect(todayISO(new Date(2026, 10, 12, 23, 59))).toBe('2026-11-12')
	})
})
