/**
 * Генерирует OG-обложки на каждый язык и иконки сайта в public/.
 * Запуск: npm run og. Результат коммитится, поэтому CI не зависит от нативного resvg.
 */
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {resolve} from 'node:path'

import {Resvg} from '@resvg/resvg-js'
import satori from 'satori'

import {LANGS} from '../src/config'
import {loadDict} from '../src/i18n'

const root = resolve(import.meta.dirname, '..')
const publicDir = resolve(root, 'public')
const fontDir = (pkg: string) => resolve(root, 'node_modules/@fontsource', pkg, 'files')

const font = (name: string, pkg: string, file: string, weight: 400 | 700) => ({
	name,
	data: readFileSync(resolve(fontDir(pkg), file)),
	weight,
	style: 'normal' as const,
})

const fonts = [400, 700].flatMap(w => {
	const weight = w as 400 | 700
	return [
		font('Latin', 'noto-sans', `noto-sans-latin-${weight}-normal.woff`, weight),
		font('Cyrillic', 'noto-sans', `noto-sans-cyrillic-${weight}-normal.woff`, weight),
		font('CyrillicExt', 'noto-sans', `noto-sans-cyrillic-ext-${weight}-normal.woff`, weight),
		font(
			'Armenian',
			'noto-sans-armenian',
			`noto-sans-armenian-armenian-${weight}-normal.woff`,
			weight
		),
	]
})

const COLORS = ['#3b6fd8', '#16a0b3', '#3c9a4f', '#df603a', '#dca70f']
const COUNTRY_NAMES: Record<string, string[]> = {}

/** Мини-узел для satori без JSX */
type Node = {type: string; props: Record<string, unknown> & {children?: unknown}}
const h = (type: string, style: Record<string, unknown>, ...children: unknown[]): Node => ({
	type,
	props: {style, children: children.length === 1 ? children[0] : children},
})

/** Декоративная сетка месяца: часть дней — «праздники» разных стран */
const grid = () => {
	const pattern: Record<number, number[]> = {
		0: [0, 1, 2, 3, 4],
		1: [0, 1, 2, 3],
		2: [0, 2],
		7: [1, 3],
		8: [0, 1, 2, 4],
		9: [0, 1],
		16: [3],
		22: [2, 4],
		23: [0, 1, 2],
		24: [0, 1],
	}
	const cells = Array.from({length: 35}, (_, i) => {
		const weekend = i % 7 >= 5
		const segs = COLORS.map((color, c) =>
			h('div', {
				flex: 1,
				height: 7,
				borderRadius: 2,
				background: pattern[i]?.includes(c) ? color : weekend ? '#cfcec8' : '#ebebe7',
			})
		)
		return h(
			'div',
			{
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'space-between',
				width: 46,
				height: 46,
				padding: 5,
				borderRadius: 10,
				background: weekend ? '#f4f3ef' : '#ffffff',
				border: '1.5px solid #e5e5e0',
				fontSize: 17,
				color: pattern[i] ? COLORS[0] : weekend ? '#8c8c92' : '#1c1c1e',
				fontWeight: pattern[i] ? 700 : 400,
			},
			String(i + 1 <= 31 ? i + 1 : i - 30),
			h('div', {display: 'flex', gap: 2}, ...segs)
		)
	})
	return h(
		'div',
		// satori считает размеры без box-sizing: ширина ячейки = 46 + отступы 10 + рамка 3
		{display: 'flex', flexWrap: 'wrap', gap: 7, width: 7 * 59 + 6 * 7, flexShrink: 0},
		...cells
	)
}

const ogImage = async (lang: (typeof LANGS)[number]) => {
	const t = await loadDict(lang)
	const names = COUNTRY_NAMES[lang] ?? []
	const tree = h(
		'div',
		{
			display: 'flex',
			// satori не учитывает box-sizing: размеры холста минус отступы
			width: 1200 - 128,
			height: 630 - 128,
			padding: 64,
			background: '#ffffff',
			fontFamily: 'Latin, Cyrillic, CyrillicExt, Armenian',
			justifyContent: 'space-between',
			alignItems: 'center',
		},
		h(
			'div',
			{display: 'flex', flexDirection: 'column', width: 560, gap: 24},
			h(
				'div',
				{fontSize: 22, fontWeight: 700, color: '#5b4fd6', letterSpacing: 1},
				'calendar.mishasaidov.com'
			),
			h('div', {fontSize: 58, fontWeight: 700, lineHeight: 1.1, color: '#1c1c1e'}, t.meta.siteName),
			h(
				'div',
				{display: 'flex', flexDirection: 'column', gap: 10},
				...names.map((name, i) =>
					h(
						'div',
						{display: 'flex', alignItems: 'center', gap: 12, fontSize: 28, color: '#3a3a40'},
						h('div', {width: 16, height: 16, borderRadius: 8, background: COLORS[i]}),
						name
					)
				)
			)
		),
		grid()
	)
	const svg = await satori(tree as never, {width: 1200, height: 630, fonts})
	return new Resvg(svg, {fitTo: {mode: 'width', value: 1200}}).render().asPng()
}

const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect x="4" y="6" width="56" height="54" rx="12" fill="#ffffff" stroke="#1c1c1e" stroke-width="4"/>
<path d="M4 22h56" stroke="#1c1c1e" stroke-width="4"/>
<path d="M20 2v10M44 2v10" stroke="#1c1c1e" stroke-width="5" stroke-linecap="round"/>
<rect x="12" y="30" width="10" height="10" rx="2.5" fill="${COLORS[0]}"/>
<rect x="27" y="30" width="10" height="10" rx="2.5" fill="${COLORS[1]}"/>
<rect x="42" y="30" width="10" height="10" rx="2.5" fill="${COLORS[2]}"/>
<rect x="12" y="44" width="10" height="10" rx="2.5" fill="${COLORS[3]}"/>
<rect x="27" y="44" width="10" height="10" rx="2.5" fill="${COLORS[4]}"/>
<rect x="42" y="44" width="10" height="10" rx="2.5" fill="#d3d2cc"/>
</svg>
`

const png = (svg: string, size: number, background?: string) =>
	new Resvg(svg, {fitTo: {mode: 'width', value: size}, background}).render().asPng()

const main = async () => {
	const {COUNTRIES, COUNTRY_IDS} = await import('../src/data/nodeLoader')
	for (const lang of LANGS) {
		COUNTRY_NAMES[lang] = COUNTRY_IDS.map(id => COUNTRIES[id]!.name[lang] ?? COUNTRIES[id]!.name.ru)
	}
	mkdirSync(resolve(publicDir, 'og'), {recursive: true})
	for (const lang of LANGS) {
		writeFileSync(resolve(publicDir, 'og', `${lang}.png`), await ogImage(lang))
		console.log(`og/${lang}.png`)
	}
	writeFileSync(resolve(publicDir, 'favicon.svg'), FAVICON)
	writeFileSync(resolve(publicDir, 'favicon-32.png'), png(FAVICON, 32))
	const padded = FAVICON.replace('viewBox="0 0 64 64"', 'viewBox="-10 -10 84 84"')
	writeFileSync(resolve(publicDir, 'apple-touch-icon.png'), png(padded, 180, '#ffffff'))
	writeFileSync(resolve(publicDir, 'icon-192.png'), png(padded, 192, '#ffffff'))
	writeFileSync(resolve(publicDir, 'icon-512.png'), png(padded, 512, '#ffffff'))
	console.log('icons')
}

void main()
