import {pathFor} from '../app/routes'
import {LANG_NAMES, LANGS} from '../config'
import {useI18n} from '../i18n'
import {Flag, LANG_FLAG} from './Flag'
import s from './Layout.module.css'

/** Корень сайта: без JS показывает выбор языка, с JS скрипт в index.html сразу уводит на нужный */
export const RootPage = () => {
	const {t} = useI18n()
	return (
		<main class={s.center}>
			<p class={s.brand}>{t.meta.siteName}</p>
			<h1>{t.meta.titleCurrent}</h1>
			<p class={s.subtitle}>{t.root.choose}</p>
			<ul class={s.langList}>
				{LANGS.map(lang => (
					<li key={lang}>
						<a href={pathFor(lang)} hrefLang={lang} lang={lang}>
							<Flag code={LANG_FLAG[lang]!} />
							{LANG_NAMES[lang]}
						</a>
					</li>
				))}
			</ul>
		</main>
	)
}

export const NotFoundPage = () => (
	<main class={s.center}>
		<h1>404</h1>
		<p>Такой страницы нет · Page not found</p>
		<p>
			<a href={pathFor('ru')}>Открыть календарь</a> · <a href={pathFor('en')}>Open the calendar</a>
		</p>
	</main>
)
