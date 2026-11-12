import type {Lang} from '../config'

/**
 * Часовые пояса стран по названиям IANA, а не по смещению: у Казахстана с 2024 года то же UTC+5,
 * что у Екатеринбурга, но браузер отдаёт Asia/Almaty, а не Asia/Yekaterinburg.
 * Старые и новые написания (Kiev и Kyiv) перечислены оба: зависит от версии ICU в браузере.
 */
const ZONES: Record<string, string[]> = {
	kz: [
		'Asia/Almaty',
		'Asia/Qostanay',
		'Asia/Aqtobe',
		'Asia/Aqtau',
		'Asia/Atyrau',
		'Asia/Oral',
		'Asia/Qyzylorda',
	],
	by: ['Europe/Minsk'],
	am: ['Asia/Yerevan'],
	ua: ['Europe/Kyiv', 'Europe/Kiev', 'Europe/Uzhgorod', 'Europe/Zaporozhye'],
	ru: [
		'Europe/Kaliningrad',
		'Europe/Moscow',
		'Europe/Kirov',
		'Europe/Volgograd',
		'Europe/Astrakhan',
		'Europe/Saratov',
		'Europe/Ulyanovsk',
		'Europe/Samara',
		'Asia/Yekaterinburg',
		'Asia/Omsk',
		'Asia/Novosibirsk',
		'Asia/Barnaul',
		'Asia/Tomsk',
		'Asia/Novokuznetsk',
		'Asia/Krasnoyarsk',
		'Asia/Irkutsk',
		'Asia/Chita',
		'Asia/Yakutsk',
		'Asia/Khandyga',
		'Asia/Vladivostok',
		'Asia/Ust-Nera',
		'Asia/Magadan',
		'Asia/Sakhalin',
		'Asia/Srednekolymsk',
		'Asia/Kamchatka',
		'Asia/Anadyr',
	],
}

const COUNTRY_BY_ZONE = new Map(
	Object.entries(ZONES).flatMap(([country, zones]) => zones.map(zone => [zone, country] as const))
)

/** Язык интерфейса, который сам указывает на страну */
export const COUNTRY_BY_LANG: Partial<Record<Lang, string>> = {
	kk: 'kz',
	hy: 'am',
	be: 'by',
	uk: 'ua',
}

/** Регион из языка браузера: ru-KZ, be-BY и так далее */
const COUNTRY_BY_REGION: Record<string, string> = {RU: 'ru', KZ: 'kz', BY: 'by', AM: 'am', UA: 'ua'}

export const FALLBACK_COUNTRY = 'ru'

interface Signals {
	/** Intl.DateTimeFormat().resolvedOptions().timeZone */
	timeZone?: string
	/** navigator.languages */
	languages?: readonly string[]
	/** Язык страницы */
	lang: Lang
}

/**
 * Основная страна для первого входа: часовой пояс, затем язык страницы, затем регион
 * в языке браузера, иначе Россия. Сохранённый выбор пользователя этим не перекрывается.
 */
export const detectCountry = ({timeZone, languages = [], lang}: Signals) => {
	const byZone = timeZone ? COUNTRY_BY_ZONE.get(timeZone) : undefined
	if (byZone) return byZone
	const byLang = COUNTRY_BY_LANG[lang]
	if (byLang) return byLang
	for (const tag of languages) {
		const region = tag.split('-')[1]?.toUpperCase()
		const country = region ? COUNTRY_BY_REGION[region] : undefined
		if (country) return country
	}
	return FALLBACK_COUNTRY
}

/** Сигналы текущего браузера; вызывать только на клиенте после монтирования */
export const browserSignals = (lang: Lang): Signals => {
	let timeZone: string | undefined
	try {
		timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
	} catch {
		timeZone = undefined
	}
	return {timeZone, languages: navigator.languages ?? [navigator.language], lang}
}
