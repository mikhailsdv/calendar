import events from './events.json'

type Events = Record<string, {description: string; params: Record<string, string>}>

const escape = (text: string) => text.replace(/\|/g, '\\|')

/** Markdown со списком целей для настройки в Яндекс Метрике; источник — events.json */
export const goalsMarkdown = (list: Events = events) => {
	const rows = Object.entries(list).map(([id, {description, params}]) => {
		const described = Object.entries(params)
			.map(([name, meaning]) => `\`${name}\` — ${escape(meaning)}`)
			.join('<br>')
		return `| \`${id}\` | ${escape(description)} | ${described || '—'} |`
	})
	return `# Цели Яндекс Метрики

Файл собирается из [\`src/analytics/events.json\`](../src/analytics/events.json) командой \`npm run goals\`.
Руками его не правьте: тест сверяет его с JSON.

## Как завести цель

1. Метрика → «Настройки» счётчика → «Цели» → «Добавить цель».
2. Тип — «JavaScript-событие», условие — «Идентификатор цели совпадает с», значение — из колонки «Идентификатор».
3. Название цели — из колонки «Название».
4. Параметры событий приходят в отчёт «Параметры визитов», отдельно их настраивать не нужно.

## Цели (${rows.length})

| Идентификатор | Название | Параметры |
| --- | --- | --- |
${rows.join('\n')}
`
}
