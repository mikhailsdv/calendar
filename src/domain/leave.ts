import type {Country, YearLookup} from '../data/types'
import {dayOf, leaveNotCountedOn} from './calendar'
import {addDays, diffDays, type ISODate, yearOf} from './dates'
import {vacationMoney} from './money'

export interface LeaveResult {
	from: ISODate
	to: ISODate
	calendarDays: number
	/** Сколько дней спишется из отпуска по правилам страны */
	charged: number
	/** Нерабочих праздников внутри отпуска */
	holidaysInside: number
	/** Рабочих дней страны внутри отпуска: столько человек выпадает из работы */
	workdays: number
	/** Непрерывный отдых: отпуск плюс прилегающие нерабочие дни */
	rest: {from: ISODate; to: ISODate; days: number}
	/** Дней отдыха на один списанный день */
	ratio: number
	/** Отпускные минус зарплата за эти дни, в долях месячного оклада (см. money.ts) */
	money: number
}

/** Дальше этого не расширяем окно отдыха (защита от бесконечного цикла на кривых данных) */
const MAX_EXPAND = 60

/** Списывается ли этот день из отпуска (1) или нет (0) */
export const chargesDay = (country: Country, lookup: YearLookup, date: ISODate) => {
	const info = dayOf(country, lookup, date)
	if (country.leave.unit === 'working') return info.off ? 0 : 1
	const type = info.entry?.type
	const notCounted = leaveNotCountedOn(country, lookup(country.id, yearOf(date)), date)
	return type && notCounted.includes(type) ? 0 : 1
}

export const computeLeave = (
	country: Country,
	lookup: YearLookup,
	from: ISODate,
	to: ISODate
): LeaveResult => {
	if (to < from) [from, to] = [to, from]
	let charged = 0
	let holidaysInside = 0
	let workdays = 0
	for (let d = from; d <= to; d = addDays(d, 1)) {
		const info = dayOf(country, lookup, d)
		if (info.kind === 'holiday') holidaysInside++
		if (!info.off) workdays++
		charged += chargesDay(country, lookup, d)
	}

	let restFrom = from
	let restTo = to
	for (let i = 0; i < MAX_EXPAND && dayOf(country, lookup, addDays(restFrom, -1)).off; i++) {
		restFrom = addDays(restFrom, -1)
	}
	for (let i = 0; i < MAX_EXPAND && dayOf(country, lookup, addDays(restTo, 1)).off; i++) {
		restTo = addDays(restTo, 1)
	}
	const restDays = diffDays(restFrom, restTo) + 1

	return {
		from,
		to,
		calendarDays: diffDays(from, to) + 1,
		charged,
		holidaysInside,
		workdays,
		rest: {from: restFrom, to: restTo, days: restDays},
		ratio: restDays / Math.max(charged, 1),
		money: vacationMoney(country, lookup, from, to, d => chargesDay(country, lookup, d)),
	}
}
