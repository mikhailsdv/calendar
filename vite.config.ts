import preact from '@preact/preset-vite'
import {defineConfig, loadEnv, type Plugin} from 'vite'

import {pageGroups} from './src/app/routes'
import {SITE_ORIGIN} from './src/config'
import {COUNTRY_PAGES, YEARS} from './src/data/nodeLoader'

/**
 * sitemap.xml: общие страницы на всех языках и страницы стран на языках из их белого списка.
 * Языковые версии одной страницы связаны через hreflang
 */
const sitemap = (): Plugin => ({
	name: 'workcalendar-sitemap',
	apply: 'build',
	generateBundle() {
		const lastmod = new Date().toISOString().slice(0, 10)
		const urls = pageGroups(YEARS, COUNTRY_PAGES).flatMap(group => {
			const alternates = group
				.map(
					page =>
						`<xhtml:link rel="alternate" hreflang="${page.lang}" href="${SITE_ORIGIN}${page.path}"/>`
				)
				.join('')
			return group.map(
				page =>
					`<url><loc>${SITE_ORIGIN}${page.path}</loc><lastmod>${lastmod}</lastmod>${alternates}</url>`
			)
		})
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
