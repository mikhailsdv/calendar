import type {Country, YearLookup} from '../data/types'
import {dayOf} from './calendar'
import {addDays, diffDays, type ISODate, minDate, toISO, yearOf} from './dates'
import {chargesDay, computeLeave, type LeaveResult} from './leave'

interface BestWindowsOptions {
	/** Первый день, с которого может начаться отпуск */
	from: ISODate
	/** Последний день, которым может начаться отпуск */
	to: ISODate
	/** Сколько дней отпуска готовы потратить */
	budget: number
	limit?: number
	/** Что искать: больше дней отдыха или больше денег (см. money.ts) */
	goal?: 'rest' | 'money'
}

/**
 * Где искать окна. В текущем году — с сегодняшнего дня на 12 месяцев вперёд, чтобы в ноябре
 * не терять новогодние каникулы. В другом году — весь этот год. Дальше последнего года с данными не ищем.
 */
export const searchRange = (year: number, today: ISODate | null, lastYear: number) => {
	const end = toISO(lastYear, 12, 31)
	if (today && yearOf(today) === year) {
		return {from: today, to: minDate(addDays(today, 365), end), ahead: true}
	}
	return {from: toISO(year, 1, 1), to: minDate(toISO(year, 12, 31), end), ahead: false}
}

const overlaps = (a: LeaveResult, b: LeaveResult) =>
	a.rest.from <= b.rest.to && b.rest.from <= a.rest.to

const byRest = (a: LeaveResult, b: LeaveResult) =>
	b.rest.days - a.rest.days || a.charged - b.charged || (a.from < b.from ? -1 : 1)

const byMoney = (a: LeaveResult, b: LeaveResult) =>
	b.money - a.money || b.rest.days - a.rest.days || (a.from < b.from ? -1 : 1)

/**
 * Лучшие окна отпуска в диапазоне при списании не больше budget.
 * Цель «отдых»: максимум непрерывного отдыха; отпуск начинается и заканчивается рабочим днём,
 * прилегающие выходные и так попадают в отдых. Цель «деньги»: максимум отпускных относительно
 * зарплаты; тут окно может начинаться и с выходного — где выходные оплачиваются, это выгодно.
 */
export const bestWindows = (
	country: Country,
	lookup: YearLookup,
	{from, to, budget, limit = 3, goal = 'rest'}: BestWindowsOptions
): LeaveResult[] => {
	if (budget < 1) return []
	const candidates: LeaveResult[] = []

	for (let start = from; start <= to; start = addDays(start, 1)) {
		if (goal === 'rest' && dayOf(country, lookup, start).off) continue
		let end: ISODate | null = null
		let charged = 0
		for (let d = start; diffDays(start, d) < budget * 3 + 14; d = addDays(d, 1)) {
			charged += chargesDay(country, lookup, d)
			if (charged > budget) break
			if (goal === 'money' || !dayOf(country, lookup, d).off) end = d
		}
		if (end) candidates.push(computeLeave(country, lookup, start, end))
	}

	const picked: LeaveResult[] = []
	for (const candidate of candidates.sort(goal === 'money' ? byMoney : byRest)) {
		if (picked.some(p => overlaps(p, candidate))) continue
		picked.push(candidate)
		if (picked.length === limit) break
	}
	return picked.sort((a, b) => (a.from < b.from ? -1 : 1))
}

export interface SelectionHint {
	from: ISODate
	to: ISODate
	result: LeaveResult
	/** На сколько дней больше отдых */
	restGain: number
	/** На сколько дней меньше списано */
	chargedSaved: number
}

/**
 * «Магнит»: ищет рядом с выделением (±maxShift дней по краям) вариант,
 * где списано не больше, а отдыха не меньше, и что-то из этого строго лучше.
 */
export const improveSelection = (
	country: Country,
	lookup: YearLookup,
	from: ISODate,
	to: ISODate,
	maxShift = 3
): SelectionHint | null => {
	const current = computeLeave(country, lookup, from, to)
	let best: SelectionHint | null = null
	let bestScore = 0
	for (let ds = -maxShift; ds <= maxShift; ds++) {
		for (let de = -maxShift; de <= maxShift; de++) {
			if (ds === 0 && de === 0) continue
			const start = addDays(current.from, ds)
			const end = addDays(current.to, de)
			if (end < start) continue
			const result = computeLeave(country, lookup, start, end)
			const restGain = result.rest.days - current.rest.days
			const chargedSaved = current.charged - result.charged
			if (restGain < 0 || chargedSaved < 0 || (restGain === 0 && chargedSaved === 0)) continue
			const score = restGain * 10 + chargedSaved * 6 - (Math.abs(ds) + Math.abs(de))
			if (score > bestScore) {
				bestScore = score
				best = {from: start, to: end, result, restGain, chargedSaved}
			}
		}
	}
	return best
}
