import {useMemo} from 'preact/hooks'

import {CalendarPage} from '../components/CalendarPage'
import {NotFoundPage, RootPage} from '../components/StaticPages'
import {type I18n, I18nContext} from '../i18n'
import {createStore, StoreContext, type YearCache} from '../state/store'
import type {Route} from './routes'

interface AppProps {
	route: Route
	i18n: I18n
	init: {year: number; years: YearCache}
}

const CalendarApp = ({
	i18n,
	init,
	routeYear,
	routeCountry,
}: Omit<AppProps, 'route'> & {routeYear: number | null; routeCountry: string | null}) => {
	const store = useMemo(
		() => createStore({lang: i18n.lang, year: init.year, years: init.years, country: routeCountry}),
		// Стор создаётся один раз на страницу
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[]
	)
	return (
		<StoreContext.Provider value={store}>
			<CalendarPage routeYear={routeYear} routeCountry={routeCountry} />
		</StoreContext.Provider>
	)
}

export const App = ({route, i18n, init}: AppProps) => (
	<I18nContext.Provider value={i18n}>
		{route.kind === 'root' ? (
			<RootPage />
		) : route.kind === 'notFound' ? (
			<NotFoundPage />
		) : (
			<CalendarApp i18n={i18n} init={init} routeYear={route.year} routeCountry={route.country} />
		)}
	</I18nContext.Provider>
)
