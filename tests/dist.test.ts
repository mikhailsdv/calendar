import {existsSync, readdirSync, readFileSync} from 'node:fs'
import {resolve} from 'node:path'

import {describe, expect, it} from 'vitest'

import {allPaths, pathFor} from '../src/app/routes'
import {LANGS, SITE_ORIGIN, STORAGE_KEY} from '../src/config'

const dist = resolve(import.meta.dirname, '../dist')
const read = (path: string) => readFileSync(resolve(dist, path), 'utf-8')

const years = [
	...new Set(
		readdirSync(resolve(import.meta.dirname, '../data/years')).flatMap(country =>
			readdirSync(resolve(import.meta.dirname, '../data/years', country)).map(f =>
				Number(f.slice(0, 4))
			)
		)
	),
].sort()

const htmlFor = (path: string) => read(`${path.replace(/^\//, '')}index.html`)

const attr = (html: string, pattern: RegExp) => html.match(pattern)?.[1]

describe('dist', () => {
	it('was built', () => {
		expect(existsSync(resolve(dist, 'index.html')), 'run npm run build first').toBe(true)
	})

	for (const path of allPaths(years).filter(p => p !== '/')) {
		describe(path, () => {
			const html = htmlFor(path)
			const lang = path.split('/')[1]!
			const year = Number(path.split('/')[2]) || null

			it('has language, title and description', () => {
				expect(attr(html, /<html lang="([^"]+)"/)).toBe(lang)
				const title = attr(html, /<title>([^<]+)<\/title>/)
				expect(title).toBeTruthy()
				expect(title).not.toContain('undefined')
				expect(title).not.toContain('{')
				if (year) expect(title).toContain(String(year))
				expect(attr(html, /<meta name="description" content="([^"]+)"/)).toBeTruthy()
			})

			it('has canonical, hreflang and Open Graph tags', () => {
				expect(attr(html, /<link rel="canonical" href="([^"]+)"/)).toBe(`${SITE_ORIGIN}${path}`)
				for (const l of LANGS) {
					expect(html).toContain(
						`<link rel="alternate" hreflang="${l}" href="${SITE_ORIGIN}${pathFor(l, year)}">`
					)
				}
				expect(html).toContain('hreflang="x-default"')
				expect(attr(html, /<meta property="og:image" content="([^"]+)"/)).toBe(
					`${SITE_ORIGIN}/og/${lang}.png`
				)
				expect(html).toContain('application/ld+json')
			})

			it('is prerendered with boot data', () => {
				expect(html).toMatch(/<h1[ >]/)
				expect(html.match(/data-date="/g)?.length).toBeGreaterThanOrEqual(365)
				expect(html).toContain('id="prerender-data"')
			})
		})
	}

	it('redirects the root by language', () => {
		const html = read('index.html')
		expect(html).toContain(STORAGE_KEY)
		expect(html).toContain("location.replace('/' + (lang || 'ru') + '/')")
		for (const l of LANGS) expect(html).toContain(`href="/${l}/"`)
	})

	it('has a 404 page that is not indexed', () => {
		expect(read('404.html')).toContain('<meta name="robots" content="noindex">')
	})

	it('lists every page in the sitemap', () => {
		const sitemap = read('sitemap.xml')
		for (const path of allPaths(years).filter(p => p !== '/')) {
			expect(sitemap).toContain(`<loc>${SITE_ORIGIN}${path}</loc>`)
		}
	})

	it('ships robots, htaccess, manifest, icons and covers', () => {
		expect(read('robots.txt')).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`)
		expect(read('.htaccess')).toContain('ErrorDocument 404 /404.html')
		expect(JSON.parse(read('manifest.webmanifest')).icons.length).toBeGreaterThan(0)
		for (const file of ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png']) {
			expect(existsSync(resolve(dist, file)), file).toBe(true)
		}
		for (const lang of LANGS) expect(existsSync(resolve(dist, `og/${lang}.png`)), lang).toBe(true)
	})
})
