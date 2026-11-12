import {readdirSync, readFileSync, statSync} from 'node:fs'
import {join, resolve} from 'node:path'

import {afterEach, describe, expect, it, vi} from 'vitest'

import events from './events.json'
import {goalsMarkdown} from './goalsDoc'
import {initMetrika, track} from './metrika'

const srcDir = resolve(import.meta.dirname, '..')

const sourceFiles = (dir: string): string[] =>
	readdirSync(dir).flatMap(name => {
		const path = join(dir, name)
		if (statSync(path).isDirectory()) return sourceFiles(path)
		return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
	})

const usedGoals = () => {
	const goals = new Set<string>()
	for (const file of sourceFiles(srcDir)) {
		for (const match of readFileSync(file, 'utf-8').matchAll(/track\(\s*'([a-z_]+)'/g)) {
			goals.add(match[1]!)
		}
	}
	return goals
}

afterEach(() => {
	vi.unstubAllEnvs()
	vi.unstubAllGlobals()
})

describe('analytics', () => {
	it('describes every goal used in the code, and only those', () => {
		const used = usedGoals()
		expect([...used].sort()).toEqual(Object.keys(events).sort())
	})

	it('keeps the Metrika goals list in sync with events.json', () => {
		const file = readFileSync(resolve(srcDir, '../docs/metrika-goals.md'), 'utf-8')
		expect(file, 'запустите npm run goals').toBe(goalsMarkdown())
	})

	it('documents each event', () => {
		for (const [name, event] of Object.entries(events)) {
			expect(event.description, name).toBeTruthy()
			expect(typeof event.params, name).toBe('object')
		}
	})

	it('does nothing without a counter id', () => {
		vi.stubEnv('VITE_YM_ID', '')
		const ym = vi.fn()
		vi.stubGlobal('window', {ym})
		expect(() => track('view_change', {view: 'year'})).not.toThrow()
		expect(() => initMetrika()).not.toThrow()
		expect(ym).not.toHaveBeenCalled()
	})

	it('initializes the counter with the settings from Metrika and loads tag.js lazily', () => {
		vi.stubEnv('VITE_YM_ID', '87654321')
		const ym = vi.fn()
		const appendChild = vi.fn()
		const script: Record<string, unknown> = {}
		vi.stubGlobal('window', {ym, requestIdleCallback: (cb: () => void) => cb()})
		vi.stubGlobal('document', {
			readyState: 'complete',
			referrer: 'https://t.me/',
			createElement: () => script,
			head: {appendChild},
		})
		vi.stubGlobal('location', {href: 'https://calendar.mishasaidov.com/ru/'})
		initMetrika()
		expect(ym).toHaveBeenCalledWith(87654321, 'init', {
			ssr: true,
			webvisor: true,
			clickmap: true,
			ecommerce: 'dataLayer',
			referrer: 'https://t.me/',
			url: 'https://calendar.mishasaidov.com/ru/',
			accurateTrackBounce: true,
			trackLinks: true,
		})
		expect(script.src).toBe('https://mc.yandex.ru/metrika/tag.js?id=87654321')
		expect(appendChild).toHaveBeenCalledWith(script)
	})

	it('sends goals when the counter is configured', () => {
		vi.stubEnv('VITE_YM_ID', '12345')
		const ym = vi.fn()
		vi.stubGlobal('window', {ym})
		track('year_change', {year: 2027})
		expect(ym).toHaveBeenCalledWith(12345, 'reachGoal', 'year_change', {year: 2027})
	})
})
