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
 *
 * ZIP распаковывается через ZipArchive (расширение zip). Если его нет, архив читается своими силами
 * через zlib: архив собирает наш CI (`zip -qr`), поэтому хватает методов stored и deflate без zip64.
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

// Ранняя ошибка, до начала распаковки: убираем за собой архив, рабочую папку и сам распаковщик
function abort($message)
{
	global $lock, $work, $zipPath;
	if (!empty($lock)) {
		flock($lock, LOCK_UN);
		fclose($lock);
	}
	@unlink($work . '/lock');
	@rmdir($work . '/new');
	@rmdir($work . '/old');
	@rmdir($work);
	@unlink($zipPath);
	@unlink(__FILE__);
	respond('DEPLOY_FAILED: ' . $message);
}

// Записи центрального каталога ZIP: имя, метод сжатия, размеры, CRC и смещение локального заголовка
function zipEntries($path)
{
	$size = filesize($path);
	$fp = fopen($path, 'rb');
	if (!$fp || $size < 22) {
		return null;
	}
	// Запись «конец центрального каталога» лежит в последних 22 байтах плюс комментарий до 64 КБ
	$tail = min($size, 22 + 65535);
	fseek($fp, $size - $tail);
	$data = fread($fp, $tail);
	$pos = strrpos($data, "PK\x05\x06");
	if ($pos === false) {
		fclose($fp);
		return null;
	}
	$end = unpack('vdisk/vcdDisk/vdiskEntries/ventries/VcdSize/VcdOffset', substr($data, $pos + 4, 16));
	fseek($fp, $end['cdOffset']);
	$cd = fread($fp, $end['cdSize']);
	fclose($fp);

	$entries = [];
	$p = 0;
	for ($i = 0; $i < $end['entries']; $i++) {
		if (substr($cd, $p, 4) !== "PK\x01\x02") {
			return null;
		}
		$h = unpack(
			'vmade/vneed/vflags/vmethod/vtime/vdate/Vcrc/Vcsize/Vsize/vnameLen/vextraLen/vcommentLen/vdisk/vinternal/Vexternal/Voffset',
			substr($cd, $p + 4, 42)
		);
		$entries[] = [
			'name' => substr($cd, $p + 46, $h['nameLen']),
			'flags' => $h['flags'],
			'method' => $h['method'],
			'crc' => $h['crc'],
			'csize' => $h['csize'],
			'size' => $h['size'],
			'offset' => $h['offset'],
		];
		$p += 46 + $h['nameLen'] + $h['extraLen'] + $h['commentLen'];
	}
	return $entries;
}

// Никаких абсолютных путей и выходов наверх через ..
function safeName($name)
{
	return $name !== '' && $name[0] !== '/' && strpos($name, '\\') === false && !preg_match('#(^|/)\.\.(/|$)#', $name);
}

// Распаковывает одну запись через ZipArchive. CRC проверяет сама libzip
function extractZipArchiveEntry($zip, $index, $dest)
{
	$name = $zip->getNameIndex($index);
	if ($name === false || !safeName($name)) {
		return false;
	}
	return $zip->extractTo($dest, $name);
}

// Распаковывает одну запись через zlib. Возвращает false при любой ошибке, в том числе при неверной CRC
function extractEntry($fp, $entry, $dest)
{
	$name = $entry['name'];
	if (!safeName($name) || ($entry['flags'] & 1)) {
		return false;
	}
	$target = $dest . '/' . $name;
	if (substr($name, -1) === '/') {
		return is_dir($target) || mkdir($target, 0755, true);
	}
	$dir = dirname($target);
	if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
		return false;
	}
	fseek($fp, $entry['offset']);
	$local = unpack('Vsig/vneed/vflags/vmethod/vtime/vdate/Vcrc/Vcsize/Vsize/vnameLen/vextraLen', fread($fp, 30));
	if ($local['sig'] !== 0x04034b50) {
		return false;
	}
	fseek($fp, $entry['offset'] + 30 + $local['nameLen'] + $local['extraLen']);
	$raw = $entry['csize'] > 0 ? fread($fp, $entry['csize']) : '';
	if ($entry['size'] === 0) {
		$content = '';
	} elseif ($entry['method'] === 8) {
		$content = gzinflate($raw);
	} elseif ($entry['method'] === 0) {
		$content = $raw;
	} else {
		return false;
	}
	if ($content === false || strlen($content) !== $entry['size']) {
		return false;
	}
	if (sprintf('%08x', $entry['crc']) !== hash('crc32b', $content)) {
		return false;
	}
	return file_put_contents($target, $content) !== false;
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
	abort('cannot create work dir');
}

// Если предыдущий вызов ещё работает (CI не дождался ответа), не мешаем ему
$lock = fopen($work . '/lock', 'c');
if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) {
	respond('DEPLOY_CONTINUE: previous step is still running');
}

$state = is_file($statePath) ? json_decode(file_get_contents($statePath), true) : null;

if (!$state) {
	$engine = class_exists('ZipArchive') ? 'ziparchive' : (function_exists('gzinflate') ? 'zlib' : null);
	if ($engine === null) {
		abort('neither PHP extension "zip" nor "zlib" is available');
	}
	if (!is_file($zipPath)) {
		abort('archive ' . $zipName . ' not found');
	}
	if ((!is_dir($newDir) && !mkdir($newDir, 0755)) || (!is_dir($oldDir) && !mkdir($oldDir, 0755))) {
		abort('cannot create work dir');
	}
	$state = ['phase' => 'extract', 'next' => 0, 'engine' => $engine];
	saveState($state);
}

if ($state['phase'] === 'extract') {
	if ($state['engine'] === 'ziparchive') {
		$zip = new ZipArchive();
		if ($zip->open($zipPath) !== true) {
			fail($state, 'cannot read archive');
		}
		$total = $zip->numFiles;
		$extract = function ($i) use ($zip, $newDir) {
			return extractZipArchiveEntry($zip, $i, $newDir);
		};
		$nameOf = function ($i) use ($zip) {
			return (string) $zip->getNameIndex($i);
		};
		$close = function () use ($zip) {
			$zip->close();
		};
	} else {
		$entries = zipEntries($zipPath);
		$fp = fopen($zipPath, 'rb');
		if ($entries === null || !$fp) {
			fail($state, 'cannot read archive');
		}
		$total = count($entries);
		$extract = function ($i) use ($fp, $entries, $newDir) {
			return extractEntry($fp, $entries[$i], $newDir);
		};
		$nameOf = function ($i) use ($entries) {
			return $entries[$i]['name'];
		};
		$close = function () use ($fp) {
			fclose($fp);
		};
	}

	for ($i = $state['next']; $i < $total; $i++) {
		if (!$extract($i)) {
			$name = $nameOf($i);
			$close();
			fail($state, 'cannot extract ' . $name);
		}
		if (($i + 1) % SAVE_EVERY === 0) {
			$state['next'] = $i + 1;
			saveState($state);
		}
		if (timeIsUp()) {
			$state['next'] = $i + 1;
			saveState($state);
			$close();
			respond('DEPLOY_CONTINUE: extracted ' . ($i + 1) . '/' . $total . ' (' . $state['engine'] . ')');
		}
	}
	$close();

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
