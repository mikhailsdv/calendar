import {describe, expect, it} from 'vitest'

import {country, lookupAll} from '../test/data'
import {upcomingHolidays} from './upcoming'

describe('upcomingHolidays', () => {
	const team = [country('ru'), country('kz'), country('by')]

	it('merges a shared date into one item and a long rest into one entry', () => {
		const items = upcomingHolidays(team, lookupAll, '2026-12-26')
		expect(items[0]!.date).toBe('2027-01-01')
		expect(items[0]!.countries.map(c => c.id)).toEqual(['ru', 'kz', 'by'])
		expect(items[0]!.daysUntil).toBe(6)
		expect(items[0]!.rest.days).toBeGreaterThanOrEqual(10)
		// Новогодние каникулы России — один пункт, а Рождество в Казахстане и Беларуси — отдельный
		const christmas = items.find(i => i.date === '2027-01-07')
		expect(christmas?.countries.map(c => c.id)).not.toContain('ru')
		expect(christmas?.countries.length).toBeGreaterThan(0)
	})

	it('respects the limit', () => {
		expect(upcomingHolidays(team, lookupAll, '2026-01-01', {limit: 3})).toHaveLength(3)
	})
})
