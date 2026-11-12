import './styles/global.css'

import {hydrate, render} from 'preact'

import {App} from './app/App'
import {BOOT_DATA_ID, type BootData, defaultYear, toCache} from './app/boot'
import {allPaths, parseRoute} from './app/routes'
import {COUNTRY_IDS, COUNTRY_PAGES, loadYearForCountries, YEARS} from './data/loader'
import {loadDict} from './i18n'

const langOf = (route: ReturnType<typeof parseRoute>) => (route.kind === 'app' ? route.lang : 'ru')

const yearsFor = async (route: ReturnType<typeof parseRoute>, year: number) =>
	route.kind === 'app' ? toCache(await loadYearForCountries(COUNTRY_IDS, year), year) : {}

/** Вызывается плагином пререндера при сборке для каждой страницы */
export async function prerender({url}: {url: string}) {
	const [{renderToString}, {buildHead}] = await Promise.all([
		import('preact-render-to-string'),
		import('./seo/head'),
	])
	const route = parseRoute(url, YEARS, COUNTRY_PAGES)
	const lang = langOf(route)
	const year = (route.kind === 'app' && route.year) || defaultYear()
	const [t, years] = await Promise.all([loadDict(lang), yearsFor(route, year)])
	const html = renderToString(<App route={route} i18n={{lang, t}} init={{year, years}} />)
	const data: BootData | undefined = route.kind === 'app' ? {year, years} : undefined
	return {
		html,
		head: buildHead(route, t, year),
		data,
		links: new Set(allPaths(YEARS, COUNTRY_PAGES)),
	}
}

const readBootData = (): Partial<BootData> => {
	const element = document.getElementById(BOOT_DATA_ID)
	if (!element) return {}
	element.remove()
	try {
		return JSON.parse(element.textContent || '{}')
	} catch {
		return {}
	}
}

const boot = async () => {
	const root = document.getElementById('app')!
	const bootData = readBootData()
	const route = parseRoute(location.pathname, YEARS, COUNTRY_PAGES)
	const lang = langOf(route)
	const year = bootData.year ?? ((route.kind === 'app' && route.year) || defaultYear())
	const [t, years] = await Promise.all([loadDict(lang), bootData.years ?? yearsFor(route, year)])
	const app = <App route={route} i18n={{lang, t}} init={{year, years}} />
	// 404 может прийти поверх чужой разметки (fallback сервера), поэтому её рендерим заново, а не гидрируем
	if (root.firstElementChild && route.kind !== 'notFound') hydrate(app, root)
	else render(app, root)
}

if (typeof window !== 'undefined') void boot()
