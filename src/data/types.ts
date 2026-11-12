import type {Lang} from '../config'

/** Строка на всех языках интерфейса; ru обязателен и служит фоллбэком */
export type LocalizedText = {ru: string} & Partial<Record<Lang, string>>

export type DayType = 'holiday' | 'dayoff' | 'workday' | 'observance'

export type HolidayRule =
	| {fixed: string[]}
	| {easter: 'orthodox' | 'western'; offset: number}
	| {lunar: string; authority?: string}
	| {nthWeekday: {month: number; weekday: number; n: number}}

export interface HolidayDef {
	name: LocalizedText
	kind: 'public' | 'religious' | 'memorial'
	rule: HolidayRule
	transfer?: 'decree' | 'none'
	dayOff?: boolean
	validFrom?: string
	verify?: string
}

export interface Regime {
	name: LocalizedText
	from: string
	until: string
	untilNote?: string
	basis?: string
	effects: {
		holidaysOff: boolean
		weekendHoliday: string
		preHolidayShortening: {hours: number} | null
		leaveNotCounted: DayType[]
	}
}

export interface Country {
	id: string
	iso: string
	name: LocalizedText
	/**
	 * Языки, на которых у страны есть свои страницы (/ru/kz/2026/), и форма названия для их заголовков:
	 * «Производственный календарь Казахстана», «Kazakhstan working calendar»
	 */
	pages: Partial<Record<Lang, string>>
	locale: string
	timezone: string
	seasons: 'meteo-north' | 'meteo-south'
	/** ISO-дни недели: 1 — понедельник … 7 — воскресенье */
	week: {start: 1 | 7; weekend: number[]}
	workTime: {weekHours: number[]; hoursPerDay: Record<string, number>}
	rules: {
		weekendHoliday: 'none' | 'next-workday' | 'nearest-weekday'
		weekendHolidayNote?: string
		decreeTransfers: boolean
		preHolidayShortening: {hours: number} | null
		transferredWorkdayInheritsHours?: boolean
	}
	leave: {
		unit: 'calendar' | 'working'
		minDays: number | null
		notCounted: DayType[]
		minPartDays?: number
		note?: string
	}
	regimes?: Record<string, Regime>
	holidays: Record<string, HolidayDef>
}

export interface DayEntry {
	type: DayType
	holiday?: string
	transfer?: {from?: string; to?: string}
	basis?: 'decree' | 'weekend-holiday-rule' | 'law'
	shortBy?: number
	reason?: string
	tentative?: boolean
	regime?: string
	note?: string
}

export interface YearData {
	country: string
	year: number
	status: 'official' | 'forecast'
	statusNote?: string
	sources: {title: string; url: string}[]
	regimes?: {id: string; from: string; to: string; tentativeAfter?: string}[]
	officialNorms?: {workdays?: number; hours?: Record<string, number>}
	days: Record<string, DayEntry>
}

/** Найти данные года страны; undefined — данных нет или они ещё не загружены */
export type YearLookup = (countryId: string, year: number) => YearData | undefined
