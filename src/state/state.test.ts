import {afterEach, describe, expect, it, vi} from 'vitest'

import {MAX_COUNTRIES, STORAGE_KEY} from '../config'
import {COUNTRY_IDS} from '../data/loader'
import {loadSettings, sanitizeSettings, saveSettings} from './persist'
import {createStore, defaultSettings} from './store'

const memoryStorage = (initial: Record<string, string> = {}) => {
	const data = new Map(Object.entries(initial))
	return {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => void data.set(key, value),
		removeItem: (key: string) => void data.delete(key),
		data,
	}
}

afterEach(() => vi.unstubAllGlobals())

describe('persist', () => {
	const defaults = defaultSettings('ru')

	it('falls back to defaults for broken or old data', () => {
		expect(sanitizeSettings(null, defaults, COUNTRY_IDS)).toEqual(defaults)
		expect(sanitizeSettings('garbage', defaults, COUNTRY_IDS)).toEqual(defaults)
		const fixed = sanitizeSettings(
			{theme: 'pink', view: 'week', countries: ['xx', 'kz', 'kz'], hoursNorm: 999, lang: 'de'},
			defaults,
			COUNTRY_IDS
		)
		expect(fixed.theme).toBe('light')
		expect(fixed.view).toBe('year')
		expect(fixed.countries).toEqual(['kz'])
		expect(fixed.hoursNorm).toBe(defaults.hoursNorm)
		expect(fixed.lang).toBeNull()
	})

	it('keeps only the main country from old settings with comparison off', () => {
		const on = sanitizeSettings({countries: ['ru', 'kz'], compare: true}, defaults, COUNTRY_IDS)
		expect(on.countries).toEqual(['ru', 'kz'])
		const off = sanitizeSettings({countries: ['kz', 'ru'], compare: false}, defaults, COUNTRY_IDS)
		expect(off.countries).toEqual(['kz'])
		expect('compare' in off).toBe(false)
	})

	it('reads and writes localStorage', () => {
		const storage = memoryStorage()
		vi.stubGlobal('localStorage', storage)
		saveSettings({...defaults, theme: 'dark', countries: ['am', 'ru']})
		expect(JSON.parse(storage.data.get(STORAGE_KEY)!).theme).toBe('dark')
		const loaded = loadSettings(defaults, COUNTRY_IDS)
		expect(loaded.theme).toBe('dark')
		expect(loaded.countries).toEqual(['am', 'ru'])
	})

	it('survives invalid JSON and unavailable storage', () => {
		vi.stubGlobal('localStorage', memoryStorage({[STORAGE_KEY]: '{oops'}))
		expect(loadSettings(defaults, COUNTRY_IDS)).toEqual(defaults)
		vi.stubGlobal('localStorage', {
			getItem: () => {
				throw new Error('denied')
			},
			setItem: () => {
				throw new Error('denied')
			},
		})
		expect(loadSettings(defaults, COUNTRY_IDS)).toEqual(defaults)
		expect(() => saveSettings(defaults)).not.toThrow()
	})
})

describe('store', () => {
	const store = () => createStore({lang: 'kk', year: 2027, years: {}})

	it('starts with the one country of the page language', () => {
		expect(defaultSettings('kk').countries).toEqual(['kz'])
		expect(defaultSettings('uk').countries).toEqual(['ua'])
		expect(defaultSettings('en').countries).toEqual(['ru'])
		expect(defaultSettings('ru').countries).toEqual(['ru'])
	})

	it(`limits the overlay to ${MAX_COUNTRIES} countries and keeps at least one`, () => {
		const s = store()
		s.updateSettings({countries: ['ru']})
		expect(s.toggleCountry('ru')).toBe(false)
		expect(s.settings.value.countries).toEqual(['ru'])
		expect(s.toggleCountry('kz')).toBe(true)
		expect(s.toggleCountry('ru')).toBe(true)
		expect(s.settings.value.countries).toEqual(['kz'])
		s.updateSettings({countries: [...COUNTRY_IDS.slice(0, MAX_COUNTRIES - 1), 'am']})
		expect(s.settings.value.countries).toHaveLength(MAX_COUNTRIES)
		expect(s.toggleCountry('zz')).toBe(false)
		expect(s.settings.value.countries).toHaveLength(MAX_COUNTRIES)
	})

	it('builds a vacation range from two clicks in any order', () => {
		const s = store()
		s.setMode('vacation')
		s.clickDay('2027-05-07')
		expect(s.range.value).toEqual({start: '2027-05-07', end: null})
		s.clickDay('2027-05-04')
		expect(s.range.value).toEqual({start: '2027-05-04', end: '2027-05-07'})
		s.clickDay('2027-06-01')
		expect(s.range.value).toEqual({start: '2027-06-01', end: null})
		s.cancel()
		expect(s.range.value).toBeNull()
	})

	it('moves between months across the year and stops where the data ends', () => {
		const s = store()
		s.month.value = 12
		s.year.value = 2026
		expect(s.shiftMonth(1)).toBe(true)
		expect([s.year.value, s.month.value]).toEqual([2027, 1])
		s.month.value = 12
		expect(s.shiftMonth(1)).toBe(false)
		expect([s.year.value, s.month.value]).toEqual([2027, 12])
		expect(s.shiftMonth(-1)).toBe(true)
		expect(s.month.value).toBe(11)
	})

	it('selects and unselects a day in browse mode', () => {
		const s = store()
		s.clickDay('2027-05-10')
		expect(s.selected.value).toBe('2027-05-10')
		s.clickDay('2027-05-10')
		expect(s.selected.value).toBeNull()
	})

	it('shows every chosen country, the first one as the main', () => {
		const s = store()
		s.updateSettings({countries: ['ru', 'kz', 'by']})
		expect(s.countries.value.map(c => c.id)).toEqual(['ru', 'kz', 'by'])
		expect(s.home.value.id).toBe('ru')
	})

	it('moves a country to the front as the main one', () => {
		const s = store()
		s.setHome('am')
		expect(s.home.value.id).toBe('am')
		expect(s.weekStart.value).toBe(1)
	})
})
