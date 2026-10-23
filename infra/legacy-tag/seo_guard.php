<?php
// Search-engine guard for the legacy tag.analysis.tw PHP site (PHP 5.4, mod_php,
// AllowOverride None, no auto_prepend). Each guarded entry script includes this
// file before any output and calls legacy_seo_guard('<kind>').
//
// It only decides HTTP status, redirects, and the <link rel=canonical>/<meta robots>
// tags. Page content, database rows, the /api/*.php endpoints and command-line runs
// are left alone. Source of truth: tag.observe.tw repo, infra/legacy-tag/.

if (defined('LEGACY_SEO_GUARD')) return;
define('LEGACY_SEO_GUARD', 1);

define('LEGACY_SEO_HOST', 'tag.analysis.tw');
define('LEGACY_SEO_NEW_ORIGIN', 'https://tag.observe.tw');
// Tags whose tag.observe.tw page answers 200 with a self canonical (tools/legacy-seo-tags.ts).
define('LEGACY_SEO_TAG_LIST', dirname(__FILE__) . '/seo/observe-tags.txt');

/** Hosts answering with this site's pages besides tag.analysis.tw itself. */
function legacy_seo_alias_host($host) {
  return in_array($host, array('seokpi.analysis.tw', 'api.analysis.tw', 'api2.analysis.tw'), true)
    || preg_match('/^\d{1,3}(\.\d{1,3}){3}$/', $host);
}

/** encodeURIComponent(), so links match tag.observe.tw's own canonical URLs. */
function legacy_seo_enc($s) {
  return str_replace(array('%21', '%2A', '%27', '%28', '%29'), array('!', '*', "'", '(', ')'), rawurlencode($s));
}

/** Template residue and markup are never real tags (GSC: /tag/{nt_id:...}/). */
function legacy_seo_bad_tag($tag) {
  return $tag === '' || preg_match('/[{}<>"\\\\\x00-\x1f\x7f]/u', $tag) || !preg_match('//u', $tag);
}

function legacy_seo_new_has_tag($tag, $list = null) {
  static $cache = null;
  if ($list === null) {
    if ($cache === null) {
      $cache = @file_get_contents(LEGACY_SEO_TAG_LIST);
      if ($cache === false) $cache = '';
    }
    $list = $cache;
  }
  return $tag !== '' && strpos($list, "\n" . $tag . "\n") !== false;
}

/** The tag page printed nothing: no word cloud entries and an empty ranking table. */
function legacy_seo_empty_tag_page($html) {
  return strpos($html, 'var data = [];') !== false && strpos($html, '<tbody></tbody>') !== false;
}

/**
 * Pure decision for one request.
 * @return array action: redirect|gone|not_found|page; with location, canonical, tag, empty_noindex
 */
function legacy_seo_decide($kind, $server, $get, $list = null) {
  $host = strtolower(preg_replace('/:\d+$/', '', isset($server['HTTP_HOST']) ? $server['HTTP_HOST'] : ''));
  $uri = isset($server['REQUEST_URI']) ? $server['REQUEST_URI'] : '/';
  $path = parse_url($uri, PHP_URL_PATH);
  if (!is_string($path) || $path === '') $path = '/';
  $visitor = isset($server['HTTP_CF_VISITOR']) ? $server['HTTP_CF_VISITOR'] : '';
  $https = strpos($visitor, '"https"') !== false
    || (isset($server['HTTPS']) && $server['HTTPS'] !== '' && $server['HTTPS'] !== 'off')
    || (isset($server['HTTP_X_FORWARDED_PROTO']) && strtolower($server['HTTP_X_FORWARDED_PROTO']) === 'https');
  $self = 'https://' . LEGACY_SEO_HOST;
  $tag = isset($get['tag']) && is_string($get['tag']) ? trim($get['tag']) : null;

  // tag.php?tag=X is what api.analysis.tw's Apache redirect produces; one hop to the final URL.
  if ($kind === 'tag' && $path === '/tag.php' && $tag !== null && !legacy_seo_bad_tag($tag))
    return array('action' => 'redirect', 'location' => $self . '/tag/' . legacy_seo_enc($tag) . '/');

  // One host, one scheme. Other hosts reaching this vhost are left as they are.
  if (($host === LEGACY_SEO_HOST && !$https) || legacy_seo_alias_host($host))
    return array('action' => 'redirect', 'location' => $self . $uri);

  if ($kind === 'gone') return array('action' => 'gone', 'tag' => $tag !== null && !legacy_seo_bad_tag($tag) ? $tag : null);

  if ($kind === 'tag' || $kind === 'tag_sub') {
    if ($tag === null || legacy_seo_bad_tag($tag)) return array('action' => 'not_found');
    if ($kind === 'tag') {
      $onNew = legacy_seo_new_has_tag($tag, $list);
      return array(
        'action' => 'page',
        'canonical' => ($onNew ? LEGACY_SEO_NEW_ORIGIN : $self) . '/tag/' . legacy_seo_enc($tag) . '/',
        'empty_noindex' => !$onNew,
      );
    }
    $script = isset($server['SCRIPT_NAME']) ? basename($server['SCRIPT_NAME'], '.php') : '';
    $sub = preg_match('/^tag_([a-z]+)$/', $script, $m) ? $m[1] : null;
    return array('action' => 'page', 'canonical' => $self . '/tag/' . legacy_seo_enc($tag) . '/' . ($sub ? $sub . '/' : ''));
  }

  if ($kind === 'home') {
    if (isset($get['type']) && is_string($get['type']) && $get['type'] !== '')
      return array('action' => 'page', 'canonical' => $self . '/cat/' . legacy_seo_enc($get['type']) . '/');
    if (($path === '/' || $path === '/index.php') && !isset($get['media']))
      return array('action' => 'page', 'canonical' => LEGACY_SEO_NEW_ORIGIN . '/');
  }
  return array('action' => 'page', 'canonical' => $self . $path);
}

function legacy_seo_head($html, $canonical, $noindex) {
  $pos = stripos($html, '</head>');
  if ($pos === false || stripos($html, 'rel="canonical"') !== false) return $html;
  $tags = '<link rel="canonical" href="' . htmlspecialchars($canonical, ENT_QUOTES, 'UTF-8') . '">' . "\n";
  if ($noindex) $tags .= '<meta name="robots" content="noindex, follow">' . "\n";
  return substr($html, 0, $pos) . $tags . substr($html, $pos);
}

function legacy_seo_stop($status, $title, $message, $link) {
  http_response_code($status);
  header('Content-Type: text/html; charset=UTF-8');
  header('X-Robots-Tag: noindex');
  header('Cache-Control: public, max-age=86400');
  printf(
    "<!doctype html>\n<html lang=\"zh-Hant-TW\"><head><meta charset=\"utf-8\"><meta name=\"robots\" content=\"noindex\"><title>%s - 新文易數</title></head>"
      . "<body><h1>%s</h1><p>%s</p><p><a href=\"%s\">%s</a></p></body></html>\n",
    $title, $title, $message, htmlspecialchars($link[0], ENT_QUOTES, 'UTF-8'), $link[1]
  );
  exit;
}

/** @param string $kind home | tag | tag_sub | gone | page */
function legacy_seo_guard($kind) {
  if (PHP_SAPI === 'cli') return;
  $d = legacy_seo_decide($kind, $_SERVER, $_GET);
  if ($d['action'] === 'redirect') {
    header('Cache-Control: public, max-age=86400');
    header('Location: ' . $d['location'], true, 301);
    exit;
  }
  if ($d['action'] === 'gone')
    legacy_seo_stop(
      410,
      '臉書讚享評已停止提供',
      '臉書互動數自 2024 年 3 月起不再更新，這個頁面已移除。',
      $d['tag'] !== null ? array('/tag/' . legacy_seo_enc($d['tag']) . '/', htmlspecialchars($d['tag'], ENT_QUOTES, 'UTF-8') . ' 標籤基本資料') : array('/', '回首頁')
    );
  if ($d['action'] === 'not_found') legacy_seo_stop(404, '找不到這個標籤', '網址中的標籤無效。', array('/', '回首頁'));
  $canonical = $d['canonical'];
  $emptyNoindex = !empty($d['empty_noindex']);
  ob_start(function ($html) use ($canonical, $emptyNoindex) {
    return legacy_seo_head($html, $canonical, $emptyNoindex && legacy_seo_empty_tag_page($html));
  });
}
