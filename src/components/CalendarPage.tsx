import {effect} from '@preact/signals'
import {useEffect, useRef} from 'preact/hooks'

import {initMetrika} from '../analytics/metrika'
import {browserSignals, detectCountry} from '../app/detectCountry'
import {pathFor} from '../app/routes'
import {MAX_COUNTRIES} from '../config'
import {COUNTRY_IDS, hasYear, YEARS} from '../data/loader'
import {monthOf, todayISO, yearOf} from '../domain/dates'
import {fmt, localized, useI18n} from '../i18n'
import {calendarTitle, countryForm, countryTitle} from '../seo/title'
import {loadSettings, saveSettings} from '../state/persist'
import {useStore} from '../state/store'
import {CalendarArea, Legend} from './CalendarViews'
import {CountryPicker, Footer, Header, hrefForLang, SettingsDialog, Toolbar} from './Chrome'
import s from './Layout.module.css'
import {Panel} from './Panel'
import {CompareSection, HolidaysSection, RulesSection} from './Sections'

export const CalendarPage = ({
	routeYear,
	routeCountry,
}: {
	routeYear: number | null
	routeCountry: string | null
}) => {
	const store = useStore()
	const {lang, t} = useI18n()
	const initialYear = useRef(store.year.value).current

	// Всё, что зависит от браузера, применяется после гидрации, чтобы разметка совпала с пререндером
	useEffect(() => {
		const today = todayISO()
		// Первый вход: страна из адреса, иначе по часовому поясу и языку браузера.
		// Если настройки уже сохранены, берём их, а страну из адреса ставим основной — без сохранения
		const detected = routeCountry ?? detectCountry(browserSignals(lang))
		const settings = loadSettings({...store.settings.value, countries: [detected]}, COUNTRY_IDS)
		store.settings.value = routeCountry
			? {
					...settings,
					countries: [routeCountry, ...settings.countries.filter(id => id !== routeCountry)].slice(
						0,
						MAX_COUNTRIES
					),
				}
			: settings
		store.today.value = today
		const todayYear = yearOf(today)
		if (routeYear == null && todayYear !== store.year.value && YEARS.includes(todayYear)) {
			store.setYear(todayYear)
		}
		store.month.value = store.year.value === todayYear ? monthOf(today) : 1
		store.ensureAround(store.year.value)

		// Сохраняем только изменения пользователя: иначе первая открытая страница
		// навсегда зафиксировала бы основную страну по своему языку
		let initial = true
		const stopPersist = effect(() => {
			const settings = store.settings.value
			if (initial) initial = false
			else saveSettings(settings)
		})
		const stopTheme = effect(() => {
			document.documentElement.dataset.theme = store.settings.value.theme
		})
		// Адрес и заголовок вкладки следуют за выбранным годом
		// Адрес, заголовок вкладки и h1 следуют за годом и основной страной. Страница страны
		// переключается на страницу новой основной страны, а если её нет на этом языке — на общую
		const stopUrl = effect(() => {
			const year = store.year.value
			const home = store.home.value
			const yearPage = !(routeYear == null && year === initialYear)
			const form = routeCountry && hasYear(home.id, year) ? countryForm(home, lang) : undefined
			const country = form ? home.id : null
			store.pageCountry.value = country
			document.title = form ? countryTitle(t, form, year) : calendarTitle(t, year, yearPage)
			const path = pathFor(lang, yearPage ? year : null, country)
			if (location.pathname !== path)
				history.replaceState(history.state, '', path + location.search)
		})
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && !store.settingsOpen.value) store.cancel()
		}
		document.addEventListener('keydown', onKey)
		// Печатаем всегда в светлой теме: тёмный фон на бумаге не нужен
		const root = document.documentElement
		// Заголовок документа браузер печатает вверху листа и берёт для имени PDF: только выбранные страны
		let screenTitle = document.title
		const onBeforePrint = () => {
			root.dataset.theme = 'light'
			screenTitle = document.title
			const names = store.countries.value.map(c => c.pages[lang] ?? localized(c.name, lang))
			const list = new Intl.ListFormat(lang, {type: 'conjunction'}).format(names)
			document.title = fmt(t.header.h1Country, {country: list, year: store.year.value})
		}
		const onAfterPrint = () => {
			root.dataset.theme = store.settings.value.theme
			document.title = screenTitle
		}
		window.addEventListener('beforeprint', onBeforePrint)
		window.addEventListener('afterprint', onAfterPrint)
		initMetrika()
		// Сохранённые настройки уже применены без анимаций; со следующего кадра интерфейс анимируется
		requestAnimationFrame(() =>
			requestAnimationFrame(() => (document.documentElement.dataset.ready = ''))
		)

		return () => {
			stopPersist()
			stopTheme()
			stopUrl()
			document.removeEventListener('keydown', onKey)
			window.removeEventListener('beforeprint', onBeforePrint)
			window.removeEventListener('afterprint', onAfterPrint)
		}
		// Один раз после монтирования
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const hrefFor = hrefForLang(routeYear, store.year.value, initialYear, store.pageCountry.value)

	return (
		<div class={s.page}>
			<Header hrefFor={hrefFor} />
			<Toolbar />
			<CountryPicker />
			<main>
				<div class={s.layout}>
					<div class={s.calendarCol}>
						<CalendarArea />
						<Legend />
					</div>
					<Panel />
				</div>
				<CompareSection />
				<HolidaysSection />
				<RulesSection />
			</main>
			<Footer />
			<SettingsDialog hrefFor={hrefFor} />
		</div>
	)
}
