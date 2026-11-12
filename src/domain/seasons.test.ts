import {describe, expect, it} from 'vitest'

import {seasonOf} from './seasons'

describe('seasonOf', () => {
	it('uses meteorological seasons', () => {
		expect(seasonOf(12)).toBe('winter')
		expect(seasonOf(2)).toBe('winter')
		expect(seasonOf(3)).toBe('spring')
		expect(seasonOf(8)).toBe('summer')
		expect(seasonOf(11)).toBe('autumn')
	})

	it('flips seasons in the southern hemisphere', () => {
		expect(seasonOf(1, 'meteo-south')).toBe('summer')
		expect(seasonOf(7, 'meteo-south')).toBe('winter')
	})
})
