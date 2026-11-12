import {batch, computed, signal} from '@preact/signals'
import {createContext} from 'preact'
import {useContext} from 'preact/hooks'

import {type Lang, MAX_COUNTRIES} from '../config'
import {COUNTRIES, COUNTRY_IDS, hasYear, loadYear, YEARS} from '../data/loader'
import type {YearData, YearLookup} from '../data/types'
import type {ISODate} from '../domain/dates'
import {monthOf, yearOf} from '../domain/dates'
import type {Settings, Theme, View} from './persist'

export type Mode = 'view' | 'vacation'

export interface Range {
	start: ISODate
	end: ISODate | null
}

/** Основная страна по языку интерфейса */
const HOME_BY_LANG: Partial<Record<Lang, string>> = {kk: 'kz', hy: 'am', be: 'by', uk: 'ua'}

export const defaultSettings = (lang: Lang): Settings => {
	const home = HOME_BY_LANG[lang] ?? 'ru'
	const countries = [home, ...COUNTRY_IDS.filter(id => id !== home)].slice(0, MAX_COUNTRIES)
	return {
		theme: 'light',
		lang: null,
		countries,
		view: 'year',
		weekStart: 'auto',
		hoursNorm: 40,
		showObservances: true,
		showWeekNumbers: false,
		budget: 5,
	}
}

export type YearCache = Record<string, Record<number, YearData>>

interface StoreInit {
	lang: Lang
	year: number
	years: YearCache
}

export const createStore = ({lang, year: initialYear, years}: StoreInit) => {
	const settings = signal<Settings>(defaultSettings(lang))
	const year = signal(initialYear)
	const month = signal(1)
	const mode = signal<Mode>('view')
	const selected = signal<ISODate | null>(null)
	const range = signal<Range | null>(null)
	const hover = signal<ISODate | null>(null)
	const today = signal<ISODate | null>(null)
	const yearData = signal<YearCache>(years)
	const settingsOpen = signal(false)
	const limitHit = signal(false)
	const navigatorCountry = signal<string | null>(null)

	const countries = computed(() =>
		settings.value.countries.map(id => COUNTRIES[id]).filter(c => c != null)
	)
	const home = computed(() => countries.value[0] ?? COUNTRIES[COUNTRY_IDS[0]!]!)
	const weekStart = computed(() =>
		settings.value.weekStart === 'auto' ? home.value.week.start : settings.value.weekStart
	)
	const lookup = computed<YearLookup>(() => {
		const data = yearData.value
		return (countryId, y) => data[countryId]?.[y]
	})

	const pending = new Set<string>()

	/** Догружает данные года для активных стран; уже загруженное не трогает */
	const ensureYear = async (y: number, ids = settings.value.countries) => {
		const missing = ids.filter(
			id => !yearData.value[id]?.[y] && hasYear(id, y) && !pending.has(`${id}/${y}`)
		)
		if (!missing.length) return
		missing.forEach(id => pending.add(`${id}/${y}`))
		const loaded = await Promise.all(missing.map(async id => [id, await loadYear(id, y)] as const))
		const next = {...yearData.value}
		for (const [id, data] of loaded) {
			pending.delete(`${id}/${y}`)
			if (data) next[id] = {...next[id], [y]: data}
		}
		yearData.value = next
	}

	/** Текущий год и соседние: соседние нужны, чтобы окно отдыха считалось через границу года */
	const ensureAround = (y: number) => {
		void ensureYear(y)
		void ensureYear(y - 1)
		void ensureYear(y + 1)
	}

	const updateSettings = (patch: Partial<Settings>) => {
		settings.value = {...settings.value, ...patch}
	}

	const setYear = (y: number) => {
		year.value = y
		ensureAround(y)
	}

	const goTo = (date: ISODate) => {
		batch(() => {
			if (yearOf(date) !== year.value) setYear(yearOf(date))
			month.value = monthOf(date)
		})
	}

	/** Соседний месяц для стрелок и свайпа; за пределы лет с данными не уходит */
	const shiftMonth = (delta: number) => {
		let m = month.value + delta
		let y = year.value
		if (m < 1) [m, y] = [m + 12, y - 1]
		else if (m > 12) [m, y] = [m - 12, y + 1]
		if (!YEARS.includes(y)) return false
		batch(() => {
			if (y !== year.value) setYear(y)
			month.value = m
		})
		return true
	}

	const toggleCountry = (id: string) => {
		const current = settings.value.countries
		if (current.includes(id)) {
			if (current.length > 1) updateSettings({countries: current.filter(c => c !== id)})
			limitHit.value = false
			return true
		}
		if (current.length >= MAX_COUNTRIES) {
			limitHit.value = true
			return false
		}
		limitHit.value = false
		updateSettings({countries: [...current, id]})
		ensureAround(year.value)
		return true
	}

	const setHome = (id: string) => {
		const rest = settings.value.countries.filter(c => c !== id)
		updateSettings({countries: [id, ...rest].slice(0, MAX_COUNTRIES)})
		ensureAround(year.value)
	}

	const setMode = (next: Mode) => {
		batch(() => {
			mode.value = next
			hover.value = null
			if (next === 'view') range.value = null
			else selected.value = null
		})
	}

	/** Клик по дню: в просмотре выбирает день, в режиме отпуска строит диапазон */
	const clickDay = (date: ISODate) => {
		if (mode.value === 'view') {
			selected.value = selected.value === date ? null : date
			return
		}
		const current = range.value
		batch(() => {
			if (!current || current.end) range.value = {start: date, end: null}
			else if (date < current.start) range.value = {start: date, end: current.start}
			else range.value = {start: current.start, end: date}
			hover.value = null
		})
	}

	const setRange = (from: ISODate, to: ISODate) => {
		batch(() => {
			mode.value = 'vacation'
			selected.value = null
			range.value = {start: from, end: to}
			goTo(from)
		})
	}

	const cancel = () => {
		batch(() => {
			if (range.value && !range.value.end) range.value = null
			else if (range.value) range.value = null
			else selected.value = null
			hover.value = null
		})
	}

	return {
		lang,
		settings,
		year,
		month,
		mode,
		selected,
		range,
		hover,
		today,
		yearData,
		settingsOpen,
		limitHit,
		navigatorCountry,
		countries,
		home,
		weekStart,
		lookup,
		ensureYear,
		ensureAround,
		updateSettings,
		setYear,
		goTo,
		shiftMonth,
		toggleCountry,
		setHome,
		setMode,
		clickDay,
		setRange,
		cancel,
		setView: (view: View) => updateSettings({view}),
		setTheme: (theme: Theme) => updateSettings({theme}),
	}
}

export type Store = ReturnType<typeof createStore>

export const StoreContext = createContext<Store | null>(null)

export const useStore = () => {
	const store = useContext(StoreContext)
	if (!store) throw new Error('StoreContext is missing')
	return store
}
