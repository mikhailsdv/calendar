/**
 * Упрощённые флаги в SVG. Emoji-флаги не подходят: Windows показывает вместо них буквы.
 * Ключи — id стран из data/ и код gb для английского языка.
 */
const FLAGS: Record<string, preact.JSX.Element> = {
	ru: (
		<>
			<rect width="24" height="16" fill="#fff" />
			<rect y="5.33" width="24" height="5.34" fill="#0039a6" />
			<rect y="10.67" width="24" height="5.33" fill="#d52b1e" />
		</>
	),
	kz: (
		<>
			<rect width="24" height="16" fill="#00afca" />
			<circle cx="13" cy="7" r="2.6" fill="#fec50c" />
			<circle
				cx="13"
				cy="7"
				r="3.8"
				fill="none"
				stroke="#fec50c"
				stroke-width="0.9"
				stroke-dasharray="0.9 0.9"
			/>
			<path d="M9.5 11.6c1.2.9 5.8.9 7 0" stroke="#fec50c" stroke-width="0.9" fill="none" />
			<rect x="1.6" y="1" width="1.1" height="14" fill="#fec50c" />
		</>
	),
	by: (
		<>
			<rect width="24" height="16" fill="#c8313e" />
			<rect y="10.67" width="24" height="5.33" fill="#4aa657" />
			<rect width="3.6" height="16" fill="#fff" />
			<path
				d="M1.8 1l1 1.6l-1 1.6l-1-1.6zM1.8 6.4l1 1.6l-1 1.6l-1-1.6zM1.8 11.8l1 1.6l-1 1.6l-1-1.6z"
				fill="#c8313e"
			/>
		</>
	),
	am: (
		<>
			<rect width="24" height="16" fill="#d90012" />
			<rect y="5.33" width="24" height="5.34" fill="#0033a0" />
			<rect y="10.67" width="24" height="5.33" fill="#f2a800" />
		</>
	),
	ua: (
		<>
			<rect width="24" height="8" fill="#0057b7" />
			<rect y="8" width="24" height="8" fill="#ffd700" />
		</>
	),
	gb: (
		<>
			<rect width="24" height="16" fill="#012169" />
			<path d="M0 0l24 16M24 0L0 16" stroke="#fff" stroke-width="3.2" />
			<path d="M0 0l24 16M24 0L0 16" stroke="#c8102e" stroke-width="1.2" />
			<path d="M12 0v16M0 8h24" stroke="#fff" stroke-width="5" />
			<path d="M12 0v16M0 8h24" stroke="#c8102e" stroke-width="3" />
		</>
	),
}

/** Флаг языка интерфейса */
export const LANG_FLAG: Record<string, string> = {
	ru: 'ru',
	en: 'gb',
	kk: 'kz',
	hy: 'am',
	be: 'by',
	uk: 'ua',
}

/** Размер, скругление и обводка — в классе .flag; slice заполняет рамку целиком при любом размере */
export const Flag = ({code, class: className}: {code: string; class?: string}) => (
	<svg
		class={className ? `flag ${className}` : 'flag'}
		viewBox="0 0 24 16"
		width="21"
		height="14"
		preserveAspectRatio="xMidYMid slice"
		aria-hidden="true"
	>
		{FLAGS[code] ?? <rect width="24" height="16" fill="#999" />}
	</svg>
)
