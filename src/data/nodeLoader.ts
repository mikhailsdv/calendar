/** Загрузка стран в Node-скриптах (без import.meta.glob из Vite) */
import {readdirSync, readFileSync} from 'node:fs'
import {resolve} from 'node:path'

import {countryPages} from '../app/routes'
import type {Country} from './types'

const dir = resolve(import.meta.dirname, '../../data/countries')
const yearsDir = resolve(import.meta.dirname, '../../data/years')

export const COUNTRIES: Record<string, Country> = Object.fromEntries(
	readdirSync(dir)
		.filter(f => f.endsWith('.json'))
		.map(f => JSON.parse(readFileSync(resolve(dir, f), 'utf-8')) as Country)
		.map(c => [c.id, c])
)

const ORDER = ['ru', 'kz', 'by', 'am', 'ua']

export const COUNTRY_IDS = Object.keys(COUNTRIES).sort(
	(a, b) =>
		((ORDER.indexOf(a) + 100) % 100) - ((ORDER.indexOf(b) + 100) % 100) || a.localeCompare(b)
)

/** Годы с данными у страны */
export const yearsOf = (countryId: string) =>
	readdirSync(resolve(yearsDir, countryId))
		.map(f => Number(f.replace('.json', '')))
		.filter(Boolean)
		.sort((a, b) => a - b)

/** Все годы, по которым есть данные хотя бы у одной страны */
export const YEARS = [...new Set(COUNTRY_IDS.flatMap(yearsOf))].sort((a, b) => a - b)

export const COUNTRY_PAGES = countryPages(
	COUNTRY_IDS.map(id => COUNTRIES[id]!),
	yearsOf
)
