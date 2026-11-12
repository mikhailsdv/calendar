import {existsSync, readFileSync} from 'node:fs'
import {resolve} from 'node:path'

import {describe, expect, it} from 'vitest'

import {allPaths, pageGroups} from '../src/app/routes'
import {LANGS, SITE_ORIGIN, STORAGE_KEY} from '../src/config'
import {COUNTRIES, COUNTRY_PAGES, YEARS} from '../src/data/nodeLoader'

const dist = resolve(import.meta.dirname, '../dist')
const read = (path: string) => readFileSync(resolve(dist, path), 'utf-8')

const htmlFor = (path: string) => read(`${path.replace(/^\//, '')}index.html`)

const attr = (html: string, pattern: RegExp) => html.match(pattern)?.[1]

describe('dist', () => {
	it('was built', () => {
		expect(existsSync(resolve(dist, 'index.html')), 'run npm run build first').toBe(true)
	})

	for (const group of pageGroups(YEARS, COUNTRY_PAGES)) {
		for (const {lang, path} of group) {
			describe(path, () => {
				const html = htmlFor(path)
				const parts = path.split('/').filter(Boolean)
				const country = parts[1] && !/^\d{4}$/.test(parts[1]) ? COUNTRIES[parts[1]] : undefined
				const year = Number(parts[parts.length - 1]) || null

				it('has language, title and description', () => {
					expect(attr(html, /<html lang="([^"]+)"/)).toBe(lang)
					const title = attr(html, /<title>([^<]+)<\/title>/)
					expect(title).toBeTruthy()
					expect(title).not.toContain('undefined')
					expect(title).not.toContain('{')
					if (year) expect(title).toContain(String(year))
					if (country) expect(title).toContain(country.pages[lang])
					expect(attr(html, /<meta name="description" content="([^"]+)"/)).toBeTruthy()
				})

				it('links only the language versions that exist', () => {
					expect(attr(html, /<link rel="canonical" href="([^"]+)"/)).toBe(`${SITE_ORIGIN}${path}`)
					for (const version of group) {
						expect(html).toContain(
							`<link rel="alternate" hreflang="${version.lang}" href="${SITE_ORIGIN}${version.path}">`
						)
					}
					const linked = [...html.matchAll(/hreflang="([a-z]{2})"/g)].map(m => m[1])
					expect(new Set(linked)).toEqual(new Set(group.map(version => version.lang)))
					expect(html).toContain('hreflang="x-default"')
					expect(attr(html, /<meta property="og:image" content="([^"]+)"/)).toBe(
						`${SITE_ORIGIN}/og/${lang}.png`
					)
					expect(html).toContain('application/ld+json')
				})

				it('is prerendered with boot data', () => {
					const h1 = attr(html, /<h1[^>]*>([^<]+)<\/h1>/)
					expect(h1).toBeTruthy()
					if (country) expect(h1).toContain(country.pages[lang])
					expect(html.match(/data-date="/g)?.length).toBeGreaterThanOrEqual(365)
					expect(html).toContain('id="prerender-data"')
				})

				if (country) {
					it('shows the calendar of that country', () => {
						const cells = html.match(new RegExp(`data-c="${country.id}"`, 'g'))?.length ?? 0
						expect(cells).toBeGreaterThan(300)
					})
				}
			})
		}
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
		for (const path of allPaths(YEARS, COUNTRY_PAGES).filter(p => p !== '/')) {
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
