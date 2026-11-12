import {useEffect, useMemo, useState} from 'preact/hooks'

import {track} from '../analytics/metrika'
import type {Country} from '../data/types'
import {yearEvents, yearTotals} from '../domain/calendar'
import {isoWeekday} from '../domain/dates'
import {fmt, formatDate, localized, useI18n, weekdayShort} from '../i18n'
import {useStore} from '../state/store'
import {Flag} from './Flag'
import s from './Layout.module.css'
import {Spoiler} from './Spoiler'

const CountryHead = ({country, as: Tag = 'h3'}: {country: Country; as?: 'h3' | 'span'}) => {
	const {lang} = useI18n()
	return (
		<Tag class={s.countryTitle}>
			<Flag code={country.id} />
			{localized(country.name, lang)}
		</Tag>
	)
}

export const CompareSection = () => {
	const store = useStore()
	const {t} = useI18n()
	const year = store.year.value
	const countries = store.countries.value
	const lookup = store.lookup.value
	const norm = String(store.settings.value.hoursNorm)
	const [monthlyOpen, setMonthlyOpen] = useState(false)

	const stats = useMemo(
		() =>
			countries.map(country => {
				const data = lookup(country.id, year)
				return {country, data, ...yearTotals(country, data, year)}
			}),
		[countries, lookup, year]
	)

	const cell = (value: number | null | undefined, hasData: boolean) =>
		hasData && value != null ? value : '—'

	return (
		<section class={s.section} aria-labelledby="compare-title">
			<h2 id="compare-title">{fmt(t.compare.title, {year})}</h2>
			<div class="table-wrap">
				<table class="table">
					<thead>
						<tr>
							<th scope="col">{t.compare.metric}</th>
							{stats.map(({country}) => (
								<th key={country.id} scope="col">
									<CountryHead country={country} as="span" />
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						<tr>
							<th scope="row">{t.compare.status}</th>
							{stats.map(({country, data}) => (
								<td key={country.id}>
									{!data ? (
										t.compare.noData
									) : data.status === 'official' ? (
										t.compare.official
									) : (
										<span class="badge">{t.compare.forecast}</span>
									)}
								</td>
							))}
						</tr>
						<tr>
							<th scope="row">{t.compare.workdays}</th>
							{stats.map(({country, data, total}) => (
								<td key={country.id} class="num">
									{cell(total.workdays, Boolean(data))}
								</td>
							))}
						</tr>
						<tr>
							<th scope="row">{t.compare.offdays}</th>
							{stats.map(({country, data, total}) => (
								<td key={country.id} class="num">
									{cell(total.offdays, Boolean(data))}
								</td>
							))}
						</tr>
						<tr>
							<th scope="row">{t.compare.holidays}</th>
							{stats.map(({country, data, total}) => (
								<td key={country.id} class="num">
									{cell(total.holidays, Boolean(data))}
									{data && total.holidaysOnWeekend ? (
										<div class={s.muted}>
											{t.compare.holidaysOnWeekend}: {total.holidaysOnWeekend}
										</div>
									) : null}
								</td>
							))}
						</tr>
						<tr>
							<th scope="row">{fmt(t.compare.hours, {n: norm})}</th>
							{stats.map(({country, data, total}) => (
								<td key={country.id} class="num">
									{cell(total.hours[norm], Boolean(data))}
								</td>
							))}
						</tr>
						<tr>
							<th scope="row">{t.compare.minLeave}</th>
							{stats.map(({country}) => (
								<td key={country.id}>
									{country.leave.minDays == null
										? '—'
										: fmt(
												country.leave.unit === 'working'
													? t.compare.leaveWorking
													: t.compare.leaveCalendar,
												{n: country.leave.minDays}
											)}
								</td>
							))}
						</tr>
					</tbody>
				</table>
			</div>
			<Spoiler
				class={s.details}
				open={monthlyOpen}
				onOpenChange={next => {
					setMonthlyOpen(next)
					track('spoiler_toggle', {section: 'monthly', state: next ? 'open' : 'close'})
				}}
				summary={t.compare.monthly}
			>
				<div class="table-wrap">
					<table class="table">
						<thead>
							<tr>
								<th scope="col">{t.compare.month}</th>
								{stats.map(({country}) => (
									<th key={country.id} scope="col">
										<CountryHead country={country} as="span" />
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{t.months.map((name, i) => (
								<tr key={name}>
									<th scope="row" style={{textTransform: 'capitalize'}}>
										{name}
									</th>
									{stats.map(({country, data, months}) => (
										<td key={country.id} class="num">
											{data ? `${months[i]!.workdays} / ${months[i]!.hours[norm] ?? '—'}` : '—'}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</Spoiler>
		</section>
	)
}

/** Сколько стран показываем без спойлеров и сколько первых блоков открыто по умолчанию */
const OPEN_BY_DEFAULT = 2

const CountryHolidays = ({country}: {country: Country}) => {
	const store = useStore()
	const i18n = useI18n()
	const {t, lang} = i18n
	const data = store.lookup.value(country.id, store.year.value)
	const showObservances = store.settings.value.showObservances
	const events = yearEvents(data).filter(e => showObservances || e.entry.type !== 'observance')

	return (
		<>
			{data?.status === 'forecast' ? <p class={s.muted}>{t.holidays.forecastNote}</p> : null}
			{events.length ? (
				<div class="table-wrap">
					<table class="table">
						<thead>
							<tr>
								<th scope="col">{t.holidays.date}</th>
								<th scope="col">{t.holidays.name}</th>
								<th scope="col">{t.holidays.note}</th>
							</tr>
						</thead>
						<tbody>
							{events.map(({date, entry}) => {
								const holiday = entry.holiday ? country.holidays[entry.holiday] : undefined
								const notes: string[] = []
								if (entry.type === 'holiday') notes.push(t.holidays.dayOff)
								if (entry.type === 'observance') notes.push(t.holidays.noDayOff)
								if (entry.transfer?.from)
									notes.push(
										fmt(t.holidays.transferFrom, {
											date: formatDate(i18n, entry.transfer.from, 'short'),
										})
									)
								if (entry.transfer?.to)
									notes.push(
										fmt(t.holidays.workdayFor, {
											date: formatDate(i18n, entry.transfer.to, 'short'),
										})
									)
								if (entry.tentative) notes.push(t.holidays.tentative)
								const name = holiday
									? localized(holiday.name, lang)
									: entry.type === 'workday'
										? t.kinds.workweekend
										: t.kinds.transfer
								return (
									<tr key={date}>
										<td style={{whiteSpace: 'nowrap'}}>
											<time dateTime={date}>{formatDate(i18n, date, 'short')}</time>,{' '}
											{weekdayShort(i18n, isoWeekday(date))}
										</td>
										<td>{name}</td>
										<td class={s.muted}>{notes.join(', ')}</td>
									</tr>
								)
							})}
						</tbody>
					</table>
				</div>
			) : (
				<p class={s.muted}>{t.compare.noData}</p>
			)}
			{data?.sources.length ? (
				<p class={s.sources}>
					{t.holidays.sources}:{' '}
					{data.sources.map(src => (
						<a key={src.url} href={src.url} target="_blank" rel="noopener nofollow">
							{src.title}
						</a>
					))}
				</p>
			) : null}
		</>
	)
}

export const HolidaysSection = () => {
	const store = useStore()
	const {t} = useI18n()
	const countries = store.countries.value
	const ids = countries.map(c => c.id).join()
	// Явный выбор пользователя по странам; без него открыты первые две
	const [toggled, setToggled] = useState<Record<string, boolean>>({})

	// Убранная страна забывает своё состояние: если её вернуть, она снова будет свёрнута
	useEffect(() => {
		setToggled(prev => {
			const kept = Object.entries(prev).filter(([id]) => ids.split(',').includes(id))
			return kept.length === Object.keys(prev).length ? prev : Object.fromEntries(kept)
		})
	}, [ids])

	const spoilers = countries.length > OPEN_BY_DEFAULT

	return (
		<section class={s.section} aria-labelledby="holidays-title">
			<h2 id="holidays-title">{fmt(t.holidays.title, {year: store.year.value})}</h2>
			{countries.map((country, index) => {
				if (!spoilers)
					return (
						<div key={country.id} class={s.countryBlock}>
							<CountryHead country={country} />
							<CountryHolidays country={country} />
						</div>
					)
				const open = toggled[country.id] ?? index < OPEN_BY_DEFAULT
				return (
					<Spoiler
						key={country.id}
						class={s.countryBlock}
						open={open}
						onOpenChange={next => {
							setToggled(prev => ({...prev, [country.id]: next}))
							track('spoiler_toggle', {
								section: 'holidays',
								country: country.id,
								state: next ? 'open' : 'close',
							})
						}}
						heading
						summary={<CountryHead country={country} as="span" />}
					>
						<CountryHolidays country={country} />
					</Spoiler>
				)
			})}
		</section>
	)
}

export const RulesSection = () => {
	const store = useStore()
	const {t} = useI18n()
	return (
		<section class={s.section} aria-labelledby="rules-title">
			<h2 id="rules-title">{t.rules.title}</h2>
			<div class={s.rules}>
				{store.countries.value.map(country => {
					const r = country.rules
					const leave = country.leave
					const items = [
						t.rules.weekendHoliday[r.weekendHoliday],
						r.decreeTransfers ? t.rules.decree : null,
						r.preHolidayShortening
							? fmt(t.rules.shortening, {n: r.preHolidayShortening.hours})
							: t.rules.noShortening,
						leave.minDays != null
							? fmt(leave.unit === 'working' ? t.rules.leaveWorking : t.rules.leaveCalendar, {
									n: leave.minDays,
								})
							: null,
						t.rules.notes[country.id] ?? null,
					].filter(Boolean)
					return (
						<div key={country.id}>
							<CountryHead country={country} />
							<ul>
								{items.map(item => (
									<li key={item}>{item}</li>
								))}
							</ul>
						</div>
					)
				})}
			</div>
		</section>
	)
}
