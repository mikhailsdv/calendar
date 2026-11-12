import type {Country} from '../data/types'

export type Season = 'winter' | 'spring' | 'summer' | 'autumn'

const NORTH: Season[] = ['winter', 'spring', 'summer', 'autumn']
const SOUTH: Season[] = ['summer', 'autumn', 'winter', 'spring']

/** Метеорологический сезон: зима — декабрь–февраль (в северном полушарии) */
export const seasonOf = (month: number, hemisphere: Country['seasons'] = 'meteo-north') => {
	const index = Math.floor((month % 12) / 3)
	return (hemisphere === 'meteo-south' ? SOUTH : NORTH)[index]!
}
