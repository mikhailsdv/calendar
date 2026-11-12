import {createContext} from 'preact'
import {useContext} from 'preact/hooks'

import {DEFAULT_LANG, isLang, type Lang} from '../config'
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

export const formatRange = (i18n: I18n, from: ISODate, to: ISODate) => {
	const sameYear = from.slice(0, 4) === to.slice(0, 4)
	return fmt(i18n.t.dateFormat.range, {
		from: formatDate(i18n, from, sameYear ? 'short' : 'full'),
		to: formatDate(i18n, to, 'full'),
	})
}

export const weekdayName = ({t}: I18n, date: ISODate) => t.weekdays[isoWeekday(date) - 1]!

export const weekdayShort = ({t}: I18n, isoDay: number) => t.weekdaysShort[isoDay - 1]!

export const localized = (text: LocalizedText, lang: Lang) => text[lang] ?? text.ru

const ALIASES: Record<string, Lang> = {kz: 'kk', am: 'hy', by: 'be', ua: 'uk'}

/** Первый поддерживаемый язык из списка браузера, иначе русский */
export const detectLang = (languages: readonly string[]): Lang => {
	for (const tag of languages) {
		const base = tag.toLowerCase().split(/[-_]/)[0] ?? ''
		const lang = ALIASES[base] ?? base
		if (isLang(lang)) return lang
	}
	return DEFAULT_LANG
}
