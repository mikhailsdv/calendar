import type {ComponentChildren} from 'preact'
import {useEffect, useId, useLayoutEffect, useRef, useState} from 'preact/hooks'

import {ChevronRight} from './icons'
import s from './Layout.module.css'

const EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

/** Длинные списки раскрываются чуть дольше, короткие — быстрее */
const durationFor = (height: number) => Math.min(380, Math.max(200, height / 3))

const reduceMotion = () =>
	typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Анимирует высоту тела спойлера; на время анимации содержимое обрезается */
const animateHeight = (el: HTMLElement, from: number, to: number) => {
	if (typeof el.animate !== 'function') return null
	el.style.overflow = 'hidden'
	const animation = el.animate(
		[
			{height: `${from}px`, opacity: from ? 1 : 0},
			{height: `${to}px`, opacity: to ? 1 : 0},
		],
		{duration: durationFor(Math.max(from, to)), easing: EASING, fill: 'forwards'}
	)
	const done = () => {
		el.style.overflow = ''
	}
	animation.finished.then(done, done)
	return animation
}

interface Props {
	open: boolean
	onOpenChange: (open: boolean) => void
	summary: ComponentChildren
	/** Обернуть кнопку в заголовок h3 — для блоков стран */
	heading?: boolean
	children: ComponentChildren
	class?: string
	/** Не печатать блок целиком */
	printHide?: boolean
}

/**
 * Спойлер-аккордеон: кнопка и блок, который раскрывается и сворачивается с анимацией высоты.
 * Не <details>: содержимое закрытого details браузер не печатает, а этот блок при печати показывается.
 * Свёрнутый блок скрыт через hidden="until-found", поэтому поиск по странице в Chrome его раскрывает.
 */
export const Spoiler = ({
	open,
	onOpenChange,
	summary,
	heading,
	children,
	class: className,
	printHide,
}: Props) => {
	const bodyId = useId()
	const bodyRef = useRef<HTMLDivElement>(null)
	const animation = useRef<Animation | null>(null)
	const opening = useRef(false)
	const [closing, setClosing] = useState(false)
	const expanded = open && !closing

	// Раскрытие: блок уже показан, высота известна — анимируем от нуля до неё до первой отрисовки
	useLayoutEffect(() => {
		const body = bodyRef.current
		if (!open || !opening.current || !body) return
		opening.current = false
		animation.current?.cancel()
		const next = animateHeight(body, 0, body.offsetHeight)
		animation.current = next
		next?.finished.then(
			() => next.cancel(),
			() => {}
		)
	}, [open])

	// Поиск по странице нашёл текст в свёрнутом блоке: раскрываем без анимации
	useEffect(() => {
		const body = bodyRef.current
		if (!body) return
		const onMatch = () => onOpenChange(true)
		body.addEventListener('beforematch', onMatch)
		return () => body.removeEventListener('beforematch', onMatch)
	}, [onOpenChange])

	const onClick = () => {
		if (closing) return
		if (!open) {
			opening.current = !reduceMotion()
			onOpenChange(true)
			return
		}
		const body = bodyRef.current
		const next = body && !reduceMotion() ? animateHeight(body, body.offsetHeight, 0) : null
		if (!next) {
			onOpenChange(false)
			return
		}
		animation.current?.cancel()
		animation.current = next
		setClosing(true)
		next.finished.then(
			() => {
				// Прячем сразу в DOM, чтобы между концом анимации и перерисовкой не мелькнул полный список
				if (body) body.hidden = true
				next.cancel()
				setClosing(false)
				onOpenChange(false)
			},
			() => setClosing(false)
		)
	}

	const toggle = (
		<button
			type="button"
			class={s.spoilerToggle}
			aria-expanded={expanded}
			aria-controls={bodyId}
			onClick={onClick}
		>
			<ChevronRight class={`icon ${s.chevron}`} />
			{summary}
		</button>
	)

	return (
		<div
			class={`${s.spoiler} ${className ?? ''}`}
			data-expanded={expanded ? '' : undefined}
			data-print={printHide ? 'hide' : undefined}
		>
			{heading ? <h3 class={s.spoilerHeading}>{toggle}</h3> : toggle}
			<div
				ref={bodyRef}
				id={bodyId}
				data-spoiler-body
				{...{hidden: open ? undefined : 'until-found'}}
			>
				<div class={s.spoilerBody}>{children}</div>
			</div>
		</div>
	)
}
