/** @vitest-environment happy-dom */
import {cleanup, fireEvent, render, within} from '@testing-library/preact'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {App} from '../app/App'
import type * as DetectCountry from '../app/detectCountry'
import {STORAGE_KEY} from '../config'
import {COUNTRY_IDS} from '../data/loader'
import {loadDict} from '../i18n'
import type {YearCache} from '../state/store'
import {allYears} from '../test/data'

// Часовой пояс машины не должен влиять на тесты: «браузер» всегда в Москве
vi.mock('../app/detectCountry', async importOriginal => ({
	...(await importOriginal<typeof DetectCountry>()),
	browserSignals: (lang: 'ru' | 'en') => ({timeZone: 'Europe/Moscow', languages: ['ru-RU'], lang}),
}))

/** Для тестов наложения: все страны уже выбраны и сохранены */
const saveAllCountries = () =>
	localStorage.setItem(STORAGE_KEY, JSON.stringify({countries: COUNTRY_IDS}))

const years: YearCache = {}
for (const y of allYears) years[y.country] = {...years[y.country], [y.year]: y}

const renderApp = async (lang: 'ru' | 'en' = 'ru', country: string | null = null) => {
	const t = await loadDict(lang)
	const result = render(
		<App
			route={{kind: 'app', lang, year: 2027, country}}
			i18n={{lang, t}}
			init={{year: 2027, years}}
		/>
	)
	await new Promise(r => setTimeout(r, 0))
	return result
}

const cell = (container: Element, date: string) =>
	container.querySelector<HTMLElement>(`[data-date="${date}"]`)!

/** Кнопки спойлеров в списке праздников */
const holidayToggles = (container: Element) => [
	...container.querySelectorAll<HTMLElement>('[aria-labelledby="holidays-title"] [aria-expanded]'),
]

const expanded = (button: HTMLElement) => button.getAttribute('aria-expanded') === 'true'

beforeEach(() => localStorage.clear())
afterEach(() => cleanup())

describe('calendar', () => {
	it('selects only the detected country on the first visit', async () => {
		const {getByRole} = await renderApp()
		const chips = within(getByRole('group', {name: 'Страны'}))
		const active = chips
			.getAllByRole('button')
			.filter(b => b.getAttribute('aria-pressed') === 'true')
		expect(active.map(b => b.textContent)).toEqual(['Россия· основная'])
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
	})

	it('opens a country page with that country first, without saving it', async () => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({countries: ['ru', 'by']}))
		const {getByRole, container} = await renderApp('ru', 'kz')
		const chips = within(getByRole('group', {name: 'Страны'}))
		const active = chips
			.getAllByRole('button')
			.filter(b => b.getAttribute('aria-pressed') === 'true')
		// Чипы идут в обычном порядке стран, основной стала страна из адреса
		expect(active.map(b => b.dataset.c)).toEqual(['ru', 'kz', 'by'])
		expect(chips.getByRole('button', {name: /Казахстан/}).textContent).toContain('основная')
		expect(container.querySelector('h1')?.textContent).toBe(
			'Производственный календарь Казахстана на 2027 год'
		)
		expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).countries).toEqual(['ru', 'by'])
	})

	it('renders a year with one segment per country', async () => {
		saveAllCountries()
		const {container} = await renderApp()
		expect(container.querySelectorAll('button[data-date]')).toHaveLength(365)
		const segs = cell(container, '2027-05-10').querySelectorAll('i')
		expect(segs).toHaveLength(5)
		expect(segs[0]!.dataset.k).toBe('transfer')
		expect(segs[2]!.dataset.k).toBe('transfer')
		expect(segs[3]!.dataset.k).toBe('work')
	})

	it('highlights holidays of the main country', async () => {
		const {container} = await renderApp()
		expect(cell(container, '2027-05-09').dataset.home).toBe('holiday')
		expect(cell(container, '2027-05-10').dataset.home).toBe('transfer')
		expect(cell(container, '2027-05-11').dataset.home).toBeUndefined()
	})

	it('shows day details with the transfer source', async () => {
		const {container, getByText} = await renderApp()
		fireEvent.click(cell(container, '2027-05-10'))
		expect(cell(container, '2027-05-10').getAttribute('aria-pressed')).toBe('true')
		expect(cell(container, '2027-05-09').dataset.pair).toBe('true')
		expect(getByText('10 мая 2027')).toBeTruthy()
	})

	it('previews and then fixes a vacation range', async () => {
		const {container, getByRole} = await renderApp()
		fireEvent.click(getByRole('button', {name: 'Отпуск'}))
		fireEvent.click(cell(container, '2027-05-04'))
		fireEvent.pointerOver(cell(container, '2027-05-07'), {pointerType: 'mouse'})
		expect(cell(container, '2027-05-06').dataset.range).toBe('preview')
		fireEvent.click(cell(container, '2027-05-07'))
		expect(cell(container, '2027-05-05').dataset.range).toBe('in')
		expect(cell(container, '2027-05-08').dataset.range).toBeUndefined()
		expect(container.textContent).toContain('Отдых: 10 дней')
		fireEvent.keyDown(document, {key: 'Escape'})
		expect(cell(container, '2027-05-05').dataset.range).toBeUndefined()
	})

	it('does not preview on touch', async () => {
		const {container, getByRole} = await renderApp()
		fireEvent.click(getByRole('button', {name: 'Отпуск'}))
		fireEvent.click(cell(container, '2027-05-04'))
		fireEvent.pointerOver(cell(container, '2027-05-07'), {pointerType: 'touch'})
		expect(cell(container, '2027-05-06').dataset.range).toBeUndefined()
	})

	it('toggles countries and keeps at least one', async () => {
		saveAllCountries()
		const {container, getByRole} = await renderApp()
		const chip = within(getByRole('group', {name: 'Страны'})).getByRole('button', {name: /Армения/})
		expect(chip.getAttribute('aria-pressed')).toBe('true')
		fireEvent.click(chip)
		expect(chip.getAttribute('aria-pressed')).toBe('false')
		expect(cell(container, '2027-05-10').querySelectorAll('i')).toHaveLength(4)
	})

	it('names near days in words', async () => {
		vi.useFakeTimers({toFake: ['Date']})
		vi.setSystemTime(new Date(2027, 4, 9, 12))
		try {
			const {container} = await renderApp()
			fireEvent.click(cell(container, '2027-05-10'))
			expect(container.textContent).toContain('неделя 19 · завтра')
			fireEvent.click(cell(container, '2027-05-07'))
			expect(container.textContent).toContain('позавчера')
			fireEvent.click(cell(container, '2027-05-20'))
			expect(container.textContent).toContain('через 11 дней')
		} finally {
			vi.useRealTimers()
		}
	})

	it('marks days off of the main country as red days', async () => {
		const {container} = await renderApp()
		expect(cell(container, '2027-05-08').dataset.off).toBe('')
		expect(cell(container, '2027-05-10').dataset.off).toBe('')
		expect(cell(container, '2027-05-11').dataset.off).toBeUndefined()
	})

	it('collapses holiday lists from the third country on', async () => {
		saveAllCountries()
		const {container, getByRole} = await renderApp()
		const chips = within(getByRole('group', {name: 'Страны'}))
		expect(holidayToggles(container).map(expanded)).toEqual([true, true, false, false, false])
		fireEvent.click(chips.getByRole('button', {name: /Армения/}))
		fireEvent.click(chips.getByRole('button', {name: /Украина/}))
		fireEvent.click(chips.getByRole('button', {name: /Беларусь/}))
		expect(holidayToggles(container)).toHaveLength(0)
		fireEvent.click(chips.getByRole('button', {name: /Армения/}))
		expect(holidayToggles(container).map(expanded)).toEqual([true, true, false])
	})

	it('opens and closes a holiday list by its title', async () => {
		saveAllCountries()
		const {container} = await renderApp()
		const body = (button: HTMLElement) =>
			document.getElementById(button.getAttribute('aria-controls')!)!
		const third = holidayToggles(container)[2]!
		expect(body(third).hidden).toBe(true)
		fireEvent.click(third)
		await new Promise(r => setTimeout(r, 0))
		expect(expanded(holidayToggles(container)[2]!)).toBe(true)
		expect(body(holidayToggles(container)[2]!).hidden).toBe(false)
		fireEvent.click(holidayToggles(container)[0]!)
		await new Promise(r => setTimeout(r, 500))
		expect(expanded(holidayToggles(container)[0]!)).toBe(false)
		expect(body(holidayToggles(container)[0]!).hidden).toBe(true)
	})

	describe('bottom sheet on a phone', () => {
		beforeEach(() => {
			vi.spyOn(window, 'matchMedia').mockImplementation(
				query => ({matches: query.includes('max-width'), media: query}) as MediaQueryList
			)
		})
		afterEach(() => vi.restoreAllMocks())

		it('closes day details on a tap outside but not on another day', async () => {
			const {container} = await renderApp()
			const aside = container.querySelector('aside')!
			fireEvent.click(cell(container, '2027-05-10'))
			expect(aside.dataset.open).toBe('full')
			fireEvent.click(cell(container, '2027-05-11'))
			expect(cell(container, '2027-05-11').getAttribute('aria-pressed')).toBe('true')
			fireEvent.click(container.querySelector('h1')!)
			await new Promise(r => setTimeout(r, 0))
			expect(aside.dataset.open).toBeUndefined()
			expect(cell(container, '2027-05-11').getAttribute('aria-pressed')).toBe('false')
		})

		it('collapses the vacation sheet on a tap outside and keeps the range', async () => {
			const {container, getByRole} = await renderApp()
			const aside = container.querySelector('aside')!
			fireEvent.click(getByRole('button', {name: 'Отпуск'}))
			fireEvent.click(cell(container, '2027-05-04'))
			fireEvent.click(cell(container, '2027-05-07'))
			await new Promise(r => setTimeout(r, 20))
			expect(aside.dataset.open).toBe('full')
			fireEvent.click(container.querySelector('h1')!)
			await new Promise(r => setTimeout(r, 0))
			expect(aside.dataset.open).toBe('peek')
			expect(cell(container, '2027-05-05').dataset.range).toBe('in')
		})
	})

	it('opens a shared vacation link and keeps other query params', async () => {
		history.replaceState(null, '', '/ru/2027/?c=kz,ru&from=2027-05-04&to=2027-05-07&utm_source=tg')
		try {
			const {container} = await renderApp()
			expect(cell(container, '2027-05-05').dataset.range).toBe('in')
			expect(cell(container, '2027-05-10').querySelectorAll('i')).toHaveLength(2)
			expect(location.search).toBe('?utm_source=tg')
			expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
		} finally {
			history.replaceState(null, '', '/')
		}
	})

	it('shows ISO week numbers in the month view when enabled', async () => {
		vi.useFakeTimers({toFake: ['Date']})
		vi.setSystemTime(new Date(2026, 10, 12, 12))
		localStorage.setItem(STORAGE_KEY, JSON.stringify({view: 'month', showWeekNumbers: true}))
		try {
			const {container} = await renderApp()
			const weeks = [...container.querySelectorAll('[title^="неделя"]')].map(el => el.textContent)
			expect(weeks).toEqual(['53', '1', '2', '3', '4'])
		} finally {
			vi.useRealTimers()
		}
	})

	it('switches views', async () => {
		const {container, getByRole} = await renderApp()
		fireEvent.click(getByRole('button', {name: 'Дорожки'}))
		expect(container.querySelectorAll('[data-country="ru"]').length).toBeGreaterThan(27)
		fireEvent.click(getByRole('button', {name: 'Месяц'}))
		expect(container.querySelectorAll('button[data-date]').length).toBeLessThanOrEqual(31)
	})
})

describe('chrome', () => {
	it('lists every language with links to the same page', async () => {
		const {getByRole, getAllByRole} = await renderApp()
		fireEvent.click(getByRole('button', {name: /Язык/}))
		const links = getAllByRole('link').filter(a => a.getAttribute('hreflang'))
		expect(links.map(a => a.getAttribute('href'))).toEqual([
			'/ru/2027/',
			'/en/2027/',
			'/kk/2027/',
			'/hy/2027/',
			'/be/2027/',
			'/uk/2027/',
		])
	})

	it('does not reload the page for the current language', async () => {
		const {getByRole, queryByRole} = await renderApp()
		fireEvent.click(getByRole('button', {name: /Язык/}))
		const current = getByRole('link', {name: /Русский/})
		expect(fireEvent.click(current)).toBe(false)
		expect(queryByRole('link', {name: /English/})).toBeNull()
		fireEvent.click(getByRole('button', {name: /Язык/}))
		expect(fireEvent.click(getByRole('link', {name: /English/}))).toBe(true)
	})

	it('does not save settings until the user changes something', async () => {
		await renderApp()
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
	})

	it('switches the theme and remembers it', async () => {
		const {getByRole} = await renderApp()
		fireEvent.click(getByRole('button', {name: 'Включить тёмную тему'}))
		await new Promise(r => setTimeout(r, 0))
		expect(document.documentElement.dataset.theme).toBe('dark')
		expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).theme).toBe('dark')
	})

	it('writes the Russian footer only for Russian', async () => {
		const ru = await renderApp('ru')
		expect(ru.container.textContent).toContain('Мейд виз ❤️ бай Миша Саидов')
		expect(ru.container.querySelector('footer p a')).toBeNull()
		cleanup()
		const en = await renderApp('en')
		expect(en.container.textContent).toContain('Made with ❤️ by Misha Saidov')
	})
})
