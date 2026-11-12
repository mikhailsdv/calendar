import type {Country, YearData} from './types'

const countryModules = import.meta.glob<Country>('../../data/countries/*.json', {
	eager: true,
	import: 'default',
})

const yearLoaders = import.meta.glob<YearData>('../../data/years/*/*.json', {import: 'default'})

/** Порядок стран по умолчанию; новые страны из data/ добавляются в конец */
const PREFERRED_ORDER = ['ru', 'kz', 'by', 'am', 'ua']

export const COUNTRIES: Record<string, Country> = Object.fromEntries(
	Object.values(countryModules).map(country => [country.id, country])
)

export const COUNTRY_IDS: string[] = Object.keys(COUNTRIES).sort((a, b) => {
	const ia = PREFERRED_ORDER.indexOf(a)
	const ib = PREFERRED_ORDER.indexOf(b)
	return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b)
})

const yearKey = (countryId: string, year: number) => `../../data/years/${countryId}/${year}.json`

/** Годы, для которых есть данные хотя бы по одной стране */
export const YEARS: number[] = [
	...new Set(Object.keys(yearLoaders).map(path => Number(path.match(/(\d{4})\.json$/)?.[1]))),
]
	.filter(Boolean)
	.sort((a, b) => a - b)

export const hasYear = (countryId: string, year: number) => yearKey(countryId, year) in yearLoaders

export const loadYear = async (countryId: string, year: number): Promise<YearData | undefined> => {
	const load = yearLoaders[yearKey(countryId, year)]
	return load ? load() : undefined
}

/** Загрузить год сразу для нескольких стран: {countryId: YearData} */
export const loadYearForCountries = async (countryIds: string[], year: number) => {
	const entries = await Promise.all(
		countryIds.map(async id => [id, await loadYear(id, year)] as const)
	)
	return Object.fromEntries(entries.filter(([, data]) => data)) as Record<string, YearData>
}
