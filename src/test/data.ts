import type {Country, YearData, YearLookup} from '../data/types'

const countries = import.meta.glob<Country>('../../data/countries/*.json', {
	eager: true,
	import: 'default',
})
const years = import.meta.glob<YearData>('../../data/years/*/*.json', {
	eager: true,
	import: 'default',
})

/** Все страны из data/ синхронно, для тестов */
export const allCountries: Record<string, Country> = Object.fromEntries(
	Object.values(countries).map(c => [c.id, c])
)

export const allYears: YearData[] = Object.values(years)

export const country = (id: string) => {
	const c = allCountries[id]
	if (!c) throw new Error(`Unknown country ${id}`)
	return c
}

/** Lookup по всем годам из data/ */
export const lookupAll: YearLookup = (countryId, year) =>
	allYears.find(y => y.country === countryId && y.year === year)
