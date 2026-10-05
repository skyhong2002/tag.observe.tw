#!/usr/bin/env python3
"""Manually publish aggregate GA4/GSC data. Credentials stay outside the release."""
import json
import math
import os
import re
import tempfile
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote, unquote
from zoneinfo import ZoneInfo

MIN_VIEWS = 10
MIN_USERS = 3
ORIGIN = 'https://tag.observe.tw'


def period(days, zone, now):
    end = now.astimezone(ZoneInfo(zone)).date() - timedelta(days=1)
    return {'start': str(end - timedelta(days=days - 1)), 'end': str(end)}


def content_path(value):
    if not isinstance(value, str) or re.search(r'[?#\\\x00-\x20]', value):
        return None
    if re.fullmatch(r'/eve/[1-9][0-9]*/', value):
        return value
    if value.startswith('/tag/') and value.endswith('/'):
        tag = unquote(value[5:-1])
        if tag and len(tag) <= 100 and not re.search(r'[/\\?#\x00-\x20]', tag) and tag not in ('.', '..'):
            return '/tag/' + quote(tag, safe='') + '/'
    return None


def count(value):
    n = float(value)
    if not math.isfinite(n) or n < 0 or not n.is_integer():
        raise ValueError('Invalid aggregate count')
    return int(n)


def candidates(report):
    # Views add across URL encodings. max(users) is a conservative lower bound,
    # never a sum of users who might overlap between two encodings.
    grouped = {}
    for row in report.get('rows', []):
        path = content_path(row['dimensionValues'][0]['value'])
        if not path:
            continue
        views, users = (count(v['value']) for v in row['metricValues'])
        prev = grouped.setdefault(path, {'path': path, 'views': 0, 'users': 0})
        prev['views'] += views
        prev['users'] = max(prev['users'], users)
    return sorted((r for r in grouped.values() if r['views'] >= MIN_VIEWS and r['users'] >= MIN_USERS),
                  key=lambda r: (-r['views'], r['path']))[:20]


class PageMeta(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ''
        self.canonical = ''
        self.noindex = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'meta':
            if a.get('property') == 'og:title':
                self.title = a.get('content', '')
            if a.get('name') == 'robots' and 'noindex' in a.get('content', '').lower():
                self.noindex = True
        if tag == 'link' and a.get('rel') == 'canonical':
            self.canonical = a.get('href', '')


def publish(path, snapshot):
    path.parent.mkdir(parents=True, exist_ok=True)
    name = None
    try:
        with tempfile.NamedTemporaryFile('w', dir=path.parent, delete=False, encoding='utf-8') as f:
            name = f.name
            json.dump(snapshot, f, ensure_ascii=False, allow_nan=False)
            f.write('\n')
            f.flush()
            os.fsync(f.fileno())
        os.replace(name, path)
    finally:
        if name and os.path.exists(name):
            os.unlink(name)


def refresh(session, public_session, now):
    ga_period = period(7, 'Asia/Taipei', now)
    search_period = period(28, 'America/Los_Angeles', now)
    prop = os.environ['GA4_PROPERTY_ID']
    site = os.environ['GSC_SITE_URL']
    if not prop.isdigit() or site != ORIGIN + '/':
        raise ValueError('Unexpected property/site configuration')
    ga_url = f'https://analyticsdata.googleapis.com/v1beta/properties/{prop}'

    def api(method, url, **kwargs):
        res = session.request(method, url, timeout=45, **kwargs)
        print(f'{method} {url.split("?")[0]} HTTP {res.status_code}', flush=True)
        if res.status_code != 200:
            raise RuntimeError(f'Google API HTTP {res.status_code}; previous snapshot retained')
        return res.json()

    def ga(dimensions, metrics, filters=None):
        body = {'dateRanges': [{'startDate': ga_period['start'], 'endDate': ga_period['end']}],
                'dimensions': [{'name': x} for x in dimensions], 'metrics': [{'name': x} for x in metrics],
                'limit': 10000,
                'dimensionFilter': {'filter': {'fieldName': 'hostName', 'stringFilter': {'matchType': 'EXACT', 'value': 'tag.observe.tw'}}}}
        if filters:
            body['dimensionFilter'] = {'andGroup': {'expressions': [body['dimensionFilter'], filters]}}
        result = api('POST', ga_url + ':runReport', json=body)
        if result.get('rowCount', 0) > 10000 or result.get('metadata', {}).get('dataLossFromOtherRow') or result.get('metadata', {}).get('samplingMetadatas'):
            raise RuntimeError('Incomplete GA report; previous snapshot retained')
        return result

    total = ga([], ['screenPageViews', 'sessions'])
    rows = total.get('rows', [])
    totals = {'views': count(rows[0]['metricValues'][0]['value']), 'sessions': count(rows[0]['metricValues'][1]['value'])} if rows else None
    pages = ga(['pagePath'], ['screenPageViews', 'activeUsers'])
    ranked = []
    for row in candidates(pages):
        # This session has NO Google authorization headers. Never send credentials to the site.
        response = public_session.get(ORIGIN + row['path'], timeout=30, allow_redirects=False)
        if response.status_code >= 500 or response.status_code == 429:
            raise RuntimeError('Content lookup unavailable; previous snapshot retained')
        if response.status_code != 200:
            continue
        meta = PageMeta()
        meta.feed(response.text)
        if meta.noindex or meta.canonical != ORIGIN + row['path'] or not meta.title.strip():
            continue
        ranked.append({'path': row['path'], 'title': meta.title.removesuffix(' · 新文易數')[:180], 'views': row['views']})

    metadata = api('GET', ga_url + '/metadata')
    names = {x['apiName'] for x in metadata.get('dimensions', [])}
    vital_rows = []
    vital_status = 'definitions_missing'
    if {'customEvent:metric_name', 'customEvent:metric_rating'} <= names:
        report = ga(['customEvent:metric_name', 'customEvent:metric_rating'], ['eventCount'],
                    {'filter': {'fieldName': 'eventName', 'stringFilter': {'matchType': 'EXACT', 'value': 'web_vital'}}})
        buckets = {}
        for row in report.get('rows', []):
            name, rating = (d['value'] for d in row['dimensionValues'])
            if name in ('LCP', 'INP', 'CLS') and rating in ('good', 'needs-improvement', 'poor'):
                buckets.setdefault(name, {})[rating] = count(row['metricValues'][0]['value'])
        for name, ratings in buckets.items():
            samples = sum(ratings.values())
            if samples >= 30:
                vital_rows.append({'name': name, 'samples': samples, 'goodPercent': round(ratings.get('good', 0) / samples * 100, 1)})
        vital_status = 'ready' if vital_rows else 'insufficient'

    sites = api('GET', 'https://www.googleapis.com/webmasters/v3/sites')
    if not any(s.get('siteUrl') == site for s in sites.get('siteEntry', [])):
        raise RuntimeError('Expected GSC property missing; previous snapshot retained')
    gsc_url = 'https://www.googleapis.com/webmasters/v3/sites/' + quote(site, safe='') + '/searchAnalytics/query'
    base = {'startDate': search_period['start'], 'endDate': search_period['end'], 'type': 'web', 'dataState': 'final'}
    total_search = api('POST', gsc_url, json=base).get('rows', [])
    daily = api('POST', gsc_url, json={**base, 'dimensions': ['date'], 'rowLimit': 100}).get('rows', [])
    def search_counts(row):
        return {'clicks': count(row['clicks']), 'impressions': count(row['impressions'])}
    return {'version': 1, 'updatedAt': now.isoformat(),
            'content': {'period': ga_period, 'totals': totals, 'ranking': ranked},
            'search': {'period': search_period, 'totals': search_counts(total_search[0]) if total_search else None,
                       'daily': [{'date': r['keys'][0], **search_counts(r)} for r in daily]},
            'experience': {'status': vital_status, 'metrics': vital_rows}}


def main():
    from google.oauth2 import service_account
    from google.auth.transport.requests import AuthorizedSession
    import requests
    credentials = service_account.Credentials.from_service_account_file(
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'], scopes=[
            'https://www.googleapis.com/auth/analytics.readonly', 'https://www.googleapis.com/auth/webmasters.readonly'])
    destination = Path(os.environ.get('TAG_ANALYTICS_SNAPSHOT', str(Path.home() / '.local/share/tag-analysis/analytics/public.json')))
    try:
        with AuthorizedSession(credentials) as session, requests.Session() as public_session:
            snapshot = refresh(session, public_session, datetime.now(timezone.utc))
        publish(destination, snapshot)
        print(f'Published {destination}; {len(snapshot["content"]["ranking"])} eligible pages')
    except Exception as error:
        # Do not print exception bodies: upstream/auth errors can carry sensitive material.
        print(f'Refresh failed ({type(error).__name__}); previous snapshot retained')
        raise SystemExit(1) from None


if __name__ == '__main__':
    main()
