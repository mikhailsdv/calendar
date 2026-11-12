import type {ComponentChildren} from 'preact'
import {useEffect, useMemo, useRef, useState} from 'preact/hooks'

import {track} from '../analytics/metrika'
import {shareUrl} from '../app/share'
import {YEARS} from '../data/loader'
import type {Country} from '../data/types'
import {activeRegime, dayOf, workdaysBetween} from '../domain/calendar'
import {diffDays, type ISODate, isoWeekday, isoWeekNumber, yearOf} from '../domain/dates'
import {computeLeave} from '../domain/leave'
import {bestWindows, improveSelection, searchRange} from '../domain/navigator'
import {upcomingHolidays} from '../domain/upcoming'
import {
	fmt,
	formatDate,
	formatRange,
	localized,
	plural,
	useI18n,
	weekdayName,
	weekdayShort,
} from '../i18n'
import {useStore} from '../state/store'
import {Flag} from './Flag'
import {
	CheckIcon,
	CloseIcon,
	LinkIcon,
	MinusIcon,
	PlusIcon,
	PointerIcon,
	SparklesIcon,
} from './icons'
import s from './Panel.module.css'
import {SHEET_MEDIA, useSheet} from './useSheet'

const CountryName = ({country}: {country: Country}) => {
	const {lang} = useI18n()
	return (
		<span class={s.country}>
			<Flag code={country.id} />
			{localized(country.name, lang)}
		</span>
	)
}

const useRatio = () => {
	const {lang} = useI18n()
	return useMemo(() => new Intl.NumberFormat(lang, {maximumFractionDigits: 1}), [lang])
}

/** «Завтра», «позавчера», «через 5 дней» */
const relativeDay = ({t, lang}: ReturnType<typeof useI18n>, delta: number) => {
	const near: Record<number, string> = {
		[-2]: t.details.beforeYesterday,
		[-1]: t.details.yesterday,
		0: t.details.today,
		1: t.details.tomorrow,
		2: t.details.afterTomorrow,
	}
	return (
		near[delta] ??
		(delta > 0 ? plural(lang, t.plural.inDays, delta) : plural(lang, t.plural.daysAgo, -delta))
	)
}

const useRelativeDay = (date: ISODate) => {
	const today = useStore().today.value
	const i18n = useI18n()
	return today ? relativeDay(i18n, diffDays(today, date)) : null
}

/** Ближайшие праздники выбранных стран — на десктопе вместо пустой панели */
const Upcoming = () => {
	const store = useStore()
	const i18n = useI18n()
	const {t, lang} = i18n
	const today = store.today.value
	const countries = store.countries.value
	const lookup = store.lookup.value
	const items = useMemo(
		() => (today ? upcomingHolidays(countries, lookup, today) : []),
		[countries, lookup, today]
	)
	if (!items.length) return null

	return (
		<section class={s.upcoming} aria-labelledby="upcoming-title">
			<h3 id="upcoming-title" class={s.navTitle}>
				{t.upcoming.title}
			</h3>
			<ul class={s.windows}>
				{items.map(item => (
					<li key={item.date}>
						<button
							type="button"
							class={s.window}
							onClick={() => {
								store.goTo(item.date)
								store.selected.value = item.date
								track('upcoming_open', {
									country: item.countries[0]!.id,
									days_until: item.daysUntil,
								})
							}}
						>
							<div>
								{item.holiday ? localized(item.holiday.name, lang) : t.kinds.holiday}
								<span>
									{formatDate(i18n, item.date, 'short')},{' '}
									{weekdayShort(i18n, isoWeekday(item.date))} · {relativeDay(i18n, item.daysUntil)}
									{item.rest.days >= 3
										? ` · ${fmt(t.upcoming.rest, {days: plural(lang, t.plural.days, item.rest.days)})}`
										: ''}
								</span>
							</div>
							<span class={s.flags}>
								{item.countries.map(c => (
									<Flag key={c.id} code={c.id} />
								))}
							</span>
						</button>
					</li>
				))}
			</ul>
		</section>
	)
}

const DayHead = ({date, actions}: {date: ISODate; actions: ComponentChildren}) => {
	const i18n = useI18n()
	const relative = useRelativeDay(date)
	return (
		<div class={s.headRow}>
			<div>
				<p class={s.title}>{formatDate(i18n, date)}</p>
				<p class={s.sub}>
					{weekdayName(i18n, date)} · {fmt(i18n.t.details.week, {n: isoWeekNumber(date)})}
					{relative ? ` · ${relative}` : ''}
				</p>
			</div>
			<span class={s.headActions}>{actions}</span>
		</div>
	)
}

const DayRows = ({date}: {date: ISODate}) => {
	const store = useStore()
	const i18n = useI18n()
	const {t, lang} = i18n
	const today = store.today.value
	const lookup = store.lookup.value
	const showObservances = store.settings.value.showObservances
	const ahead = today != null && diffDays(today, date) > 0

	const show = (country: Country, target: ISODate) => {
		store.goTo(target)
		store.selected.value = target
		track('transfer_open', {country: country.id})
	}

	return (
		<ul class={s.rows}>
			{store.countries.value.map(country => {
				const info = dayOf(country, lookup, date)
				const yearData = lookup(country.id, yearOf(date))
				const entry = info.entry
				const holiday = entry?.holiday ? country.holidays[entry.holiday] : undefined
				const regime = info.observance ? activeRegime(country, yearData, date) : undefined
				const status = info.noData
					? t.kinds.noData
					: holiday && (info.kind === 'holiday' || showObservances)
						? localized(holiday.name, lang)
						: t.kinds[info.kind]
				const kindLabel =
					info.kind === 'holiday' || !holiday
						? null
						: info.observance
							? t.kinds.observance
							: t.kinds[info.kind]
				const workdays = today && ahead ? workdaysBetween(country, lookup, today, date) : null
				return (
					<li key={country.id} class={s.row} data-c={country.id}>
						<span class={s.stripe} />
						<CountryName country={country} />
						<div>
							<p class={`${s.status} ${info.off ? s.off : ''}`}>
								{status}
								{kindLabel && kindLabel !== status ? ` · ${kindLabel}` : ''}
								{yearData?.status === 'forecast' ? (
									<>
										{' '}
										<span class="badge">{t.details.forecast}</span>
									</>
								) : null}
							</p>
							{entry?.transfer?.from ? (
								<p class={s.meta}>
									{fmt(t.details.transferFrom, {
										date: formatDate(i18n, entry.transfer.from, 'short'),
									})}{' '}
									<button
										type="button"
										class={s.linkBtn}
										onClick={() => show(country, entry.transfer!.from!)}
									>
										{t.details.show}
									</button>
								</p>
							) : null}
							{entry?.transfer?.to ? (
								<p class={s.meta}>
									{fmt(t.details.transferTo, {
										date: formatDate(i18n, entry.transfer.to, 'short'),
									})}{' '}
									<button
										type="button"
										class={s.linkBtn}
										onClick={() => show(country, entry.transfer!.to!)}
									>
										{t.details.show}
									</button>
								</p>
							) : null}
							{info.shortBy ? (
								<p class={s.meta}>{fmt(t.details.shortBy, {n: info.shortBy})}</p>
							) : null}
							{entry?.tentative ? <p class={s.meta}>{t.details.tentative}</p> : null}
							{regime ? (
								<p class={s.meta}>{fmt(t.details.regime, {name: localized(regime.name, lang)})}</p>
							) : null}
							{workdays != null ? (
								<p class={s.meta}>
									{t.details.workdaysUntil}: {plural(lang, t.plural.workdays, workdays)}
								</p>
							) : null}
						</div>
					</li>
				)
			})}
		</ul>
	)
}

const VacationResult = ({from, to}: {from: ISODate; to: ISODate}) => {
	const store = useStore()
	const i18n = useI18n()
	const {t, lang} = i18n
	const lookup = store.lookup.value
	const ratio = useRatio()
	const home = store.home.value
	const hint = useMemo(() => improveSelection(home, lookup, from, to), [home, lookup, from, to])

	return (
		<>
			<ul class={s.rows}>
				{store.countries.value.map(country => {
					const r = computeLeave(country, lookup, from, to)
					const unit =
						country.leave.unit === 'working' ? t.vacation.chargedWorking : t.vacation.charged
					return (
						<li key={country.id} class={s.row} data-c={country.id}>
							<span class={s.stripe} />
							<div class={s.hintRow}>
								<CountryName country={country} />
								<span class={s.ratio}>{fmt(t.vacation.ratio, {x: ratio.format(r.ratio)})}</span>
							</div>
							<div>
								<p class={s.status}>
									{t.vacation.rest}: {plural(lang, t.plural.days, r.rest.days)}
									<span class={s.meta}> · {formatRange(i18n, r.rest.from, r.rest.to)}</span>
								</p>
								<p class={s.stats}>
									<span>
										{unit}: {r.charged}
									</span>
									<span>{fmt(t.vacation.workdays, {n: r.workdays})}</span>
									{r.holidaysInside ? (
										<span>{fmt(t.vacation.holidaysInside, {n: r.holidaysInside})}</span>
									) : null}
								</p>
							</div>
						</li>
					)
				})}
			</ul>
			{hint ? (
				<div class={s.hint}>
					<b>
						{t.vacation.hintTitle} · {localized(home.name, lang)}
					</b>
					<div class={s.hintRow}>
						<span>
							{fmt(t.vacation.hintText, {
								range: formatRange(i18n, hint.from, hint.to),
								rest: plural(lang, t.plural.days, hint.result.rest.days),
								charged: plural(lang, t.plural.days, hint.result.charged),
							})}
						</span>
						<button
							type="button"
							class="btn"
							onClick={() => {
								store.setRange(hint.from, hint.to)
								track('magnet_hint_apply', {
									country: home.id,
									rest_gain: hint.restGain,
									charged_saved: hint.chargedSaved,
								})
							}}
						>
							{t.vacation.apply}
						</button>
					</div>
				</div>
			) : null}
		</>
	)
}

const Navigator = () => {
	const store = useStore()
	const i18n = useI18n()
	const {t, lang} = i18n
	const countries = store.countries.value
	const selectedId = store.navigatorCountry.value
	const country = countries.find(c => c.id === selectedId) ?? store.home.value
	const budget = store.settings.value.budget
	const year = store.year.value
	const lookup = store.lookup.value
	const today = store.today.value
	const ratio = useRatio()

	const range = useMemo(() => searchRange(year, today, YEARS[YEARS.length - 1]!), [year, today])
	const windows = useMemo(
		() => bestWindows(country, lookup, {from: range.from, to: range.to, budget}),
		[country, lookup, range, budget]
	)

	const setBudget = (value: number) => {
		const next = Math.min(28, Math.max(1, value))
		store.updateSettings({budget: next})
		track('navigator_budget_change', {budget: next})
	}

	return (
		<section class={s.navigator} aria-labelledby="navigator-title">
			<div>
				<h3 id="navigator-title" class={s.navTitle}>
					<SparklesIcon />
					{t.navigator.title}
				</h3>
				<p class={s.horizon}>
					{range.ahead ? t.navigator.horizon : fmt(t.navigator.horizonYear, {year})}
				</p>
			</div>
			<div class={s.controls}>
				<span>{t.navigator.budget}</span>
				<span class={s.stepper}>
					<button
						type="button"
						class="btn btn-icon"
						aria-label="−"
						onClick={() => setBudget(budget - 1)}
					>
						<MinusIcon />
					</button>
					<output aria-live="polite">{budget}</output>
					<button
						type="button"
						class="btn btn-icon"
						aria-label="+"
						onClick={() => setBudget(budget + 1)}
					>
						<PlusIcon />
					</button>
				</span>
				{countries.length > 1 ? (
					<select
						aria-label={t.navigator.country}
						value={country.id}
						onChange={e => (store.navigatorCountry.value = (e.target as HTMLSelectElement).value)}
					>
						{countries.map(c => (
							<option key={c.id} value={c.id}>
								{localized(c.name, lang)}
							</option>
						))}
					</select>
				) : null}
			</div>
			{windows.length ? (
				<ul class={s.windows}>
					{windows.map(w => (
						<li key={w.from}>
							<button
								type="button"
								class={s.window}
								onClick={() => {
									store.setRange(w.from, w.to)
									track('navigator_apply', {
										country: country.id,
										rest: w.rest.days,
										charged: w.charged,
									})
								}}
							>
								<div>
									{formatRange(i18n, w.from, w.to)}
									<span>
										{fmt(t.navigator.item, {
											rest: plural(lang, t.plural.days, w.rest.days),
											charged: plural(lang, t.plural.days, w.charged),
										})}{' '}
										· {formatRange(i18n, w.rest.from, w.rest.to)}
									</span>
								</div>
								<span class={s.ratio}>{fmt(t.vacation.ratio, {x: ratio.format(w.ratio)})}</span>
							</button>
						</li>
					))}
				</ul>
			) : (
				<p class={s.empty}>{t.navigator.empty}</p>
			)}
		</section>
	)
}

/**
 * Ссылка на выбранный отпуск. На телефоне — системное меню «Поделиться»,
 * на компьютере ссылка копируется, а кнопка ненадолго показывает «Скопировано».
 */
const ShareButton = ({from, to}: {from: ISODate; to: ISODate}) => {
	const store = useStore()
	const {t, lang} = useI18n()
	const [copied, setCopied] = useState(false)

	useEffect(() => {
		if (!copied) return
		const timer = setTimeout(() => setCopied(false), 2000)
		return () => clearTimeout(timer)
	}, [copied])

	const share = () => {
		const countries = store.settings.value.countries
		const url = shareUrl(location.origin, lang, {countries, from, to})
		const params = {days: diffDays(from, to) + 1, countries: countries.length}
		if (typeof navigator.share === 'function' && matchMedia('(pointer: coarse)').matches) {
			track('share_click', {method: 'native', ...params})
			navigator.share({url, title: document.title}).catch(() => {})
			return
		}
		track('share_click', {method: 'clipboard', ...params})
		navigator.clipboard?.writeText(url).then(
			() => setCopied(true),
			() => {}
		)
	}

	return (
		<button
			type="button"
			class={`btn btn-ghost btn-sm ${copied ? s.copied : 'btn-icon'}`}
			aria-label={t.vacation.share}
			title={t.vacation.share}
			onClick={share}
		>
			{copied ? (
				<>
					<CheckIcon />
					<span aria-live="polite">{t.vacation.copied}</span>
				</>
			) : (
				<LinkIcon />
			)}
		</button>
	)
}

export const Panel = () => {
	const store = useStore()
	const i18n = useI18n()
	const {t} = i18n
	const mode = store.mode.value
	const range = store.range.value
	const selected = store.selected.value
	const visible = mode === 'vacation' || selected != null
	const [collapsed, setCollapsed] = useState(false)
	// Пока выбирают даты, шторка свёрнута и не закрывает календарь; итог отпуска и детали дня раскрываются сами
	useEffect(
		() => setCollapsed(mode === 'vacation' && !range?.end),
		[mode, range?.start, range?.end, selected]
	)
	const collapsedRef = useRef(collapsed)
	useEffect(() => {
		collapsedRef.current = collapsed
	}, [collapsed])

	/** Сворачивание шторки действием пользователя — с событием аналитики */
	const changeSheet = (next: boolean, via: 'tap' | 'drag' | 'outside' | 'keyboard') => {
		if (next !== collapsedRef.current) {
			track('sheet_toggle', {state: next ? 'collapse' : 'expand', via})
		}
		setCollapsed(next)
	}
	const {sheetRef, headRef, handlers} = useSheet(collapsed, changeSheet, visible)
	const open = visible ? (collapsed ? 'peek' : 'full') : undefined

	const close = () => {
		if (mode === 'vacation' && range) track('vacation_cancel')
		store.cancel()
	}

	// Касание снаружи: детали дня закрываются, шторка отпуска сворачивается.
	// Нажатие на другой день не закрывает детали — оно просто выбирает новый день
	useEffect(() => {
		const onClick = (e: MouseEvent) => {
			const target = e.target as Element | null
			if (!target?.isConnected || !matchMedia(SHEET_MEDIA).matches) return
			if (sheetRef.current?.contains(target) || target.closest('dialog')) return
			if (store.mode.value === 'vacation') {
				if (!collapsedRef.current) track('sheet_toggle', {state: 'collapse', via: 'outside'})
				setCollapsed(true)
			} else if (store.selected.value && !target.closest('[data-date]')) {
				track('sheet_toggle', {state: 'close', via: 'outside'})
				store.selected.value = null
			}
		}
		document.addEventListener('click', onClick)
		return () => document.removeEventListener('click', onClick)
	}, [store, sheetRef])

	const vacationHead = (
		<>
			<div class={s.headRow}>
				{range?.end ? (
					<div>
						<p class={s.title}>{formatRange(i18n, range.start, range.end)}</p>
						<p class={s.sub}>
							{t.vacation.title} · {t.vacation.calendarDays}: {diffDays(range.start, range.end) + 1}
						</p>
					</div>
				) : (
					<p class={s.title}>{t.vacation.title}</p>
				)}
				<span class={s.headActions}>
					{range?.end ? <ShareButton from={range.start} to={range.end} /> : null}
					{range ? (
						<button type="button" class="btn btn-danger btn-sm" onClick={close}>
							{t.vacation.clear}
						</button>
					) : collapsed ? (
						<button
							type="button"
							class={`btn btn-ghost btn-sm ${s.navBtn}`}
							onClick={() => changeSheet(false, 'tap')}
						>
							<SparklesIcon />
							<span>{t.navigator.title}</span>
						</button>
					) : null}
				</span>
			</div>
			{range?.end ? null : (
				<p class="alert">
					<PointerIcon />
					{range ? t.vacation.pickEnd : t.vacation.pickStart}
				</p>
			)}
		</>
	)

	return (
		<aside ref={sheetRef} class={s.panel} data-open={open} data-print="hide">
			{visible ? (
				<div ref={headRef} class={s.sheetHead} aria-live="polite" {...handlers}>
					<button
						type="button"
						class={s.grabber}
						data-grabber
						aria-expanded={!collapsed}
						aria-label={collapsed ? t.panel.expand : t.panel.collapse}
						// Касание и перетаскивание обрабатывает шапка, а клик без мыши приходит с клавиатуры
						onClick={e => e.detail === 0 && changeSheet(!collapsed, 'keyboard')}
					/>
					{mode === 'vacation' ? (
						vacationHead
					) : (
						<DayHead
							date={selected!}
							actions={
								<button
									type="button"
									class={`btn btn-ghost btn-icon ${s.close}`}
									aria-label={t.details.close}
									title={t.details.close}
									onClick={close}
								>
									<CloseIcon />
								</button>
							}
						/>
					)}
				</div>
			) : null}
			<div class={s.body}>
				{mode === 'vacation' ? (
					<>
						{range?.end ? <VacationResult from={range.start} to={range.end} /> : null}
						<Navigator />
					</>
				) : selected ? (
					<DayRows date={selected} />
				) : (
					<>
						<Upcoming />
						<p class={s.empty}>{t.details.empty}</p>
					</>
				)}
			</div>
		</aside>
	)
}
