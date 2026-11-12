import {readdirSync} from 'node:fs'
import {resolve} from 'node:path'

import preact from '@preact/preset-vite'
import {defineConfig, loadEnv, type Plugin} from 'vite'

import {pathFor} from './src/app/routes'
import {LANGS, SITE_ORIGIN} from './src/config'

/** Годы, по которым есть данные хотя бы у одной страны */
const dataYears = () => {
	const root = resolve(import.meta.dirname, 'data/years')
	const years = readdirSync(root).flatMap(country =>
		readdirSync(resolve(root, country)).map(file => Number(file.replace('.json', '')))
	)
	return [...new Set(years)].filter(Boolean).sort((a, b) => a - b)
}

/** sitemap.xml со всеми языками и годами, связанными через hreflang */
const sitemap = (): Plugin => ({
	name: 'workcalendar-sitemap',
	apply: 'build',
	generateBundle() {
		const lastmod = new Date().toISOString().slice(0, 10)
		const groups: (number | null)[] = [null, ...dataYears()]
		const urls = groups.flatMap(year =>
			LANGS.map(lang => {
				const alternates = LANGS.map(
					l =>
						`<xhtml:link rel="alternate" hreflang="${l}" href="${SITE_ORIGIN}${pathFor(l, year)}"/>`
				).join('')
				return `<url><loc>${SITE_ORIGIN}${pathFor(lang, year)}</loc><lastmod>${lastmod}</lastmod>${alternates}</url>`
			})
		)
		this.emitFile({
			type: 'asset',
			fileName: 'sitemap.xml',
			source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`,
		})
	},
})

/** Пиксель Метрики для посетителей без JavaScript. Без ID счётчика (dev, форки) ничего не добавляет */
const metrikaNoscript = (id: string | undefined): Plugin => ({
	name: 'workcalendar-metrika-noscript',
	apply: 'build',
	transformIndexHtml(html) {
		if (!id || !/^\d+$/.test(id)) return html
		const pixel = `<noscript><div><img src="https://mc.yandex.ru/watch/${id}" style="position:absolute;left:-9999px" alt=""></div></noscript>`
		return html.replace('</body>', `${pixel}</body>`)
	},
})

export default defineConfig(({command, mode}) => ({
	plugins: [
		preact({
			prerender: {
				enabled: true,
				renderTarget: '#app',
				additionalPrerenderRoutes: ['/404.html'],
				previewMiddlewareEnabled: true,
				previewMiddlewareFallback: '/404.html',
			},
		}),
		sitemap(),
		metrikaNoscript(loadEnv(mode, import.meta.dirname, 'VITE_').VITE_YM_ID),
	],
	css: {
		modules: {
			// Короткие имена классов: сетка года — это сотни ячеек в HTML каждой страницы
			generateScopedName: command === 'build' ? '_[hash:base64:5]' : '[name]_[local]',
		},
	},
	build: {
		target: ['es2020', 'safari15'],
		cssTarget: ['safari15'],
	},
}))
