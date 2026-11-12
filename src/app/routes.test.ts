import {describe, expect, it} from 'vitest'

import {LANGS} from '../config'
import {allPaths, type CountryPage, pageGroups, parseRoute, pathFor} from './routes'

const years = [2026, 2027]
const countries: CountryPage[] = [
	{id: 'ru', langs: ['ru', 'en'], years},
	{id: 'kz', langs: ['ru', 'en', 'kk'], years: [2026]},
]

describe('routes', () => {
	it('builds paths with and without a country', () => {
		expect(pathFor('ru')).toBe('/ru/')
		expect(pathFor('ru', 2027)).toBe('/ru/2027/')
		expect(pathFor('ru', null, 'kz')).toBe('/ru/kz/')
		expect(pathFor('kk', 2026, 'kz')).toBe('/kk/kz/2026/')
	})

	it('parses general and country pages', () => {
		expect(parseRoute('/ru/', years, countries)).toEqual({
			kind: 'app',
			lang: 'ru',
			year: null,
			country: null,
		})
		expect(parseRoute('/ru/2027/', years, countries)).toMatchObject({year: 2027, country: null})
		expect(parseRoute('/kk/kz/', years, countries)).toMatchObject({year: null, country: 'kz'})
		expect(parseRoute('/en/kz/2026/', years, countries)).toMatchObject({year: 2026, country: 'kz'})
	})

	it('serves country pages only in their languages and years', () => {
		expect(parseRoute('/kk/ru/', years, countries).kind).toBe('notFound')
		expect(parseRoute('/ru/kz/2027/', years, countries).kind).toBe('notFound')
		expect(parseRoute('/ru/xx/', years, countries).kind).toBe('notFound')
		expect(parseRoute('/ru/kz/2026/extra/', years, countries).kind).toBe('notFound')
	})

	it('groups language versions and grows linearly with countries', () => {
		const groups = pageGroups(years, countries)
		expect(groups[0]!.map(p => p.path)).toEqual(LANGS.map(l => pathFor(l)))
		expect(groups.find(g => g[0]!.path === '/ru/kz/2026/')?.map(p => p.lang)).toEqual([
			'ru',
			'en',
			'kk',
		])
		// Общие: 6 языков × 3; Россия: 2 языка × 3; Казахстан: 3 языка × 2, плюс корень
		expect(allPaths(years, countries)).toHaveLength(1 + 18 + 6 + 6)
	})
})
