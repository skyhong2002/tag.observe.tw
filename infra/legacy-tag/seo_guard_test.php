<?php
// php infra/legacy-tag/seo_guard_test.php — run with the legacy host's PHP 5.4 CLI.
require dirname(__FILE__) . '/seo_guard.php';

$failed = 0;
function check($name, $got, $want) {
  global $failed;
  if ($got === $want) return;
  $failed++;
  printf("FAIL %s\n  got:  %s\n  want: %s\n", $name, var_export($got, true), var_export($want, true));
}
function req($uri, $host = 'tag.analysis.tw', $scheme = 'https', $script = null) {
  $s = array('HTTP_HOST' => $host, 'REQUEST_URI' => $uri);
  if ($scheme) $s['HTTP_CF_VISITOR'] = '{"scheme":"' . $scheme . '"}';
  if ($script) $s['SCRIPT_NAME'] = $script;
  return $s;
}
$list = "\n颱風\nEXO\n";
$typhoon = '%E9%A2%B1%E9%A2%A8';

// Hosts and schemes.
check('http to https', legacy_seo_decide('tag', req("/tag/$typhoon/", 'tag.analysis.tw', 'http'), array('tag' => '颱風'), $list),
  array('action' => 'redirect', 'location' => "https://tag.analysis.tw/tag/$typhoon/"));
check('origin without CF headers', legacy_seo_decide('home', req('/', 'tag.analysis.tw', null), array(), $list),
  array('action' => 'redirect', 'location' => 'https://tag.analysis.tw/'));
check('seokpi alias', legacy_seo_decide('home', req('/?order=score', 'seokpi.analysis.tw', null), array('order' => 'score'), $list),
  array('action' => 'redirect', 'location' => 'https://tag.analysis.tw/?order=score'));
check('api2 alias with port', legacy_seo_decide('tag', req("/tag/$typhoon/", 'API2.analysis.tw:80', null), array('tag' => '颱風'), $list),
  array('action' => 'redirect', 'location' => "https://tag.analysis.tw/tag/$typhoon/"));
check('raw IP', legacy_seo_decide('home', req('/', '148.72.153.247', null), array(), $list),
  array('action' => 'redirect', 'location' => 'https://tag.analysis.tw/'));
check('unrelated host left alone', legacy_seo_decide('home', req('/', 'web.mas.ter.tw', null), array(), $list),
  array('action' => 'page', 'canonical' => 'https://tag.observe.tw/'));

// Home.
check('home', legacy_seo_decide('home', req('/'), array(), $list), array('action' => 'page', 'canonical' => 'https://tag.observe.tw/'));
check('home order variant', legacy_seo_decide('home', req('/?order=score'), array('order' => 'score'), $list),
  array('action' => 'page', 'canonical' => 'https://tag.observe.tw/'));
check('category', legacy_seo_decide('home', req('/cat/finance/'), array('type' => 'finance'), $list),
  array('action' => 'page', 'canonical' => 'https://tag.analysis.tw/cat/finance/'));
check('media view stays', legacy_seo_decide('home', req('/media/cna/x'), array('media' => 'cna'), $list),
  array('action' => 'page', 'canonical' => 'https://tag.analysis.tw/media/cna/x'));

// Tags.
check('tag on new site', legacy_seo_decide('tag', req("/tag/$typhoon/"), array('tag' => '颱風'), $list),
  array('action' => 'page', 'canonical' => "https://tag.observe.tw/tag/$typhoon/", 'empty_noindex' => false));
check('tag only here', legacy_seo_decide('tag', req('/tag/%E6%B4%AA%E7%AF%A4%E6%98%8C/'), array('tag' => '洪篤昌'), $list),
  array('action' => 'page', 'canonical' => 'https://tag.analysis.tw/tag/%E6%B4%AA%E7%AF%A4%E6%98%8C/', 'empty_noindex' => true));
check('tag path params collapse', legacy_seo_decide('tag', req("/tag/$typhoon/hours=24&limit=9"), array('tag' => '颱風', 'hours' => '24'), $list),
  array('action' => 'page', 'canonical' => "https://tag.observe.tw/tag/$typhoon/", 'empty_noindex' => false));
check('category tag view collapses', legacy_seo_decide('tag', req("/cat/news/tag/$typhoon/"), array('tag' => '颱風', 'type' => 'news'), $list),
  array('action' => 'page', 'canonical' => "https://tag.observe.tw/tag/$typhoon/", 'empty_noindex' => false));
check('tag.php query form', legacy_seo_decide('tag', req('/tag.php?tag=EXO'), array('tag' => 'EXO'), $list),
  array('action' => 'redirect', 'location' => 'https://tag.analysis.tw/tag/EXO/'));
check('tag.php over http is one hop', legacy_seo_decide('tag', req('/tag.php?tag=%E9%A2%B1%E9%A2%A8', 'tag.analysis.tw', 'http'), array('tag' => '颱風'), $list),
  array('action' => 'redirect', 'location' => "https://tag.analysis.tw/tag/$typhoon/"));
check('trimmed tag', legacy_seo_decide('tag', req('/tag/%20EXO/'), array('tag' => ' EXO'), $list),
  array('action' => 'page', 'canonical' => 'https://tag.observe.tw/tag/EXO/', 'empty_noindex' => false));
check('exact match only', legacy_seo_decide('tag', req('/tag/exo/'), array('tag' => 'exo'), $list),
  array('action' => 'page', 'canonical' => 'https://tag.analysis.tw/tag/exo/', 'empty_noindex' => true));
check('nt_id residue', legacy_seo_decide('tag', req('/tag/%7Bnt_id:123%7D/'), array('tag' => '{nt_id:123}'), $list), array('action' => 'not_found'));
check('markup in tag', legacy_seo_decide('tag_sub', req('/tag/%3Cb%3E/view/', 'tag.analysis.tw', 'https', '/tag_view.php'), array('tag' => '<b>'), $list),
  array('action' => 'not_found'));
check('empty tag', legacy_seo_decide('tag', req('/tag/%20/'), array('tag' => ' '), $list), array('action' => 'not_found'));
check('missing tag', legacy_seo_decide('tag', req('/tag.php'), array(), $list), array('action' => 'not_found'));
check('invalid utf-8', legacy_seo_decide('tag', req('/tag/%FF/'), array('tag' => "\xff"), $list), array('action' => 'not_found'));
check('subpage self canonical', legacy_seo_decide('tag_sub', req("/tag/$typhoon/series/x=1", 'tag.analysis.tw', 'https', '/tag_series.php'), array('tag' => '颱風'), $list),
  array('action' => 'page', 'canonical' => "https://tag.analysis.tw/tag/$typhoon/series/"));

// Retired Facebook views.
check('fb sort trap', legacy_seo_decide('gone', req('/tag/%E6%8E%A1%E6%AA%A2%E7%B5%90%E6%9E%9C/fb/sort=comment&hours=24'), array('tag' => '採檢結果', 'sort' => 'comment'), $list),
  array('action' => 'gone', 'tag' => '採檢結果'));
check('fb bad tag', legacy_seo_decide('gone', req('/tag/%7B%7D/fb/'), array('tag' => '{}'), $list), array('action' => 'gone', 'tag' => null));
check('news fb', legacy_seo_decide('gone', req('/news_fb.php?media=cna'), array('media' => 'cna'), $list), array('action' => 'gone', 'tag' => null));
check('fb on alias host redirects first', legacy_seo_decide('gone', req('/tag/a/fb/', 'seokpi.analysis.tw', null), array('tag' => 'a'), $list),
  array('action' => 'redirect', 'location' => 'https://tag.analysis.tw/tag/a/fb/'));

// Other pages keep themselves, without query strings.
check('event page', legacy_seo_decide('page', req('/event/2026-10-01/08/?x=1'), array(), $list),
  array('action' => 'page', 'canonical' => 'https://tag.analysis.tw/event/2026-10-01/08/'));

// encodeURIComponent parity (values from node).
check('enc punctuation', legacy_seo_enc("A B!*'()~-_."), "A%20B!*'()~-_.");
check('enc slash plus', legacy_seo_enc('a/b+c&d'), 'a%2Fb%2Bc%26d');

// Head insertion and empty-page detection on real page fragments.
$empty = "<html><head><title>x</title>\n</head><body>var data = [];\n<table class='ui celled table datatable'><thead><tr><th>名次</th></tr></thead><tbody></tbody></table></body></html>";
$full = "<html><head><title>x</title>\n</head><body>var data = [{text:'a',size:3}];<tbody><tr><td>1</td></tr></tbody></body></html>";
check('empty detected', legacy_seo_empty_tag_page($empty), true);
check('content detected', legacy_seo_empty_tag_page($full), false);
check('canonical inserted', legacy_seo_head("<head><title>x</title></head><body></body>", 'https://tag.analysis.tw/a&b', false),
  "<head><title>x</title><link rel=\"canonical\" href=\"https://tag.analysis.tw/a&amp;b\">\n</head><body></body>");
check('noindex inserted', legacy_seo_head('<HEAD></HEAD>', 'https://x/', true),
  "<HEAD><link rel=\"canonical\" href=\"https://x/\">\n<meta name=\"robots\" content=\"noindex, follow\">\n</HEAD>");
check('existing canonical kept', legacy_seo_head('<head><link rel="canonical" href="https://a/"></head>', 'https://b/', false),
  '<head><link rel="canonical" href="https://a/"></head>');
check('no head untouched', legacy_seo_head('{"json":1}', 'https://b/', true), '{"json":1}');

if ($failed) {
  printf("%d failed\n", $failed);
  exit(1);
}
echo "ok\n";
