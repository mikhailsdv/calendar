import {useEffect, useRef} from 'preact/hooks'

/** Совпадает с брейкпоинтом в Panel.module.css: уже этой ширины панель становится нижней шторкой */
export const SHEET_MEDIA = '(max-width: 1023px)'
/** Сдвиг пальцем, после которого шторка меняет состояние */
const SNAP = 40

interface Drag {
	id: number
	y: number
	base: number
	dy: number
	moved: boolean
}

/**
 * Нижняя шторка: высота в свёрнутом виде равна шапке, шапку можно тянуть пальцем или мышью,
 * а нажатие на неё сворачивает и разворачивает шторку.
 */
export const useSheet = (
	collapsed: boolean,
	setCollapsed: (value: boolean, via: 'tap' | 'drag') => void,
	visible: boolean
) => {
	const sheetRef = useRef<HTMLElement>(null)
	const headRef = useRef<HTMLDivElement>(null)
	const drag = useRef<Drag | null>(null)

	useEffect(() => {
		const sheet = sheetRef.current
		const head = headRef.current
		if (!sheet || !head || typeof ResizeObserver === 'undefined') return
		const update = () =>
			sheet.style.setProperty('--peek', `${head.offsetTop + head.offsetHeight + 12}px`)
		const observer = new ResizeObserver(update)
		observer.observe(head)
		update()
		return () => observer.disconnect()
	}, [visible])

	const reset = () => {
		drag.current = null
		const sheet = sheetRef.current
		if (!sheet) return
		sheet.style.transition = ''
		sheet.style.transform = ''
	}

	const onPointerDown = (e: PointerEvent) => {
		const sheet = sheetRef.current
		if (!sheet || e.button !== 0 || !matchMedia(SHEET_MEDIA).matches) return
		const target = e.target as Element
		// Полоску-ручку можно тянуть, остальные кнопки в шапке работают как обычно
		if (target.closest('button, a, select, input') && !target.closest('[data-grabber]')) return
		const transform = getComputedStyle(sheet).transform
		const base = transform && transform !== 'none' ? new DOMMatrixReadOnly(transform).m42 : 0
		drag.current = {id: e.pointerId, y: e.clientY, base, dy: 0, moved: false}
		;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
	}

	const onPointerMove = (e: PointerEvent) => {
		const d = drag.current
		const sheet = sheetRef.current
		if (!d || !sheet || e.pointerId !== d.id) return
		d.dy = e.clientY - d.y
		if (!d.moved && Math.abs(d.dy) < 6) return
		d.moved = true
		sheet.style.transition = 'none'
		sheet.style.transform = `translateY(${Math.max(0, d.base + d.dy)}px)`
	}

	const onPointerUp = (e: PointerEvent) => {
		const d = drag.current
		if (!d || e.pointerId !== d.id) return
		reset()
		if (!d.moved) setCollapsed(!collapsed, 'tap')
		else if (d.dy > SNAP && !collapsed) setCollapsed(true, 'drag')
		else if (d.dy < -SNAP && collapsed) setCollapsed(false, 'drag')
	}

	return {
		sheetRef,
		headRef,
		handlers: {onPointerDown, onPointerMove, onPointerUp, onPointerCancel: reset},
	}
}
