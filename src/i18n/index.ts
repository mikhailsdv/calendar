import {createContext} from 'preact'
import {useContext} from 'preact/hooks'

import type {Lang} from '../config'
import type {LocalizedText} from '../data/types'
import {type ISODate, isoWeekday, parseISO} from '../domain/dates'
import type {Dict} from './locales/ru'
import type {PluralForms} from './types'

export type {Dict}

const loaders: Record<Lang, () => Promise<{default: Dict}>> = {
	ru: () => import('./locales/ru'),
	en: () => import('./locales/en'),
	kk: () => import('./locales/kk'),
	hy: () => import('./locales/hy'),
	be: () => import('./locales/be'),
	uk: () => import('./locales/uk'),
}

export const loadDict = async (lang: Lang) => (await loaders[lang]()).default

export interface I18n {
	lang: Lang
	t: Dict
}

export const I18nContext = createContext<I18n | null>(null)

export const useI18n = () => {
	const value = useContext(I18nContext)
	if (!value) throw new Error('I18nContext is missing')
	return value
}

/** Подставляет {name} из vars; неизвестные плейсхолдеры остаются как есть */
export const fmt = (template: string, vars: Record<string, string | number>) =>
	template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match))

export type {PluralForms}

const pluralRules = new Map<Lang, Intl.PluralRules>()

export const plural = (lang: Lang, forms: PluralForms, n: number) => {
	let rules = pluralRules.get(lang)
	if (!rules) pluralRules.set(lang, (rules = new Intl.PluralRules(lang)))
	const rule = rules.select(n) as keyof PluralForms
	return fmt(forms[rule] ?? forms.other, {n})
}

export const formatDate = ({t}: I18n, date: ISODate, variant: 'full' | 'short' = 'full') => {
	const {year, month, day} = parseISO(date)
	return fmt(t.dateFormat[variant], {d: day, MMMM: t.monthsGenitive[month - 1]!, yyyy: year})
}

/**
 * Диапазон дат. Год не пишется, если обе даты в текущем году; в одном месяце — «4–7 мая».
 * currentYear известен только после монтирования, до этого год пишется всегда
 */
export const formatRange = (
	i18n: I18n,
	from: ISODate,
	to: ISODate,
	currentYear: number | null = null
) => {
	const a = parseISO(from)
	const b = parseISO(to)
	const variant = a.year === b.year && b.year === currentYear ? 'short' : 'full'
	if (a.year === b.year && a.month === b.month) {
		const days = a.day === b.day ? String(a.day) : `${a.day}–${b.day}`
		return fmt(i18n.t.dateFormat[variant], {
			d: days,
			MMMM: i18n.t.monthsGenitive[a.month - 1]!,
			yyyy: a.year,
		})
	}
	return fmt(i18n.t.dateFormat.range, {
		from: formatDate(i18n, from, a.year === b.year ? 'short' : 'full'),
		to: formatDate(i18n, to, variant),
	})
}

export const weekdayName = ({t}: I18n, date: ISODate) => t.weekdays[isoWeekday(date) - 1]!

export const weekdayShort = ({t}: I18n, isoDay: number) => t.weekdaysShort[isoDay - 1]!

export const localized = (text: LocalizedText, lang: Lang) => text[lang] ?? text.ru
