import type events from './events.json'

/** Цели описаны в events.json; файл нужен только для типов и в бандл не попадает */
export type Goal = keyof typeof events
type Params = Record<string, string | number>

type Ym = ((id: number, method: string, ...args: unknown[]) => void) & {a?: unknown[][]; l?: number}

declare global {
	interface Window {
		ym?: Ym
	}
}

/** ID счётчика из переменной окружения; в dev и в форках без неё аналитика выключена */
const counterId = (): number | null => {
	const id = Number(import.meta.env.VITE_YM_ID)
	return Number.isInteger(id) && id > 0 ? id : null
}

let initialized = false

const loadScript = (id: number) => {
	const script = document.createElement('script')
	script.async = true
	script.src = `https://mc.yandex.ru/metrika/tag.js?id=${id}`
	document.head.appendChild(script)
}

/**
 * Подключает Метрику. Настройки — как в коде счётчика из интерфейса Метрики,
 * но сам скрипт грузится после загрузки страницы и в простое браузера,
 * чтобы не мешать отрисовке и Web Vitals. Вызовы до загрузки копятся в очереди.
 */
export const initMetrika = () => {
	const id = counterId()
	if (!id || initialized || typeof window === 'undefined') return
	initialized = true
	const queue: Ym = (...args) => {
		;(queue.a ||= []).push(args)
	}
	queue.l = Date.now()
	window.ym ||= queue
	window.ym(id, 'init', {
		ssr: true,
		webvisor: true,
		clickmap: true,
		ecommerce: 'dataLayer',
		referrer: document.referrer,
		url: location.href,
		accurateTrackBounce: true,
		trackLinks: true,
	})
	const start = () => {
		// В Safari нет requestIdleCallback: там просто небольшая пауза после загрузки
		const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 500))
		idle(() => loadScript(id))
	}
	if (document.readyState === 'complete') start()
	else window.addEventListener('load', start, {once: true})
}

/** Отправляет цель. Без ID счётчика ничего не делает */
export const track = (goal: Goal, params: Params = {}) => {
	const id = counterId()
	if (!id || typeof window === 'undefined' || !window.ym) return
	window.ym(id, 'reachGoal', goal, params)
}
