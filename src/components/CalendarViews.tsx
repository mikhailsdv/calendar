import {Fragment, type JSX} from 'preact'
import {useEffect, useLayoutEffect, useRef, useState} from 'preact/hooks'

import {track} from '../analytics/metrika'
import type {Country} from '../data/types'
import {type DayInfo, dayOf} from '../domain/calendar'
import {
	addDays,
	daysInMonth,
	type ISODate,
	isoWeekday,
	isoWeekNumber,
	monthGrid,
	parseISO,
	toISO,
	weekdayOrder,
} from '../domain/dates'
import {type Season, seasonOf} from '../domain/seasons'
import {fmt, formatDate, localized, useI18n, weekdayName, weekdayShort} from '../i18n'
import {type Range, type Store, useStore} from '../state/store'
import s from './Calendar.module.css'
import {Flag} from './Flag'
import {LeafIcon, SnowflakeIcon, SproutIcon, SunIcon} from './icons'

export const countryColor = (id: string) => `var(--c-${id}, var(--c-fallback))`

const SEASON_ICON: Record<Season, () => JSX.Element> = {
	winter: () => <SnowflakeIcon />,
	spring: () => <SproutIcon />,
	summer: () => <SunIcon />,
	autumn: () => <LeafIcon />,
}

const rangeState = (date: ISODate, range: Range | null, hover: ISODate | null) => {
	if (!range) return null
	const end = range.end ?? hover
	if (!end) return date === range.start ? {kind: 'preview', edge: true} : null
	const [a, b] = range.start <= end ? [range.start, end] : [end, range.start]
	if (date < a || date > b) return null
	return {kind: range.end ? 'in' : 'preview', edge: date === a || date === b}
}

/** Даты, связанные переносом с выбранным днём, по всем активным странам */
export const transferPairs = (store: Store, date: ISODate | null) => {
	if (!date) return []
	const pairs: {country: Country; from: ISODate; to: ISODate}[] = []
	for (const country of store.countries.value) {
		const entry = dayOf(country, store.lookup.value, date).entry
		const t = entry?.transfer
		if (t?.from) pairs.push({country, from: t.from, to: date})
		if (t?.to) pairs.push({country, from: date, to: t.to})
	}
	return pairs
}

interface CellProps {
	date: ISODate
	infos: DayInfo[]
	countries: Country[]
	variant: 'mini' | 'big'
	label?: string
	/** Нерабочий день в основной стране — «красный день» */
	off: boolean
	today: boolean
	selected: boolean
	pair: boolean
	range: ReturnType<typeof rangeState>
	/** Другие выбранные страны, у которых этот будний день нерабочий: показываем точками их цвета */
	others: string[]
	ariaLabel: string
}

const DayCell = ({
	date,
	infos,
	countries,
	variant,
	label,
	off,
	today,
	selected,
	pair,
	range,
	others,
	ariaLabel,
}: CellProps) => (
	<button
		type="button"
		class={`${s.cell} ${variant === 'mini' ? s.mini : s.big} ${today ? s.today : ''}`}
		data-date={date}
		data-off={off ? '' : undefined}
		data-range={range?.kind}
		data-edge={range?.edge || undefined}
		data-pair={pair || undefined}
		data-c={countries[0]?.id}
		data-home={
			infos[0] && (infos[0].kind === 'holiday' || infos[0].kind === 'transfer')
				? infos[0].kind
				: undefined
		}
		aria-pressed={selected}
		aria-label={ariaLabel}
		title={ariaLabel}
	>
		<span class={s.dayNum}>{parseISO(date).day}</span>
		{variant === 'big' && label ? (
			<span class={s.label} title={label}>
				{label}
			</span>
		) : null}
		{others.length ? (
			<span class={s.dots} aria-hidden="true">
				{others.map(id => (
					<i key={id} data-c={id} />
				))}
			</span>
		) : null}
	</button>
)

/** Статус дня для скринридера: название праздника или тип дня; у обычного рабочего дня статуса нет */
const useDayStatus = () => {
	const i18n = useI18n()
	return (country: Country | undefined, info: DayInfo | undefined) => {
		if (!country || !info || info.kind === 'work') return null
		const holiday = info.entry?.holiday ? country.holidays[info.entry.holiday] : undefined
		if (info.kind === 'holiday' && holiday) return localized(holiday.name, i18n.lang)
		return i18n.t.kinds[info.kind]
	}
}

const useCellProps = () => {
	const store = useStore()
	const i18n = useI18n()
	const countries = store.countries.value
	const lookup = store.lookup.value
	const selected = store.mode.value === 'view' ? store.selected.value : null
	const pairs = new Set(transferPairs(store, selected).flatMap(p => [p.from, p.to]))
	const range = store.mode.value === 'vacation' ? store.range.value : null
	const hover = store.hover.value
	const today = store.today.value
	const showObservances = store.settings.value.showObservances
	const weekend = store.home.value.week.weekend
	const statusOf = useDayStatus()

	return (date: ISODate, variant: 'mini' | 'big'): CellProps => {
		const infos = countries.map(c => dayOf(c, lookup, date))
		let label: string | undefined
		if (variant === 'big') {
			const index = infos.findIndex(
				info => info.entry?.holiday && (info.kind === 'holiday' || showObservances)
			)
			if (index >= 0) {
				const holiday = countries[index]!.holidays[infos[index]!.entry!.holiday!]
				if (holiday) label = localized(holiday.name, i18n.lang)
			}
		}
		// Выходные у всех стран одинаковые, поэтому отмечаем только нерабочие будни других стран
		const others = countries.slice(1).filter((_, i) => infos[i + 1]!.off && !infos[i + 1]!.weekend)
		const statuses = [
			statusOf(countries[0], infos[0]),
			...others.map(
				c =>
					`${localized(c.name, i18n.lang)}: ${statusOf(c, infos[countries.indexOf(c)])?.toLowerCase()}`
			),
		].filter(Boolean)
		return {
			date,
			infos,
			countries,
			variant,
			label,
			off: infos[0] ? infos[0].off : weekend.includes(isoWeekday(date)),
			today: date === today,
			selected: date === selected,
			pair: pairs.has(date) && date !== selected,
			range: rangeState(date, range, hover),
			others: others.map(c => c.id),
			ariaLabel: withStatus(
				`${formatDate(i18n, date)}, ${weekdayName(i18n, date)}`,
				statuses.length ? statuses.join('; ') : null
			),
		}
	}
}

const WeekdayRow = () => {
	const store = useStore()
	const i18n = useI18n()
	const weekend = store.home.value.week.weekend
	return (
		<>
			{weekdayOrder(store.weekStart.value).map(day => (
				<span
					key={day}
					class={`${s.wd} ${weekend.includes(day) ? s.wdWeekend : ''}`}
					aria-hidden="true"
				>
					{weekdayShort(i18n, day)}
				</span>
			))}
		</>
	)
}

const seasonClass = (season: Season) => s[season]

const withStatus = (label: string, status: string | null) =>
	status ? `${label} — ${status}` : label

export const YearView = () => {
	const store = useStore()
	const {t} = useI18n()
	const year = store.year.value
	const cellProps = useCellProps()
	const hemisphere = store.home.value.seasons

	return (
		<div class={s.yearGrid}>
			{Array.from({length: 12}, (_, i) => i + 1).map(month => {
				const season = seasonOf(month, hemisphere)
				const Icon = SEASON_ICON[season]
				return (
					<section key={month} class={`${s.monthCard} ${seasonClass(season)}`}>
						<h3>
							<button
								type="button"
								class={s.monthHead}
								onClick={() => {
									store.month.value = month
									store.setView('month')
									track('view_change', {view: 'month'})
								}}
							>
								<span>{t.months[month - 1]}</span>
								<Icon />
							</button>
						</h3>
						<div class={s.miniGrid}>
							<WeekdayRow />
							{monthGrid(year, month, store.weekStart.value)
								.flat()
								.map((date, i) =>
									date ? (
										<DayCell key={date} {...cellProps(date, 'mini')} />
									) : (
										<span key={`e${i}`} />
									)
								)}
						</div>
					</section>
				)
			})}
		</div>
	)
}

/** Номер ISO-недели строки: по её понедельнику, даже если он в соседнем месяце */
const rowWeek = (row: (ISODate | null)[], weekStart: 1 | 7) => {
	const index = row.findIndex(Boolean)
	const monday = addDays(row[index]!, weekdayOrder(weekStart).indexOf(1) - index)
	return isoWeekNumber(monday)
}

export const MonthView = () => {
	const store = useStore()
	const {t} = useI18n()
	const year = store.year.value
	const month = store.month.value
	const weekStart = store.weekStart.value
	const showWeeks = store.settings.value.showWeekNumbers
	const cellProps = useCellProps()
	const season = seasonOf(month, store.home.value.seasons)
	const Icon = SEASON_ICON[season]

	return (
		<section class={`${s.monthView} ${seasonClass(season)}`}>
			<h3 class={s.band}>
				<Icon />
				<span>
					{t.months[month - 1]} {year}
				</span>
				<small>{t.seasons[season]}</small>
			</h3>
			<div class={`${s.bigGrid} ${showWeeks ? s.withWeeks : ''}`}>
				{showWeeks ? <span aria-hidden="true" /> : null}
				<WeekdayRow />
				{monthGrid(year, month, weekStart).map((row, r) => {
					const week = rowWeek(row, weekStart)
					return (
						<Fragment key={r}>
							{showWeeks ? (
								<span class={s.weekNum} title={fmt(t.details.week, {n: week})}>
									{week}
								</span>
							) : null}
							{row.map((date, i) =>
								date ? <DayCell key={date} {...cellProps(date, 'big')} /> : <span key={`e${i}`} />
							)}
						</Fragment>
					)
				})}
			</div>
		</section>
	)
}

export const LanesView = () => {
	const store = useStore()
	const i18n = useI18n()
	const {t} = i18n
	const year = store.year.value
	const month = store.month.value
	const countries = store.countries.value
	const lookup = store.lookup.value
	const days = Array.from({length: daysInMonth(year, month)}, (_, i) => toISO(year, month, i + 1))
	const selected = store.mode.value === 'view' ? store.selected.value : null
	const pairs = transferPairs(store, selected)
	const range = store.mode.value === 'vacation' ? store.range.value : null
	const hover = store.hover.value
	const home = store.home.value
	const today = store.today.value
	const season = seasonOf(month, home.seasons)
	const Icon = SEASON_ICON[season]
	const statusOf = useDayStatus()

	return (
		<section class={`${s.lanesWrap} ${seasonClass(season)}`}>
			<h3 class={s.band}>
				<Icon />
				<span>
					{t.months[month - 1]} {year}
				</span>
				<small>{t.seasons[season]}</small>
			</h3>
			<div class={s.lanesScroll}>
				<div class={s.lanes} style={{'--days': days.length}}>
					<span />
					{days.map(date => (
						<span
							key={date}
							class={`${s.laneHead} ${dayOf(home, lookup, date).off ? s.laneHeadWeekend : ''} ${date === today ? s.laneHeadToday : ''}`}
						>
							<b>{parseISO(date).day}</b>
							{weekdayShort(i18n, isoWeekday(date))}
						</span>
					))}
					{countries.map(country => (
						<LaneRow
							key={country.id}
							country={country}
							days={days}
							render={date => {
								const info = dayOf(country, lookup, date)
								const r = rangeState(date, range, hover)
								const isPair = pairs.some(
									p => p.country.id === country.id && (p.from === date || p.to === date)
								)
								return (
									<button
										type="button"
										key={date}
										class={s.lane}
										data-date={date}
										data-country={country.id}
										data-k={info.kind}
										data-range={r?.kind}
										data-pair={isPair && date !== selected ? '' : undefined}
										aria-pressed={date === selected}
										aria-label={withStatus(
											`${localized(country.name, i18n.lang)}: ${formatDate(i18n, date)}`,
											statusOf(country, info)
										)}
										data-c={country.id}
									/>
								)
							}}
						/>
					))}
				</div>
			</div>
		</section>
	)
}

const LaneRow = ({
	country,
	days,
	render,
}: {
	country: Country
	days: ISODate[]
	render: (date: ISODate) => JSX.Element
}) => (
	<>
		<span class={s.laneLabel}>
			<Flag code={country.id} />
			{country.iso}
		</span>
		{days.map(render)}
	</>
)

/** Дуги от дня-источника переноса к дню-получателю */
const TransferArrows = ({container}: {container: {current: HTMLDivElement | null}}) => {
	const store = useStore()
	const selected = store.mode.value === 'view' ? store.selected.value : null
	const pairs = transferPairs(store, selected)
	const view = store.settings.value.view
	const [paths, setPaths] = useState<{d: string; color: string; arrow: string}[]>([])
	const key = `${view}|${store.year.value}|${store.month.value}|${pairs.map(p => `${p.country.id}${p.from}${p.to}`).join()}`

	useLayoutEffect(() => {
		const root = container.current
		if (!root || !pairs.length) {
			setPaths([])
			return
		}
		const compute = () => {
			const base = root.getBoundingClientRect()
			const find = (date: ISODate, country: string) =>
				root.querySelector<HTMLElement>(
					view === 'lanes'
						? `[data-date="${date}"][data-country="${country}"]`
						: `[data-date="${date}"]`
				)
			const next: {d: string; color: string; arrow: string}[] = []
			for (const p of pairs) {
				const a = find(p.from, p.country.id)
				const b = find(p.to, p.country.id)
				if (!a || !b) continue
				const ra = a.getBoundingClientRect()
				const rb = b.getBoundingClientRect()
				const x1 = ra.left + ra.width / 2 - base.left
				const y1 = ra.top + ra.height / 2 - base.top
				const x2 = rb.left + rb.width / 2 - base.left
				const y2 = rb.top + rb.height / 2 - base.top
				// Дуга симметрично прогибается вниз от середины отрезка: вершина на sag px от прямой.
				// Контрольная точка квадратичной кривой вдвое дальше вершины
				const dx = x2 - x1
				const dy = y2 - y1
				const length = Math.hypot(dx, dy) || 1
				const sag = Math.min(36, Math.max(12, length / 6))
				let nx = -dy / length
				let ny = dx / length
				if (ny < 0 || (ny === 0 && nx < 0)) [nx, ny] = [-nx, -ny]
				const cx = (x1 + x2) / 2 + nx * sag * 2
				const cy = (y1 + y2) / 2 + ny * sag * 2
				// Стрелка по касательной в конце; линия обрывается у её основания, чтобы пунктир не торчал
				const tx = x2 - cx
				const ty = y2 - cy
				const t = Math.hypot(tx, ty) || 1
				const [ux, uy] = [tx / t, ty / t]
				const head = 9
				const bx = x2 - ux * head
				const by = y2 - uy * head
				next.push({
					d: `M${x1},${y1} Q${cx},${cy} ${bx},${by}`,
					color: countryColor(p.country.id),
					arrow: `${x2},${y2} ${bx - uy * 5},${by + ux * 5} ${bx + uy * 5},${by - ux * 5}`,
				})
			}
			setPaths(next)
		}
		compute()
		window.addEventListener('resize', compute)
		return () => window.removeEventListener('resize', compute)
		// key описывает всё, от чего зависят координаты
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key])

	if (!paths.length) return null
	return (
		<svg class={s.arrows} aria-hidden="true">
			{paths.map((p, i) => (
				<g key={i} style={{color: p.color}}>
					<path
						d={p.d}
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-dasharray="5 4"
						stroke-linecap="round"
						stroke-opacity="0.55"
					/>
					<polygon points={p.arrow} fill="currentColor" fill-opacity="0.85" />
				</g>
			))}
		</svg>
	)
}

/** Обёртка видов: делегирует клики, наведение и клавиатуру всем ячейкам сразу */
const EASE_OUT = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

const reduceMotion = () =>
	typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export const CalendarArea = () => {
	const store = useStore()
	const ref = useRef<HTMLDivElement>(null)
	const view = store.settings.value.view
	const year = store.year.value
	const month = store.month.value
	const shown = useRef({index: year * 12 + month, view})

	// Смена месяца в месячном виде: календарь чуть въезжает с той стороны, куда листают.
	// Двигаем всю область вместе с дугами переносов, поэтому их координаты не сбиваются
	useLayoutEffect(() => {
		const index = year * 12 + month
		const prev = shown.current
		shown.current = {index, view}
		const root = ref.current
		if (view !== 'month' || prev.view !== 'month' || index === prev.index || !root) return
		if (!('ready' in document.documentElement.dataset) || reduceMotion()) return
		const shift = index > prev.index ? 24 : -24
		root.animate?.(
			[
				{transform: `translateX(${shift}px)`, opacity: 0.4},
				{transform: 'none', opacity: 1},
			],
			{duration: 220, easing: EASE_OUT}
		)
	}, [year, month, view])

	// Свайп влево и вправо листает месяцы на телефоне. Слушатели пассивные: прокрутку не тормозят
	useEffect(() => {
		const root = ref.current
		if (!root) return
		let start: {x: number; y: number; time: number} | null = null
		const onStart = (e: TouchEvent) => {
			const touch = e.touches[0]
			start =
				e.touches.length === 1 && touch && store.settings.value.view === 'month'
					? {x: touch.clientX, y: touch.clientY, time: Date.now()}
					: null
		}
		const onEnd = (e: TouchEvent) => {
			const touch = e.changedTouches[0]
			const from = start
			start = null
			if (!from || !touch) return
			const dx = touch.clientX - from.x
			const dy = touch.clientY - from.y
			if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5 || Date.now() - from.time > 700) {
				return
			}
			const direction = dx < 0 ? 'next' : 'prev'
			if (store.shiftMonth(dx < 0 ? 1 : -1)) track('month_swipe', {direction})
		}
		root.addEventListener('touchstart', onStart, {passive: true})
		root.addEventListener('touchend', onEnd, {passive: true})
		return () => {
			root.removeEventListener('touchstart', onStart)
			root.removeEventListener('touchend', onEnd)
		}
	}, [store])

	const dateFrom = (target: EventTarget | null) =>
		(target as HTMLElement | null)?.closest<HTMLElement>('[data-date]')?.dataset.date ?? null

	const onClick = (e: MouseEvent) => {
		const date = dateFrom(e.target)
		if (!date) return
		const before = store.range.value
		store.clickDay(date)
		if (store.mode.value === 'view' && store.selected.value) track('day_open', {view})
		const after = store.range.value
		if (after?.end && before && !before.end) {
			track('vacation_select', {
				days: Math.round((Date.parse(after.end) - Date.parse(after.start)) / 864e5) + 1,
				countries: store.countries.value.length,
			})
		}
	}

	const onPointerOver = (e: PointerEvent) => {
		if (e.pointerType !== 'mouse') return
		const range = store.range.value
		if (store.mode.value !== 'vacation' || !range || range.end) return
		const date = dateFrom(e.target)
		if (date && date !== store.hover.value) store.hover.value = date
	}

	const onKeyDown = (e: KeyboardEvent) => {
		const date = dateFrom(document.activeElement)
		const step = {
			ArrowLeft: -1,
			ArrowRight: 1,
			ArrowUp: view === 'lanes' ? 0 : -7,
			ArrowDown: view === 'lanes' ? 0 : 7,
		}[e.key]
		if (!date || !step) return
		e.preventDefault()
		const next = addDays(date, step)
		store.goTo(next)
		requestAnimationFrame(() => {
			const selector =
				view === 'lanes'
					? `[data-date="${next}"][data-country="${(document.activeElement as HTMLElement)?.dataset.country}"]`
					: `[data-date="${next}"]`
			ref.current?.querySelector<HTMLElement>(selector)?.focus()
		})
	}

	return (
		<div
			ref={ref}
			class={s.area}
			onClick={onClick}
			onPointerOver={onPointerOver}
			onPointerLeave={() => (store.hover.value = null)}
			onKeyDown={onKeyDown}
		>
			{view === 'year' ? <YearView /> : view === 'month' ? <MonthView /> : <LanesView />}
			<TransferArrows container={ref} />
		</div>
	)
}

/** Обозначения: красный — нерабочий день основной страны, точка — нерабочий будний день другой страны */
export const Legend = () => {
	const {t, lang} = useI18n()
	const store = useStore()
	const home = store.home.value
	const others = store.countries.value.slice(1)
	const lanes = store.settings.value.view === 'lanes'
	return (
		<div class={s.legend} aria-label={t.legend.title}>
			<ul>
				{lanes ? (
					<>
						<li>
							<span class={`${s.swatch} ${s.swatchHoliday}`} data-c={home.id} aria-hidden="true" />
							{t.legend.holiday}
						</li>
						<li>
							<span class={`${s.swatch} ${s.swatchWeekend}`} data-c={home.id} aria-hidden="true" />
							{t.legend.weekend}
						</li>
					</>
				) : (
					<>
						<li>
							<span class={`${s.swatch} ${s.swatchOff}`} aria-hidden="true" />
							{fmt(t.legend.off, {country: localized(home.name, lang)})}
						</li>
						{others.length ? (
							<li>
								<span class={s.legendDots} aria-hidden="true">
									{others.map(c => (
										<i key={c.id} data-c={c.id} />
									))}
								</span>
								{t.legend.other}
							</li>
						) : null}
					</>
				)}
			</ul>
		</div>
	)
}
