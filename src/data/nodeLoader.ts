/** Загрузка стран в Node-скриптах (без import.meta.glob из Vite) */
import {readdirSync, readFileSync} from 'node:fs'
import {resolve} from 'node:path'

import type {Country} from './types'

const dir = resolve(import.meta.dirname, '../../data/countries')

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
