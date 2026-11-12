import {effect} from '@preact/signals'
import {useEffect, useRef} from 'preact/hooks'

import {initMetrika, track} from '../analytics/metrika'
import {pathFor} from '../app/routes'
import {readShared} from '../app/share'
import {COUNTRY_IDS, YEARS} from '../data/loader'
import {diffDays, monthOf, todayISO, yearOf} from '../domain/dates'
import {useI18n} from '../i18n'
import {calendarTitle} from '../seo/title'
import {loadSettings, saveSettings} from '../state/persist'
import {useStore} from '../state/store'
import {CalendarArea, Legend} from './CalendarViews'
import {CountryChips, Footer, Header, hrefForLang, SettingsDialog, Toolbar} from './Chrome'
import s from './Layout.module.css'
import {Panel} from './Panel'
import {CompareSection, HolidaysSection, RulesSection} from './Sections'

export const CalendarPage = ({routeYear}: {routeYear: number | null}) => {
	const store = useStore()
	const {lang, t} = useI18n()
	const initialYear = useRef(store.year.value).current

	// Всё, что зависит от браузера, применяется после гидрации, чтобы разметка совпала с пререндером
	useEffect(() => {
		const today = todayISO()
		const saved = loadSettings(store.settings.value, COUNTRY_IDS)
		store.settings.value = saved
		store.today.value = today
		const todayYear = yearOf(today)
		if (routeYear == null && todayYear !== store.year.value && YEARS.includes(todayYear)) {
			store.setYear(todayYear)
		}
		store.month.value = store.year.value === todayYear ? monthOf(today) : 1
		store.ensureAround(store.year.value)

		// Ссылка на отпуск: показываем те же страны и даты. Страны не сохраняются,
		// пока человек сам что-то не поменяет
		const shared = readShared(location.search, COUNTRY_IDS, YEARS)
		if (shared) {
			if (shared.countries.length) {
				store.settings.value = {...store.settings.value, countries: shared.countries}
			}
			store.setRange(shared.from, shared.to)
			track('shared_link_open', {
				days: diffDays(shared.from, shared.to) + 1,
				countries: store.settings.value.countries.length,
			})
		}
		// Убираем из адреса только свои параметры: UTM-метки нужны Метрике
		const query = new URLSearchParams(location.search)
		if (['c', 'from', 'to'].some(key => query.has(key))) {
			for (const key of ['c', 'from', 'to']) query.delete(key)
			const rest = query.toString()
			history.replaceState(history.state, '', location.pathname + (rest ? `?${rest}` : ''))
		}

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
		const stopUrl = effect(() => {
			const year = store.year.value
			const yearPage = !(routeYear == null && year === initialYear)
			document.title = calendarTitle(t, year, yearPage)
			const path = yearPage ? pathFor(lang, year) : pathFor(lang)
			if (location.pathname !== path)
				history.replaceState(history.state, '', path + location.search)
		})
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && !store.settingsOpen.value) store.cancel()
		}
		document.addEventListener('keydown', onKey)
		// Печатаем всегда в светлой теме: тёмный фон на бумаге не нужен
		const root = document.documentElement
		const onBeforePrint = () => (root.dataset.theme = 'light')
		const onAfterPrint = () => (root.dataset.theme = store.settings.value.theme)
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

	const hrefFor = hrefForLang(routeYear, store.year.value, initialYear)

	return (
		<div class={s.page}>
			<Header hrefFor={hrefFor} />
			<Toolbar />
			<CountryChips />
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
			<SettingsDialog />
		</div>
	)
}
