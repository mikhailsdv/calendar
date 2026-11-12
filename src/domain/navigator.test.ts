import {describe, expect, it} from 'vitest'

import {country, lookupAll} from '../test/data'
import {bestWindows, improveSelection, searchRange} from './navigator'

describe('bestWindows', () => {
	it('finds non-overlapping windows within the budget', () => {
		const windows = bestWindows(country('ru'), lookupAll, {
			from: '2027-01-01',
			to: '2027-12-31',
			budget: 4,
		})
		expect(windows).toHaveLength(3)
		for (const w of windows) expect(w.charged).toBeLessThanOrEqual(4)
		for (let i = 1; i < windows.length; i++) {
			expect(windows[i]!.rest.from > windows[i - 1]!.rest.to).toBe(true)
		}
		expect(Math.max(...windows.map(w => w.rest.days))).toBeGreaterThanOrEqual(10)
	})

	it('starts windows only inside the range', () => {
		const windows = bestWindows(country('kz'), lookupAll, {
			from: '2027-06-01',
			to: '2027-12-31',
			budget: 3,
		})
		for (const w of windows) expect(w.from >= '2027-06-01').toBe(true)
	})

	it('looks across the new year in the current year', () => {
		const range = searchRange(2026, '2026-11-12', 2027)
		expect(range).toEqual({from: '2026-11-12', to: '2027-11-12', ahead: true})
		const windows = bestWindows(country('ru'), lookupAll, {...range, budget: 5})
		expect(windows.some(w => w.rest.to >= '2027-01-01' && w.rest.from <= '2027-01-11')).toBe(true)
	})

	it('searches a whole other year and stops where the data ends', () => {
		expect(searchRange(2027, '2026-11-12', 2027)).toEqual({
			from: '2027-01-01',
			to: '2027-12-31',
			ahead: false,
		})
		expect(searchRange(2027, '2027-06-01', 2027).to).toBe('2027-12-31')
	})

	it('finds money windows in long months, not around the May holidays', () => {
		const range = {from: '2027-01-01', to: '2027-12-31', budget: 7}
		const rest = bestWindows(country('ru'), lookupAll, range)
		const money = bestWindows(country('ru'), lookupAll, {...range, goal: 'money'})
		for (const w of money) {
			expect(w.money).toBeGreaterThan(0)
			expect(w.from.slice(5, 7)).not.toBe('05')
		}
		// Самое «длинное» по отдыху окно по деньгам хуже лучшего денежного
		expect(Math.max(...money.map(w => w.money))).toBeGreaterThan(
			Math.max(...rest.map(w => w.money))
		)
	})

	it('returns nothing for an empty budget', () => {
		expect(
			bestWindows(country('ru'), lookupAll, {from: '2027-01-01', to: '2027-12-31', budget: 0})
		).toEqual([])
	})
})

describe('improveSelection', () => {
	it('suggests not wasting leave on holidays', () => {
		const hint = improveSelection(country('ru'), lookupAll, '2027-05-01', '2027-05-07')
		expect(hint).not.toBeNull()
		expect(hint!.result.charged).toBe(4)
		expect(hint!.result.rest.days).toBe(10)
		expect(hint!.chargedSaved).toBe(2)
	})

	it('suggests a shift that adds rest for the same leave', () => {
		const hint = improveSelection(country('ru'), lookupAll, '2027-05-06', '2027-05-09')
		expect(hint).not.toBeNull()
		expect(hint!.restGain).toBeGreaterThan(0)
		expect(hint!.chargedSaved).toBeGreaterThanOrEqual(0)
	})

	it('stays silent when the selection is already optimal', () => {
		expect(improveSelection(country('ru'), lookupAll, '2027-05-04', '2027-05-07')).toBeNull()
	})
})
