import type {ISODate} from '../domain/dates'

/** Прокручивает к дате на календаре после перерисовки: в годовом виде она может быть далеко внизу */
export const revealDate = (date: ISODate) => {
	requestAnimationFrame(() => {
		const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
		document.querySelector(`[data-date="${date}"]`)?.scrollIntoView?.({
			block: 'center',
			inline: 'center',
			behavior: reduce ? 'auto' : 'smooth',
		})
	})
}
