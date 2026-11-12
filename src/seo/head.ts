import {pathFor, type Route} from '../app/routes'
import {AUTHOR_LINKS, type Lang, LANGS, OG_LOCALES, SITE_ORIGIN} from '../config'
import {COUNTRIES} from '../data/loader'
import {type Dict, fmt} from '../i18n'
import {calendarTitle, countryForm, countryTitle} from './title'

export interface HeadElement {
	type: string
	props: Record<string, string>
	children?: string
}

export interface Head {
	lang: string
	title: string
	elements: Set<HeadElement>
}

const meta = (name: string, content: string): HeadElement => ({
	type: 'meta',
	props: name.startsWith('og:') ? {property: name, content} : {name, content},
})

const link = (props: Record<string, string>): HeadElement => ({type: 'link', props})

const url = (path: string) => `${SITE_ORIGIN}${path}`

/** Все мета-теги страницы: title, description, canonical, hreflang, Open Graph, JSON-LD */
export const buildHead = (route: Route, t: Dict, year: number): Head => {
	const lang: Lang = route.kind === 'app' ? route.lang : 'ru'

	if (route.kind === 'notFound') {
		return {
			lang,
			title: `404 · ${t.meta.siteName}`,
			elements: new Set([meta('robots', 'noindex')]),
		}
	}

	const routeYear = route.kind === 'app' ? route.year : null
	const country = route.kind === 'app' && route.country ? COUNTRIES[route.country] : undefined
	const form = countryForm(country, lang)
	const path = route.kind === 'root' ? '/' : pathFor(lang, routeYear, country?.id)
	const title =
		route.kind === 'root'
			? t.meta.titleCurrent
			: form
				? countryTitle(t, form, routeYear ?? year)
				: calendarTitle(t, routeYear ?? year, routeYear != null)
	const description =
		route.kind === 'root'
			? t.meta.rootDescription
			: form
				? fmt(t.meta.countryDescription, {country: form, year: routeYear ?? year})
				: fmt(t.meta.description, {year: routeYear ?? year})
	const image = url(`/og/${lang}.png`)
	// Языковые версии: у страницы страны — только языки из её белого списка
	const langs = country ? LANGS.filter(l => country.pages[l]) : LANGS
	const defaultLang = langs.includes('ru') ? 'ru' : langs[0]!

	const elements: HeadElement[] = [
		meta('description', description),
		link({rel: 'canonical', href: url(path)}),
		...langs.map(l =>
			link({rel: 'alternate', hreflang: l, href: url(pathFor(l, routeYear, country?.id))})
		),
		link({
			rel: 'alternate',
			hreflang: 'x-default',
			href: url(!country && routeYear == null ? '/' : pathFor(defaultLang, routeYear, country?.id)),
		}),
		meta('og:type', 'website'),
		meta('og:site_name', t.meta.siteName),
		meta('og:title', title),
		meta('og:description', description),
		meta('og:url', url(path)),
		meta('og:image', image),
		meta('og:image:width', '1200'),
		meta('og:image:height', '630'),
		meta('og:locale', OG_LOCALES[lang]),
		...langs.filter(l => l !== lang).map(l => meta('og:locale:alternate', OG_LOCALES[l])),
		meta('twitter:card', 'summary_large_image'),
		meta('twitter:title', title),
		meta('twitter:description', description),
		meta('twitter:image', image),
		{
			type: 'script',
			props: {type: 'application/ld+json'},
			children: JSON.stringify({
				'@context': 'https://schema.org',
				'@type': 'WebApplication',
				name: t.meta.siteName,
				url: url(path),
				description,
				inLanguage: lang,
				applicationCategory: 'UtilitiesApplication',
				operatingSystem: 'Any',
				offers: {'@type': 'Offer', price: '0', priceCurrency: 'USD'},
				author: {'@type': 'Person', name: 'Misha Saidov', url: AUTHOR_LINKS.cv},
			}).replace(/</g, '\\u003c'),
		},
	]

	return {lang, title, elements: new Set(elements)}
}
