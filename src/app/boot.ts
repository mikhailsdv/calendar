import {YEARS} from '../data/loader'
import type {YearData} from '../data/types'
import type {YearCache} from '../state/store'

/** Год по умолчанию: текущий, если по нему есть данные, иначе ближайший из имеющихся */
export const defaultYear = (now = new Date()) => {
	const current = now.getFullYear()
	if (YEARS.includes(current)) return current
	const past = YEARS.filter(y => y <= current)
	return past.length ? past[past.length - 1]! : YEARS[0]!
}

/** Данные, которые пререндер кладёт в страницу для гидрации без лишних запросов */
export interface BootData {
	year: number
	years: YearCache
}

export const BOOT_DATA_ID = 'prerender-data'

export const toCache = (byCountry: Record<string, YearData>, year: number): YearCache =>
	Object.fromEntries(Object.entries(byCountry).map(([id, data]) => [id, {[year]: data}]))
