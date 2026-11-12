import {describe, expect, it} from 'vitest'

import {detectCountry} from './detectCountry'

describe('detectCountry', () => {
	it('tells Kazakhstan from Yekaterinburg by the zone name, not by the offset', () => {
		expect(detectCountry({timeZone: 'Asia/Almaty', lang: 'ru'})).toBe('kz')
		expect(detectCountry({timeZone: 'Asia/Qostanay', lang: 'ru'})).toBe('kz')
		expect(detectCountry({timeZone: 'Asia/Yekaterinburg', lang: 'ru'})).toBe('ru')
	})

	it('knows every country of the list', () => {
		expect(detectCountry({timeZone: 'Europe/Minsk', lang: 'ru'})).toBe('by')
		expect(detectCountry({timeZone: 'Asia/Yerevan', lang: 'en'})).toBe('am')
		expect(detectCountry({timeZone: 'Europe/Kyiv', lang: 'ru'})).toBe('ua')
		expect(detectCountry({timeZone: 'Europe/Kiev', lang: 'ru'})).toBe('ua')
		expect(detectCountry({timeZone: 'Asia/Vladivostok', lang: 'en'})).toBe('ru')
	})

	it('trusts the zone over the page language', () => {
		expect(detectCountry({timeZone: 'Europe/Moscow', lang: 'kk'})).toBe('ru')
	})

	it('falls back to the page language, then the browser region, then Russia', () => {
		expect(detectCountry({timeZone: 'Europe/Warsaw', lang: 'uk'})).toBe('ua')
		expect(detectCountry({timeZone: 'Europe/Warsaw', lang: 'ru', languages: ['ru-BY', 'ru']})).toBe(
			'by'
		)
		expect(
			detectCountry({timeZone: 'Europe/Berlin', lang: 'en', languages: ['en-US', 'de-DE']})
		).toBe('ru')
		expect(detectCountry({lang: 'ru'})).toBe('ru')
	})
})
