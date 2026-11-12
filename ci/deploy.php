<?php
/**
 * Распаковщик деплоя. Заливается CI по FTP рядом с архивом под случайным именем
 * __deploy_<id>.php (архив — __deploy_<id>.zip). CI вызывает ?action=step в цикле: каждый вызов
 * работает не дольше STEP_BUDGET секунд и отвечает DEPLOY_CONTINUE, пока не вернёт DEPLOY_OK
 * или DEPLOY_FAILED. Фоновая работа не нужна, таймауты nginx/PHP не мешают: если вызов убьют,
 * следующий продолжит с сохранённого прогресса.
 *
 * Фазы: extract (распаковка в __deploy_<id>/new порциями) -> swap (подмена через rename(), быстро)
 * -> cleanup (удаление старой версии порциями, сайт к этому моменту уже обновлён).
 *
 * Повторяет семантику `lftp mirror --delete`: всё, чего нет в архиве, удаляется. Пока не прошёл
 * swap, старая версия сайта не тронута.
 */

const STEP_BUDGET = 10;
const SAVE_EVERY = 200;

$startedAt = microtime(true);
set_time_limit(0);
ignore_user_abort(true);
header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-store');

$root = __DIR__;
$self = basename(__FILE__);
$base = substr($self, 0, -strlen('.php'));
$zipName = $base . '.zip';
$zipPath = $root . '/' . $zipName;
$work = $root . '/' . $base;
$newDir = $work . '/new';
$oldDir = $work . '/old';
$statePath = $work . '/state.json';
$reserved = [$self, $zipName, $base];

function respond($message)
{
	echo $message . "\n";
	exit;
}

function timeIsUp()
{
	global $startedAt;
	return microtime(true) - $startedAt > STEP_BUDGET;
}

function saveState($state)
{
	global $statePath;
	file_put_contents($statePath, json_encode($state), LOCK_EX);
}

// Переводит в cleanup: следующие вызовы уберут недораспакованное и вернут DEPLOY_FAILED
function fail($state, $message)
{
	$state['phase'] = 'cleanup';
	$state['error'] = $message;
	saveState($state);
	respond('DEPLOY_CONTINUE: failed (' . $message . '), cleaning up');
}

function listDir($path)
{
	return array_values(array_diff(scandir($path), ['.', '..']));
}

// Удаляет содержимое $path, пока не кончится время. Возвращает true, если удалено всё
function removeContents($path)
{
	if (!is_dir($path)) {
		return true;
	}
	$items = new RecursiveIteratorIterator(
		new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS),
		RecursiveIteratorIterator::CHILD_FIRST
	);
	foreach ($items as $item) {
		$item->isDir() && !$item->isLink() ? rmdir($item->getPathname()) : unlink($item->getPathname());
		if (timeIsUp()) {
			return false;
		}
	}
	return true;
}

if ((isset($_GET['action']) ? $_GET['action'] : '') !== 'step') {
	http_response_code(400);
	respond('Unknown action');
}

if (!is_dir($work) && !mkdir($work, 0755)) {
	respond('DEPLOY_FAILED: cannot create work dir');
}

// Если предыдущий вызов ещё работает (CI не дождался ответа), не мешаем ему
$lock = fopen($work . '/lock', 'c');
if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) {
	respond('DEPLOY_CONTINUE: previous step is still running');
}

$state = is_file($statePath) ? json_decode(file_get_contents($statePath), true) : null;

if (!$state) {
	if (!class_exists('ZipArchive')) {
		respond('DEPLOY_FAILED: PHP extension "zip" is not available');
	}
	if (!is_file($zipPath)) {
		respond('DEPLOY_FAILED: archive ' . $zipName . ' not found');
	}
	if ((!is_dir($newDir) && !mkdir($newDir, 0755)) || (!is_dir($oldDir) && !mkdir($oldDir, 0755))) {
		respond('DEPLOY_FAILED: cannot create work dir');
	}
	$state = ['phase' => 'extract', 'next' => 0];
	saveState($state);
}

if ($state['phase'] === 'extract') {
	$zip = new ZipArchive();
	if ($zip->open($zipPath) !== true) {
		fail($state, 'cannot open archive');
	}
	$total = $zip->numFiles;
	for ($i = $state['next']; $i < $total; $i++) {
		$entry = $zip->getNameIndex($i);
		if (!$zip->extractTo($newDir, $entry)) {
			$zip->close();
			fail($state, 'cannot extract ' . $entry);
		}
		if (($i + 1) % SAVE_EVERY === 0) {
			$state['next'] = $i + 1;
			saveState($state);
		}
		if (timeIsUp()) {
			$state['next'] = $i + 1;
			saveState($state);
			$zip->close();
			respond('DEPLOY_CONTINUE: extracted ' . ($i + 1) . '/' . $total);
		}
	}
	$zip->close();

	if (!is_file($newDir . '/index.html')) {
		fail($state, 'index.html is missing in archive');
	}
	$state = ['phase' => 'swap'];
	saveState($state);
}

if ($state['phase'] === 'swap') {
	$newItems = listDir($newDir);

	// Подменяем каждый элемент верхнего уровня: старый уезжает в old/, новый встаёт на его место.
	$swapped = [];
	foreach ($newItems as $name) {
		$target = $root . '/' . $name;
		$hadOld = file_exists($target) || is_link($target);
		if ($hadOld && !rename($target, $oldDir . '/' . $name)) {
			$error = 'cannot move away ' . $name;
		} elseif (!rename($newDir . '/' . $name, $target)) {
			if ($hadOld) {
				rename($oldDir . '/' . $name, $target);
			}
			$error = 'cannot move in ' . $name;
		}
		if (isset($error)) {
			// Откатываем уже подменённое (новое возвращаем в new/), чтобы не оставить сайт в смешанном состоянии
			foreach (array_reverse($swapped) as $item) {
				rename($root . '/' . $item['name'], $newDir . '/' . $item['name']);
				if ($item['hadOld']) {
					rename($oldDir . '/' . $item['name'], $root . '/' . $item['name']);
				}
			}
			fail($state, $error);
		}
		$swapped[] = ['name' => $name, 'hadOld' => $hadOld];
	}

	// Убираем то, чего нет в новой сборке (аналог --delete)
	$removed = 0;
	foreach (listDir($root) as $name) {
		if (in_array($name, $reserved, true) || in_array($name, $newItems, true)) {
			continue;
		}
		rename($root . '/' . $name, $oldDir . '/' . $name);
		$removed++;
	}

	$state = [
		'phase' => 'cleanup',
		'result' => count($newItems) . ' top-level items deployed, ' . $removed . ' stale removed',
	];
	saveState($state);
}

if ($state['phase'] === 'cleanup') {
	if (!removeContents($oldDir) || !removeContents($newDir)) {
		respond('DEPLOY_CONTINUE: removing old files');
	}
	flock($lock, LOCK_UN);
	fclose($lock);
	@unlink($zipPath);
	@rmdir($oldDir);
	@rmdir($newDir);
	@unlink($work . '/lock');
	@unlink($statePath);
	@rmdir($work);
	@unlink(__FILE__);
	respond(isset($state['error']) ? 'DEPLOY_FAILED: ' . $state['error'] : 'DEPLOY_OK: ' . $state['result']);
}

respond('DEPLOY_FAILED: unknown state');
