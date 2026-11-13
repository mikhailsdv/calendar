import {useEffect, useRef, useState} from 'preact/hooks'

import {track} from '../analytics/metrika'
import {pathFor} from '../app/routes'
import {AUTHOR_LINKS, type Lang, LANG_NAMES, LANGS, MAX_COUNTRIES} from '../config'
import {COUNTRIES, COUNTRY_IDS, YEARS} from '../data/loader'
import {yearOf} from '../domain/dates'
import {fmt, localized, useI18n} from '../i18n'
import {countryForm} from '../seo/title'
import {useStore} from '../state/store'
import {Flag, LANG_FLAG} from './Flag'
import {
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	MoonIcon,
	PrinterIcon,
	SettingsIcon,
	SunIcon,
} from './icons'
import s from './Layout.module.css'
import {revealDate} from './reveal'

/** Выпадающее меню: закрывается по клику мимо и по Escape */
const useDropdown = () => {
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!open) return
		const onDown = (e: Event) => {
			if (!ref.current?.contains(e.target as Node)) setOpen(false)
		}
		const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
		document.addEventListener('pointerdown', onDown)
		document.addEventListener('keydown', onKey)
		return () => {
			document.removeEventListener('pointerdown', onDown)
			document.removeEventListener('keydown', onKey)
		}
	}, [open])

	return {open, setOpen, ref}
}

export const LangSwitcher = ({hrefFor}: {hrefFor: (lang: Lang) => string}) => {
	const store = useStore()
	const {lang, t} = useI18n()
	const {open, setOpen, ref} = useDropdown()

	return (
		<div class={`${s.langWrap} ${s.wideOnly}`} ref={ref}>
			<button
				type="button"
				class="btn"
				aria-haspopup="true"
				aria-expanded={open}
				aria-label={`${t.header.language}: ${LANG_NAMES[lang]}`}
				onClick={() => setOpen(!open)}
			>
				<Flag code={LANG_FLAG[lang]!} />
				<span class={s.langCode}>{lang}</span>
			</button>
			{open ? (
				<ul class={s.langMenu}>
					{LANGS.map(l => (
						<li key={l}>
							<a
								href={hrefFor(l)}
								hrefLang={l}
								lang={l}
								aria-current={l === lang ? 'page' : undefined}
								onClick={e => {
									store.updateSettings({lang: l})
									// Тот же язык: только закрываем меню, страницу не перезагружаем
									if (l === lang) {
										e.preventDefault()
										setOpen(false)
										return
									}
									track('lang_change', {from: lang, to: l})
								}}
							>
								<Flag code={LANG_FLAG[l]!} />
								{LANG_NAMES[l]}
							</a>
						</li>
					))}
				</ul>
			) : null}
		</div>
	)
}

export const ThemeToggle = () => {
	const store = useStore()
	const {t} = useI18n()
	const dark = store.settings.value.theme === 'dark'
	return (
		<button
			type="button"
			class={`btn btn-icon ${s.wideOnly}`}
			aria-label={dark ? t.header.themeLight : t.header.themeDark}
			title={dark ? t.header.themeLight : t.header.themeDark}
			onClick={() => {
				const theme = dark ? 'light' : 'dark'
				store.setTheme(theme)
				track('theme_change', {theme})
			}}
		>
			{dark ? <SunIcon /> : <MoonIcon />}
		</button>
	)
}

export const Header = ({hrefFor}: {hrefFor: (lang: Lang) => string}) => {
	const store = useStore()
	const {t, lang} = useI18n()
	const year = store.year.value
	const form = countryForm(COUNTRIES[store.pageCountry.value ?? ''], lang)
	const title = form ? fmt(t.header.h1Country, {country: form, year}) : fmt(t.header.h1, {year})
	// Чип единственной страны на печати скрыт, поэтому страну называет заголовок.
	// Печатный вариант — в атрибуте, чтобы текст h1 для поисковиков не менялся
	const countries = store.countries.value
	const home = countries[0]!
	const printTitle =
		!form && countries.length === 1
			? fmt(t.header.h1Country, {
					country: home.pages[lang] ?? localized(home.name, lang),
					year,
				})
			: null
	return (
		<header class={s.header}>
			<h1 class={s.title} data-print-title={printTitle ?? undefined}>
				{title}
			</h1>
			{/* На телефоне язык и тема спрятаны в диалог настроек, в шапке остаётся шестерёнка */}
			<nav class={s.actions} aria-label={t.header.settings}>
				<LangSwitcher hrefFor={hrefFor} />
				<ThemeToggle />
				<button
					type="button"
					class={`btn btn-icon ${s.wideOnly}`}
					aria-label={t.header.print}
					title={t.header.print}
					onClick={() => {
						track('print_click', {view: store.settings.value.view})
						window.print()
					}}
				>
					<PrinterIcon />
				</button>
				<button
					type="button"
					class="btn btn-icon"
					aria-label={t.header.settings}
					title={t.header.settings}
					onClick={() => {
						store.settingsOpen.value = true
						track('settings_open')
					}}
				>
					<SettingsIcon />
				</button>
			</nav>
		</header>
	)
}

export const Toolbar = () => {
	const store = useStore()
	const {t} = useI18n()
	const view = store.settings.value.view
	const year = store.year.value
	const month = store.month.value
	const minYear = YEARS[0]!
	const maxYear = YEARS[YEARS.length - 1]!

	const changeYear = (next: number) => {
		store.setYear(next)
		track('year_change', {year: next})
	}

	const changeMonth = (delta: number) => {
		if (store.shiftMonth(delta) && store.year.value !== year) {
			track('year_change', {year: store.year.value})
		}
	}

	const goToday = () => {
		track('today_click', {view})
		const today = store.today.value
		if (!today || !YEARS.includes(yearOf(today))) return
		store.goTo(today)
		revealDate(today)
	}

	return (
		<div class={s.toolbar} data-print="hide">
			<div class={s.period} data-month={view !== 'year' ? '' : undefined}>
				<div class={s.nav}>
					<button
						type="button"
						class="btn btn-ghost btn-icon"
						aria-label={t.toolbar.prevYear}
						disabled={year <= minYear}
						onClick={() => changeYear(year - 1)}
					>
						<ChevronLeft />
					</button>
					<span class={s.navLabel} aria-live="polite">
						{year}
					</span>
					<button
						type="button"
						class="btn btn-ghost btn-icon"
						aria-label={t.toolbar.nextYear}
						disabled={year >= maxYear}
						onClick={() => changeYear(year + 1)}
					>
						<ChevronRight />
					</button>
				</div>
				<div class={s.monthSlot} aria-hidden={view === 'year'} inert={view === 'year'}>
					<div class={`${s.nav} ${s.monthNav}`}>
						<button
							type="button"
							class="btn btn-ghost btn-icon"
							aria-label={t.toolbar.prevMonth}
							onClick={() => changeMonth(-1)}
						>
							<ChevronLeft />
						</button>
						<span class={`${s.navLabel} ${s.navLabelMonth}`}>{t.months[month - 1]}</span>
						<button
							type="button"
							class="btn btn-ghost btn-icon"
							aria-label={t.toolbar.nextMonth}
							onClick={() => changeMonth(1)}
						>
							<ChevronRight />
						</button>
					</div>
				</div>
			</div>
			<div class={`segmented ${s.views}`} role="group" aria-label={t.toolbar.view}>
				{(['year', 'month'] as const).map(v => (
					<button
						key={v}
						type="button"
						aria-pressed={view === v}
						onClick={() => {
							store.setView(v)
							track('view_change', {view: v})
						}}
					>
						{t.toolbar.views[v]}
					</button>
				))}
			</div>
			<div class={`segmented ${s.modes}`} role="group" aria-label={t.toolbar.mode}>
				{(['view', 'vacation'] as const).map(m => (
					<button
						key={m}
						type="button"
						aria-pressed={store.mode.value === m}
						onClick={() => {
							store.setMode(m)
							track('mode_change', {mode: m})
						}}
					>
						{t.toolbar.modes[m]}
					</button>
				))}
			</div>
			<CountryPicker />
			<button type="button" class={`btn ${s.today}`} onClick={goToday}>
				{t.toolbar.today}
			</button>
		</div>
	)
}

/**
 * Выбор стран: кнопка с флагами открывает список с чекбоксами. Отмеченные страны — на календаре,
 * первая из них основная. Несколько отметок — это и есть сравнение. Последнюю отметку снять нельзя
 */
export const CountryPicker = () => {
	const store = useStore()
	const {t, lang} = useI18n()
	const {open, setOpen, ref} = useDropdown()
	const active = store.settings.value.countries
	const home = active[0]!
	const full = active.length >= MAX_COUNTRIES
	const name = (id: string) => localized(COUNTRIES[id]!.name, lang)
	return (
		// На печати страны называют заголовок и легенда
		<div class={s.countries} ref={ref} data-print="hide">
			<button
				type="button"
				class={`btn ${s.countryBtn}`}
				aria-haspopup="true"
				aria-expanded={open}
				aria-controls="country-menu"
				aria-label={`${t.toolbar.countries}: ${active.map(name).join(', ')}`}
				onClick={() => setOpen(!open)}
			>
				<span class={s.flags}>
					{active.map(id => (
						<Flag key={id} code={id} />
					))}
				</span>
				{name(home)}
				{active.length > 1 ? <span class={s.more}>+{active.length - 1}</span> : null}
				<ChevronDown class={`icon ${s.countryChevron}`} />
			</button>
			{open ? (
				<div id="country-menu" class={s.countryMenu} role="group" aria-label={t.toolbar.countries}>
					<p class={s.countryHint}>
						{full ? fmt(t.toolbar.countryLimit, {n: MAX_COUNTRIES}) : t.toolbar.countriesHint}
					</p>
					<ul>
						{COUNTRY_IDS.map(id => {
							const checked = active.includes(id)
							// Последнюю страну не убрать, сверх лимита не добавить
							const locked = checked ? active.length === 1 : full
							return (
								<li key={id} data-c={id}>
									<label class={s.countryOption}>
										<input
											type="checkbox"
											checked={checked}
											disabled={locked}
											onChange={() => {
												if (!store.toggleCountry(id)) return
												track('country_toggle', {
													country: id,
													action: checked ? 'remove' : 'add',
													count: store.settings.value.countries.length,
												})
											}}
										/>
										<Flag code={id} />
										{name(id)}
									</label>
									{checked && active.length > 1 ? (
										id === home ? (
											<span class={s.homeTag}>{t.toolbar.home}</span>
										) : (
											<button
												type="button"
												class={s.makeHome}
												onClick={() => {
													store.setHome(id)
													track('home_change', {country: id})
												}}
											>
												{t.toolbar.makeHome}
											</button>
										)
									) : null}
								</li>
							)
						})}
					</ul>
				</div>
			) : null}
		</div>
	)
}

export const SettingsDialog = ({hrefFor}: {hrefFor: (lang: Lang) => string}) => {
	const store = useStore()
	const {t, lang} = useI18n()
	const ref = useRef<HTMLDialogElement>(null)
	const open = store.settingsOpen.value
	const settings = store.settings.value
	const theme = settings.theme

	useEffect(() => {
		const dialog = ref.current
		if (!dialog) return
		if (open && !dialog.open) dialog.showModal?.()
		if (!open && dialog.open) dialog.close()
	}, [open])

	return (
		<dialog
			ref={ref}
			class={s.dialog}
			aria-labelledby="settings-title"
			onClose={() => (store.settingsOpen.value = false)}
			onClick={e => e.target === ref.current && (store.settingsOpen.value = false)}
		>
			<h2 id="settings-title">{t.settings.title}</h2>
			{/* Язык и тема здесь только на телефоне: на широком экране они в шапке */}
			<div class={s.narrowOnly}>
				<label class={s.field}>
					{t.header.language}
					<select
						value={lang}
						onChange={e => {
							const next = (e.target as HTMLSelectElement).value as Lang
							store.updateSettings({lang: next})
							track('lang_change', {from: lang, to: next})
							location.assign(hrefFor(next))
						}}
					>
						{LANGS.map(l => (
							<option key={l} value={l} lang={l}>
								{LANG_NAMES[l]}
							</option>
						))}
					</select>
				</label>
				<div class={s.field}>
					<span id="theme-label">{t.settings.theme}</span>
					<div class={`segmented ${s.themeSwitch}`} role="group" aria-labelledby="theme-label">
						{(['light', 'dark'] as const).map(v => (
							<button
								key={v}
								type="button"
								aria-pressed={theme === v}
								onClick={() => {
									if (theme === v) return
									store.setTheme(v)
									track('theme_change', {theme: v})
								}}
							>
								{v === 'light' ? <SunIcon /> : <MoonIcon />}
								{t.settings[v]}
							</button>
						))}
					</div>
				</div>
			</div>
			<label class={s.field}>
				{t.settings.weekStart}
				<select
					value={String(settings.weekStart)}
					onChange={e => {
						const value = (e.target as HTMLSelectElement).value
						store.updateSettings({weekStart: value === 'auto' ? 'auto' : (Number(value) as 1 | 7)})
					}}
				>
					<option value="auto">{t.settings.weekAuto}</option>
					<option value="1">{t.settings.monday}</option>
					<option value="7">{t.settings.sunday}</option>
				</select>
			</label>
			<label class={s.field}>
				{t.settings.workWeek}
				<select
					value={String(settings.workWeek)}
					onChange={e =>
						store.updateSettings({
							workWeek: Number((e.target as HTMLSelectElement).value) as 5 | 6,
						})
					}
				>
					<option value="5">{t.settings.fiveDay}</option>
					<option value="6">{t.settings.sixDay}</option>
				</select>
			</label>
			<label class={s.field}>
				{t.settings.hoursNorm}
				<select
					value={String(settings.hoursNorm)}
					onChange={e =>
						store.updateSettings({
							hoursNorm: Number((e.target as HTMLSelectElement).value) as 40 | 36 | 24,
						})
					}
				>
					{[40, 36, 24].map(n => (
						<option key={n} value={n}>
							{n}
						</option>
					))}
				</select>
			</label>
			<label class={s.check}>
				<input
					type="checkbox"
					checked={settings.showWeekNumbers}
					onChange={e => {
						const enabled = (e.target as HTMLInputElement).checked
						store.updateSettings({showWeekNumbers: enabled})
						track('week_numbers_toggle', {enabled: enabled ? 'yes' : 'no'})
					}}
				/>
				{t.settings.weekNumbers}
			</label>
			<div class={s.dialogActions}>
				<button
					type="button"
					class="btn btn-primary"
					onClick={() => (store.settingsOpen.value = false)}
				>
					{t.settings.close}
				</button>
			</div>
		</dialog>
	)
}

const FOOTER_LINKS = [
	['telegramChannel', AUTHOR_LINKS.telegramChannel, 'telegram_channel'],
	['telegramDm', AUTHOR_LINKS.telegramDm, 'telegram_dm'],
	['cv', AUTHOR_LINKS.cv, 'cv'],
	['projects', AUTHOR_LINKS.projects, 'projects'],
] as const

export const Footer = () => {
	const {t} = useI18n()
	return (
		<footer class={s.footer}>
			<div>
				<p>
					{t.footer.madeWith} {t.footer.author}
				</p>
				<p class={s.muted}>{t.footer.dataNote}</p>
			</div>
			<nav class={s.footerLinks}>
				{FOOTER_LINKS.map(([key, href, target]) => (
					<a
						key={key}
						href={href}
						target="_blank"
						rel="noopener"
						onClick={() => track('outbound_click', {target})}
					>
						{t.footer[key]}
					</a>
				))}
			</nav>
		</footer>
	)
}

/** Ссылка на ту же страницу на другом языке; страница страны — только если она есть на этом языке */
export const hrefForLang =
	(routeYear: number | null, year: number, initialYear: number, pageCountry: string | null) =>
	(lang: Lang) => {
		const country = countryForm(COUNTRIES[pageCountry ?? ''], lang) ? pageCountry : null
		return pathFor(lang, routeYear == null && year === initialYear ? null : year, country)
	}
