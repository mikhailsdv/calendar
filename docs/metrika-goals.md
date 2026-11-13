# Цели Яндекс Метрики

Файл собирается из [`src/analytics/events.json`](../src/analytics/events.json) командой `npm run goals`.
Руками его не правьте: тест сверяет его с JSON.

## Как завести цель

1. Метрика → «Настройки» счётчика → «Цели» → «Добавить цель».
2. Тип — «JavaScript-событие», условие — «Идентификатор цели совпадает с», значение — из колонки «Идентификатор».
3. Название цели — из колонки «Название».
4. Параметры событий приходят в отчёт «Параметры визитов», отдельно их настраивать не нужно.

## Цели (22)

| Идентификатор | Название | Параметры |
| --- | --- | --- |
| `lang_change` | Выбран язык в селекторе | `from` — язык до<br>`to` — выбранный язык |
| `theme_change` | Переключена тема | `theme` — light \| dark |
| `view_change` | Переключён вид календаря | `view` — year \| month |
| `year_change` | Переключён год | `year` — выбранный год |
| `mode_change` | Переключён режим: просмотр или отпуск | `mode` — view \| vacation |
| `country_toggle` | Страна добавлена в наложение или убрана | `country` — id страны<br>`action` — add \| remove<br>`count` — сколько стран стало |
| `country_limit_hit` | Попытка выбрать больше стран, чем можно наложить | `country` — id страны |
| `home_change` | Изменена основная страна | `country` — id страны |
| `compare_toggle` | Включено или выключено сравнение стран | `state` — on \| off |
| `day_open` | Открыты подробности дня | `view` — вид, в котором нажали |
| `transfer_open` | Нажата кнопка «Показать» у переноса | `country` — id страны |
| `vacation_select` | Выбран диапазон отпуска | `days` — календарных дней<br>`countries` — сколько стран в наложении |
| `vacation_cancel` | Выделение отпуска сброшено | — |
| `settings_open` | Открыты настройки | — |
| `outbound_click` | Переход по ссылке автора в футере | `target` — telegram_channel \| telegram_dm \| cv \| projects |
| `today_click` | Нажата кнопка «Сегодня» | `view` — year \| month |
| `print_click` | Нажата кнопка печати в шапке | `view` — вид календаря при печати |
| `spoiler_toggle` | Раскрыт или свёрнут спойлер: праздники страны или нормы по месяцам | `section` — holidays \| monthly<br>`country` — id страны, только для holidays<br>`state` — open \| close |
| `sheet_toggle` | На телефоне развёрнута, свёрнута или закрыта нижняя шторка | `state` — expand \| collapse \| close<br>`via` — tap \| drag \| outside \| keyboard |
| `upcoming_open` | Нажат праздник в списке ближайших | `country` — id первой страны с этим праздником<br>`days_until` — через сколько дней праздник |
| `month_swipe` | Свайпом переключён месяц на телефоне | `direction` — next \| prev |
| `week_numbers_toggle` | В настройках включены или выключены номера недель | `enabled` — yes \| no |
