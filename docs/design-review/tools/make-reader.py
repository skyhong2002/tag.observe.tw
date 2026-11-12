#!/usr/bin/env python3
"""Write SNAPSHOT/reader.json: a made-up signed-in reader (no real account)
whose saves and feed point at real articles in the snapshot.
  python3 make-reader.py SNAPSHOT_DIR"""
import hashlib, json, sys
from pathlib import Path

snap = Path(sys.argv[1])
def body(key):
    return json.loads((snap / 'bodies' / hashlib.sha256(key.encode()).hexdigest()[:24]).read_text())
arts = body('/api/v1/tags/%E9%BB%83%E4%BB%81%E5%8B%B3/articles?limit=10')['articles']
pick = lambda a: {k: a[k] for k in ('id', 'media', 'mediaTitle', 'title', 'url', 'publishedAt')}
follows = [
    {'kind': 'tag', 'target': '黃仁勳'}, {'kind': 'tag', 'target': '颱風'},
    {'kind': 'media', 'target': 'udn', 'label': '聯合新聞網'}, {'kind': 'media', 'target': 'ltn', 'label': '自由時報'},
    {'kind': 'journalist', 'target': '廖賢龍'}, {'kind': 'event', 'target': '4128', 'label': '黃仁勳、NVIDIA、輝達'},
]
saves = [
    {'kind': 'article', 'id': arts[5]['id'], 'note': '比較財經媒體與政論媒體的標題', 'savedAt': arts[5]['publishedAt'], 'article': pick(arts[5]), 'event': None},
    {'kind': 'article', 'id': arts[8]['id'], 'note': None, 'savedAt': arts[8]['publishedAt'], 'article': pick(arts[8]), 'event': None},
    {'kind': 'event', 'id': 4128, 'note': '後續：國會聽證會', 'savedAt': arts[2]['publishedAt'], 'article': None,
     'event': {'id': 4128, 'tags': ['黃仁勳', 'NVIDIA', '輝達', '庫克'], 'lastTime': arts[0]['publishedAt']}},
]
feed = {'days': 7, 'follows': follows, 'events': [], 'articles': [
    {**pick(a), 'tags': a['tags'][:4], 'matched': [follows[0]]} for a in arts[:6]]}
sug = lambda kind, target, because, label=None: {'kind': kind, 'target': target, 'label': label or target, 'because': because}
suggestions = {
    'starter': {'events': [{'id': 4128, 'title': '黃仁勳辭去輝達執行長', 'tags': ['黃仁勳', 'NVIDIA', '輝達']}],
                'tags': [sug('tag', '輝達', '本週熱門')], 'media': [sug('media', 'cna', '收錄最多', '中央社')]},
    'related': [sug('tag', 'NVIDIA', '常和「黃仁勳」一起出現'), sug('tag', '庫克', '常和「黃仁勳」一起出現')],
    'reading': None,
}
reader = {
    'user': {'id': 1, 'email': 'reader@example.com', 'name': '林小美', 'picture': None, 'role': 'reader'},
    'follows': {'follows': follows}, 'saves': {'saves': saves}, 'prefs': {'prefs': {'history': False}},
    'feed': feed, 'suggestions': suggestions,
}
(snap / 'reader.json').write_text(json.dumps(reader, ensure_ascii=False, indent=1))
print('reader.json', len(saves), 'saves', len(follows), 'follows')
