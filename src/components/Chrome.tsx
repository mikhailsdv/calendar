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
import {ChevronLeft, ChevronRight, MoonIcon, PrinterIcon, SettingsIcon, SunIcon} from './icons'
import s from './Layout.module.css'
import {revealDate} from './reveal'

export const LangSwitcher = ({hrefFor}: {hrefFor: (lang: Lang) => string}) => {
	const store = useStore()
	const {lang, t} = useI18n()
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

	return (
		<div class={s.langWrap} ref={ref}>
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
			class="btn btn-icon"
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
			<p class={s.subtitle}>{fmt(t.header.subtitle, {n: MAX_COUNTRIES})}</p>
			<nav class={s.actions} aria-label={t.header.settings}>
				<LangSwitcher hrefFor={hrefFor} />
				<ThemeToggle />
				<button
					type="button"
					class={`btn btn-icon ${s.printBtn}`}
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
			<button type="button" class={`btn ${s.today}`} onClick={goToday}>
				{t.toolbar.today}
			</button>
		</div>
	)
}

/**
 * Выбор стран. По умолчанию одна страна: нажатие на чип делает её основной.
 * «Сравнить» включает наложение: чипы добавляют и убирают страны, выбор помнится в localStorage
 */
export const CountryChips = () => {
	const store = useStore()
	const {t, lang} = useI18n()
	const {countries: saved, compare} = store.settings.value
	const active = compare ? saved : saved.slice(0, 1)
	return (
		// Одну страну на печати не показываем: её называет заголовок
		<div
			class={s.chips}
			role="group"
			aria-label={t.toolbar.countries}
			data-print={active.length > 1 ? undefined : 'hide'}
		>
			{COUNTRY_IDS.map(id => {
				const country = COUNTRIES[id]!
				const pressed = active.includes(id)
				return (
					<button
						key={id}
						type="button"
						class={s.chip}
						aria-pressed={pressed}
						data-c={id}
						onClick={() => {
							if (!compare) {
								if (pressed) return
								store.setHome(id)
								track('home_change', {country: id})
								return
							}
							const ok = store.toggleCountry(id)
							if (!ok) track('country_limit_hit', {country: id})
							else
								track('country_toggle', {
									country: id,
									action: pressed ? 'remove' : 'add',
									count: store.settings.value.countries.length,
								})
						}}
					>
						<Flag code={id} />
						{localized(country.name, lang)}
						{compare && pressed && active[0] === id ? (
							<span class={s.home}>· {t.toolbar.home}</span>
						) : null}
					</button>
				)
			})}
			<button
				type="button"
				class={`btn btn-sm ${s.compare}`}
				aria-pressed={compare}
				data-print="hide"
				onClick={() => {
					store.setCompare(!compare)
					track('compare_toggle', {state: compare ? 'off' : 'on'})
				}}
			>
				{t.toolbar.compare}
			</button>
			{store.limitHit.value ? (
				<span class={s.limit} role="status">
					{fmt(t.toolbar.countryLimit, {n: MAX_COUNTRIES})}
				</span>
			) : null}
		</div>
	)
}

export const SettingsDialog = () => {
	const store = useStore()
	const {t, lang} = useI18n()
	const ref = useRef<HTMLDialogElement>(null)
	const open = store.settingsOpen.value
	const settings = store.settings.value

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
			<label class={s.field}>
				{t.settings.homeCountry}
				<select
					value={settings.countries[0]}
					onChange={e => {
						const id = (e.target as HTMLSelectElement).value
						store.setHome(id)
						track('home_change', {country: id})
					}}
				>
					{COUNTRY_IDS.map(id => (
						<option key={id} value={id}>
							{localized(COUNTRIES[id]!.name, lang)}
						</option>
					))}
				</select>
				<small>{t.settings.homeHint}</small>
			</label>
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
