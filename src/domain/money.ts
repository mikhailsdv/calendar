import type {Country, YearLookup} from '../data/types'
import {dayOf, yearTotals} from './calendar'
import {addDays, diffDays, type ISODate, monthOf, toISO, yearOf} from './dates'

/**
 * Деньги за отпуск по сравнению с работой в те же дни, в долях месячного оклада.
 *
 * Оклад за месяц делится на число его рабочих дней, поэтому рабочий день в «коротком» месяце
 * с праздниками стоит дороже, чем в «длинном». Отпускные же считаются от среднего заработка
 * за год и от месяца не зависят. Отсюда: отпуск в месяце, где рабочих дней много, даёт денег
 * больше, чем работа, а отпуск рядом с праздниками — меньше.
 *
 * Оценка при постоянном окладе без премий и при полностью отработанном годе.
 */

interface YearPay {
	/** Рабочих дней в каждом месяце */
	months: number[]
	workdays: number
	/** Нерабочих праздников за год */
	holidays: number
	days: number
}

const cache = new Map<string, {data: unknown; pay: YearPay}>()

const yearPay = (country: Country, lookup: YearLookup, year: number): YearPay => {
	const data = lookup(country.id, year)
	const key = `${country.id}:${year}`
	const hit = cache.get(key)
	if (hit && hit.data === data) return hit.pay
	const totals = yearTotals(country, data, year)
	const pay = {
		months: totals.months.map(m => m.workdays),
		workdays: totals.total.workdays,
		holidays: totals.total.holidays,
		days: diffDays(toISO(year, 1, 1), toISO(year, 12, 31)) + 1,
	}
	cache.set(key, {data, pay})
	return pay
}

/** Среднее число дней в месяце, на которое делят средний месячный заработок */
export const payDivisor = (country: Country, lookup: YearLookup, year: number) => {
	const {divisor} = country.leave.pay
	if (typeof divisor === 'number') return divisor
	const pay = yearPay(country, lookup, year)
	return divisor === 'year-workdays' ? pay.workdays / 12 : (pay.days - pay.holidays) / 12
}

/**
 * Отпускные минус зарплата, которую человек получил бы, работая эти дни, — в долях оклада.
 * +0,04 значит «в этом месяце выйдет на 4 % оклада больше, чем без отпуска»
 */
export const vacationMoney = (
	country: Country,
	lookup: YearLookup,
	from: ISODate,
	to: ISODate,
	chargesDay: (date: ISODate) => number
) => {
	let paid = 0
	let lost = 0
	for (let d = from; d <= to; d = addDays(d, 1)) {
		const working = !dayOf(country, lookup, d).off
		if (working) lost += 1 / yearPay(country, lookup, yearOf(d)).months[monthOf(d) - 1]!
		paid += country.leave.pay.days === 'charged' ? chargesDay(d) : working ? 1 : 0
	}
	return paid / payDivisor(country, lookup, yearOf(from)) - lost
}
