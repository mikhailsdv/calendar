import {describe, expect, it} from 'vitest'

import {readShared, shareUrl} from './share'

const known = ['ru', 'kz', 'by', 'am', 'ua']
const years = [2026, 2027]

describe('share link', () => {
	it('builds a readable link to the year of the vacation', () => {
		const url = shareUrl('https://example.com', 'ru', {
			countries: ['ru', 'kz'],
			from: '2027-05-04',
			to: '2027-05-07',
		})
		expect(url).toBe('https://example.com/ru/2027/?c=ru,kz&from=2027-05-04&to=2027-05-07')
	})

	it('reads it back', () => {
		expect(readShared('?c=kz,ru&from=2027-05-04&to=2027-05-07', known, years)).toEqual({
			countries: ['kz', 'ru'],
			from: '2027-05-04',
			to: '2027-05-07',
		})
	})

	it('drops unknown countries and duplicates', () => {
		expect(
			readShared('?c=ru,xx,ru,by&from=2027-05-04&to=2027-05-07', known, years)?.countries
		).toEqual(['ru', 'by'])
	})

	it('ignores broken dates, reversed ranges and years without data', () => {
		expect(readShared('?from=2027-02-30&to=2027-03-02', known, years)).toBeNull()
		expect(readShared('?from=2027-05-07&to=2027-05-04', known, years)).toBeNull()
		expect(readShared('?from=2030-05-04&to=2030-05-07', known, years)).toBeNull()
		expect(readShared('?c=ru', known, years)).toBeNull()
	})
})
