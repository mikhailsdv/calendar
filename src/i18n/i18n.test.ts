import {describe, expect, it} from 'vitest'

import {LANGS} from '../config'
import {
	detectLang,
	fmt,
	formatDate,
	formatRange,
	type I18n,
	loadDict,
	plural,
	weekdayName,
} from './index'
import ru from './locales/ru'

type Shape = string | number | Shape[] | {[key: string]: Shape}

/** Структура словаря: ключи, длины массивов и непустые строки */
const shapeErrors = (base: Shape, other: Shape, path = ''): string[] => {
	if (typeof base === 'string') {
		return typeof other === 'string' && other.trim() ? [] : [`${path}: empty or not a string`]
	}
	if (Array.isArray(base)) {
		if (!Array.isArray(other) || other.length !== base.length) return [`${path}: array length`]
		return base.flatMap((item, i) => shapeErrors(item, other[i]!, `${path}[${i}]`))
	}
	if (typeof base === 'object') {
		if (typeof other !== 'object' || other == null) return [`${path}: missing object`]
		const errors: string[] = []
		for (const key of Object.keys(base)) {
			if (path.endsWith('plural') || /plural\.\w+$/.test(path)) continue
			if (!(key in other)) errors.push(`${path}.${key}: missing`)
			else
				errors.push(
					...shapeErrors(
						(base as Record<string, Shape>)[key]!,
						(other as Record<string, Shape>)[key]!,
						`${path}.${key}`
					)
				)
		}
		return errors
	}
	return []
}

const i18nOf = async (lang: (typeof LANGS)[number]): Promise<I18n> => ({
	lang,
	t: await loadDict(lang),
})

describe('dictionaries', () => {
	for (const lang of LANGS) {
		it(`${lang} has every key of ru`, async () => {
			const dict = await loadDict(lang)
			expect(shapeErrors(ru as unknown as Shape, dict as unknown as Shape)).toEqual([])
		})

		it(`${lang} has plural forms for its rules`, async () => {
			const dict = await loadDict(lang)
			const categories = new Intl.PluralRules(lang).resolvedOptions().pluralCategories
			for (const forms of Object.values(dict.plural)) {
				for (const category of categories) {
					if (category === 'zero' || category === 'two') continue
					expect(forms[category as keyof typeof forms] ?? forms.other).toBeTruthy()
				}
			}
		})

		it(`${lang} keeps the placeholders`, async () => {
			const dict = await loadDict(lang)
			expect(dict.header.h1).toContain('{year}')
			expect(dict.meta.title).toContain('{year}')
			expect(dict.compare.hours).toContain('{n}')
		})
	}
})

describe('helpers', () => {
	it('formats templates', () => {
		expect(fmt('{a} и {b}, {c}', {a: 1, b: 'два'})).toBe('1 и два, {c}')
	})

	it('picks Russian plural forms', () => {
		const forms = ru.plural.days
		expect(plural('ru', forms, 1)).toBe('1 день')
		expect(plural('ru', forms, 3)).toBe('3 дня')
		expect(plural('ru', forms, 5)).toBe('5 дней')
		expect(plural('ru', forms, 21)).toBe('21 день')
	})

	it('formats dates per language', async () => {
		expect(formatDate(await i18nOf('ru'), '2027-05-10')).toBe('10 мая 2027')
		expect(formatDate(await i18nOf('en'), '2027-05-10')).toBe('May 10, 2027')
		expect(formatDate(await i18nOf('uk'), '2027-05-10', 'short')).toBe('10 травня')
		expect(formatRange(await i18nOf('ru'), '2027-05-04', '2027-05-07')).toBe('4 мая — 7 мая 2027')
		expect(weekdayName(await i18nOf('be'), '2027-05-10')).toBe('панядзелак')
	})

	it('detects the language with a fallback to Russian', () => {
		expect(detectLang(['kk-KZ', 'ru'])).toBe('kk')
		expect(detectLang(['de-DE', 'hy'])).toBe('hy')
		expect(detectLang(['ua'])).toBe('uk')
		expect(detectLang(['en-GB'])).toBe('en')
		expect(detectLang(['de', 'fr'])).toBe('ru')
		expect(detectLang([])).toBe('ru')
	})
})
