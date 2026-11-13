import type {ComponentChildren} from 'preact'

/** Контурные иконки в стиле Tabler Icons (MIT) */
const Svg = ({
	children,
	class: className = 'icon',
}: {
	children: ComponentChildren
	class?: string
}) => (
	<svg
		class={className}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.8"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		{children}
	</svg>
)

type IconProps = {class?: string}

export const ChevronLeft = (p: IconProps) => (
	<Svg {...p}>
		<path d="M15 6l-6 6l6 6" />
	</Svg>
)

export const ChevronRight = (p: IconProps) => (
	<Svg {...p}>
		<path d="M9 6l6 6l-6 6" />
	</Svg>
)

export const PrinterIcon = (p: IconProps) => (
	<Svg {...p}>
		<path d="M17 17h2a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2M17 9V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v4M9 13h6a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z" />
	</Svg>
)

export const PointerIcon = (p: IconProps) => (
	<Svg {...p}>
		<path d="M7.904 17.563a1.2 1.2 0 0 0 2.228 .308l2.09-3.093l4.907 4.907a1.067 1.067 0 0 0 1.509 0l1.047-1.047a1.067 1.067 0 0 0 0-1.509l-4.907-4.907l3.113-2.09a1.2 1.2 0 0 0-.309-2.228l-13.582-3.904l3.904 13.563z" />
	</Svg>
)

export const SunIcon = (p: IconProps) => (
	<Svg {...p}>
		<circle cx="12" cy="12" r="4" />
		<path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
	</Svg>
)

export const MoonIcon = (p: IconProps) => (
	<Svg {...p}>
		<path d="M12 3c.13 0 .26 0 .39 0a7.5 7.5 0 0 0 7.92 12.45A9 9 0 1 1 12 3z" />
	</Svg>
)

export const SettingsIcon = (p: IconProps) => (
	<Svg {...p}>
		<path d="M10.33 4.32c.43-1.76 2.92-1.76 3.35 0a1.72 1.72 0 0 0 2.57 1.07c1.54-.94 3.31.83 2.37 2.37a1.72 1.72 0 0 0 1.07 2.57c1.75.43 1.75 2.92 0 3.35a1.72 1.72 0 0 0-1.07 2.57c.94 1.54-.83 3.31-2.37 2.37a1.72 1.72 0 0 0-2.57 1.07c-.43 1.75-2.92 1.75-3.35 0a1.72 1.72 0 0 0-2.57-1.07c-1.54.94-3.31-.83-2.37-2.37a1.72 1.72 0 0 0-1.07-2.57c-1.75-.43-1.75-2.92 0-3.35a1.72 1.72 0 0 0 1.07-2.57c-.94-1.54.83-3.31 2.37-2.37c1 .61 2.3.07 2.57-1.07z" />
		<circle cx="12" cy="12" r="3" />
	</Svg>
)

export const CloseIcon = (p: IconProps) => (
	<Svg {...p}>
		<path d="M18 6L6 18M6 6l12 12" />
	</Svg>
)

/** Классическая шестилучевая снежинка: каждый луч с «галочкой» у кончика */
export const SnowflakeIcon = (p: IconProps) => (
	<Svg {...p}>
		{[0, 60, 120, 180, 240, 300].map(angle => (
			<path key={angle} d="M12 12V3M10 4l2 2l2-2" transform={`rotate(${angle} 12 12)`} />
		))}
	</Svg>
)

export const SproutIcon = (p: IconProps) => (
	<Svg {...p}>
		<path d="M12 21v-9M12 12c0-4 3-7 8-7c0 4-3 7-8 7zM12 14c0-3-2.5-5.5-7-5.5c0 3 2.5 5.5 7 5.5z" />
	</Svg>
)

export const LeafIcon = (p: IconProps) => (
	<Svg {...p}>
		<path d="M5 21c.5-4.5 2.5-8 7-10M9 18c6.2 0 10.5-3.3 11-12V4h-4c-9 0-12 4-12 9c0 1 0 3 2 5h3z" />
	</Svg>
)
