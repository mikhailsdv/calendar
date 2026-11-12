import {describe, expect, it} from 'vitest'

import {country, lookupAll} from '../test/data'
import {computeLeave} from './leave'
import {payDivisor} from './money'

const money = (id: string, from: string, to: string) =>
	computeLeave(country(id), lookupAll, from, to).money

describe('vacation money', () => {
	it('pays off in a long month and costs money around holidays in Russia', () => {
		// Две недели в июле: отпускные за 14 дней больше зарплаты за 10 рабочих дней
		expect(money('ru', '2027-07-05', '2027-07-18')).toBeGreaterThan(0)
		// Майские: 4 дорогих рабочих дня короткого месяца, а отпускные только за 4 дня
		expect(money('ru', '2027-05-04', '2027-05-07')).toBeLessThan(0)
	})

	it('uses the divisors of each country', () => {
		expect(payDivisor(country('ru'), lookupAll, 2027)).toBe(29.3)
		expect(payDivisor(country('by'), lookupAll, 2027)).toBe(29.6)
		expect(payDivisor(country('am'), lookupAll, 2027)).toBe(21)
		// Украина при военном положении: праздники не исключаются, делитель 365 / 12
		expect(payDivisor(country('ua'), lookupAll, 2027)).toBeCloseTo(365 / 12, 5)
		// Казахстан: среднее число рабочих дней в месяце
		expect(payDivisor(country('kz'), lookupAll, 2027)).toBeGreaterThan(20)
		expect(payDivisor(country('kz'), lookupAll, 2027)).toBeLessThan(22)
	})

	it('pays only working days in Kazakhstan, so weekends inside add nothing', () => {
		const week = money('kz', '2027-07-05', '2027-07-09')
		const withWeekend = money('kz', '2027-07-05', '2027-07-11')
		expect(withWeekend).toBeCloseTo(week, 10)
	})
})
