import {describe, expect, it} from 'vitest'

import {country, lookupAll} from '../test/data'
import {activeRegime, dayHours, dayOf, workdaysBetween, yearTotals} from './calendar'

const ru = country('ru')
const by = country('by')
const ua = country('ua')
const am = country('am')

describe('resolveDay', () => {
	it('separates holidays from transferred days off', () => {
		expect(dayOf(ru, lookupAll, '2026-05-09').kind).toBe('holiday')
		const transfer = dayOf(ru, lookupAll, '2026-05-11')
		expect(transfer.kind).toBe('transfer')
		expect(transfer.off).toBe(true)
		expect(transfer.entry?.transfer?.from).toBe('2026-05-09')
	})

	it('marks working Saturdays and shortened days', () => {
		const saturday = dayOf(ru, lookupAll, '2027-02-20')
		expect(saturday.kind).toBe('workweekend')
		expect(saturday.off).toBe(false)
		expect(dayHours(ru, saturday, 40)).toBe(7)
		const short = dayOf(ru, lookupAll, '2027-04-30')
		expect(short.kind).toBe('short')
		expect(dayHours(ru, short, 36)).toBeCloseTo(6.2)
	})

	it('keeps the shortened length on a transferred Belarusian Saturday', () => {
		const info = dayOf(by, lookupAll, '2026-04-25')
		expect(info.kind).toBe('workweekend')
		expect(info.shortBy).toBe(1)
	})

	it('treats Ukrainian holidays under martial law as working days', () => {
		const info = dayOf(ua, lookupAll, '2026-08-24')
		expect(info.off).toBe(false)
		expect(info.kind).toBe('work')
		expect(info.observance).toBe('independence_day')
		expect(activeRegime(ua, lookupAll('ua', 2026), '2026-08-24')?.effects.holidaysOff).toBe(false)
	})

	it('does not move Armenian holidays from weekends', () => {
		expect(dayOf(am, lookupAll, '2027-05-01').kind).toBe('holiday')
		expect(dayOf(am, lookupAll, '2027-05-03').kind).toBe('work')
	})

	it('falls back to the weekly pattern without data', () => {
		const info = dayOf(ru, lookupAll, '2035-01-01')
		expect(info.noData).toBe(true)
		expect(info.kind).toBe('work')
	})

	it('returns null hours for norms a country does not define', () => {
		expect(dayHours(am, dayOf(am, lookupAll, '2027-05-04'), 36)).toBeNull()
	})
})

describe('totals', () => {
	it('counts the Russian year', () => {
		const {total, months} = yearTotals(ru, lookupAll('ru', 2027), 2027)
		expect(total.workdays).toBe(247)
		expect(total.offdays).toBe(118)
		expect(total.hours['40']).toBe(1972)
		expect(months[0]!.workdays).toBe(15)
		expect(months[1]!.hours['40']).toBe(151)
	})

	it('counts holidays lost on weekends', () => {
		const {total} = yearTotals(am, lookupAll('am', 2027), 2027)
		expect(total.holidaysOnWeekend).toBe(4)
	})

	it('counts working days until a date', () => {
		expect(workdaysBetween(ru, lookupAll, '2027-04-30', '2027-05-11')).toBe(5)
	})
})
