import {describe, expect, it} from 'vitest'

import {country, lookupAll} from '../test/data'
import {computeLeave} from './leave'

describe('computeLeave', () => {
	it('gives Russia 10 days of rest for 4 days of leave in May 2027', () => {
		const result = computeLeave(country('ru'), lookupAll, '2027-05-04', '2027-05-07')
		expect(result.charged).toBe(4)
		expect(result.rest).toEqual({from: '2027-05-01', to: '2027-05-10', days: 10})
	})

	it('charges transferred days off but not holidays in Russia', () => {
		const result = computeLeave(country('ru'), lookupAll, '2026-05-01', '2026-05-14')
		expect(result.calendarDays).toBe(14)
		expect(result.holidaysInside).toBe(2)
		expect(result.charged).toBe(12)
		expect(result.workdays).toBe(8)
	})

	it('does not charge Kazakh holidays', () => {
		const result = computeLeave(country('kz'), lookupAll, '2027-05-04', '2027-05-07')
		expect(result.charged).toBe(3)
		expect(result.rest.days).toBe(10)
	})

	it('gives Belarus no extra rest because of the working Saturday', () => {
		const result = computeLeave(country('by'), lookupAll, '2027-05-04', '2027-05-07')
		expect(result.charged).toBe(4)
		expect(result.rest).toEqual({from: '2027-05-04', to: '2027-05-07', days: 4})
	})

	it('counts Armenian leave in working days', () => {
		const result = computeLeave(country('am'), lookupAll, '2027-05-24', '2027-05-30')
		expect(result.charged).toBe(4)
		expect(result.holidaysInside).toBe(1)
	})

	it('charges Ukrainian holidays under martial law', () => {
		const result = computeLeave(country('ua'), lookupAll, '2026-08-17', '2026-08-30')
		expect(result.charged).toBe(14)
		expect(result.holidaysInside).toBe(0)
	})

	it('accepts a reversed range and crosses years', () => {
		const result = computeLeave(country('ru'), lookupAll, '2027-01-14', '2027-01-11')
		expect(result.from).toBe('2027-01-11')
		expect(result.charged).toBe(4)
		expect(result.rest.from).toBe('2026-12-31')
	})
})
