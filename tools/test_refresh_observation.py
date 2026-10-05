import importlib.util
import json
import os
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('observation', Path(__file__).with_name('refresh-observation.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def row(path, views, users):
    return {'dimensionValues': [{'value': path}], 'metricValues': [{'value': str(views)}, {'value': str(users)}]}


class Response:
    status_code = 200
    def __init__(self, data):
        self.data = data
    def json(self):
        return self.data


class Session:
    def __init__(self):
        self.calls = []
    def request(self, method, url, **kwargs):
        self.calls.append((url, kwargs))
        if url.endswith('/sites'):
            return Response({'siteEntry': [{'siteUrl': m.ORIGIN + '/'}]})
        return Response({})


class ObservationTest(unittest.TestCase):
    def test_exact_complete_days_in_each_timezone(self):
        now = datetime(2026, 10, 5, 1, tzinfo=timezone.utc)
        self.assertEqual(m.period(7, 'Asia/Taipei', now), {'start': '2026-09-28', 'end': '2026-10-04'})
        self.assertEqual(m.period(28, 'America/Los_Angeles', now), {'start': '2026-09-06', 'end': '2026-10-03'})

    def test_only_safe_public_content_paths(self):
        for value in ['/search/?q=private', '//evil.test/', '/tag/%2fadmin/', '/tag/../', '/tag/%0aname/', '/eve/1/?email=a', '/tag/%5cabc/', '/eve/0/']:
            self.assertIsNone(m.content_path(value), value)
        self.assertEqual(m.content_path('/tag/台灣/'), '/tag/%E5%8F%B0%E7%81%A3/')

    def test_views_add_but_overlapping_users_do_not(self):
        rows = [row('/tag/台灣/', 6, 2), row('/tag/%E5%8F%B0%E7%81%A3/', 6, 2), row('/eve/1/', 10, 3), row('/eve/2/', 99, 1), row('/search/', 500, 20)]
        self.assertEqual(m.candidates({'rows': rows}), [{'path': '/eve/1/', 'views': 10, 'users': 3}])
        rows[0] = row('/tag/台灣/', 6, 3)
        self.assertEqual(m.candidates({'rows': rows})[0]['views'], 12)

    def test_atomic_publish_retains_previous_on_serialization_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'public.json'
            m.publish(path, {'version': 1})
            with self.assertRaises(ValueError):
                m.publish(path, {'bad': float('nan')})
            self.assertEqual(json.loads(path.read_text()), {'version': 1})
            self.assertEqual(len(list(Path(directory).iterdir())), 1)

    @patch.dict(os.environ, {'GA4_PROPERTY_ID': '557297184', 'GSC_SITE_URL': m.ORIGIN + '/'})
    def test_successful_empty_reports_are_missing_not_zero(self):
        s = Session()
        result = m.refresh(s, None, datetime(2026, 10, 5, tzinfo=timezone.utc))
        self.assertIsNone(result['content']['totals'])
        self.assertIsNone(result['search']['totals'])
        self.assertEqual(result['experience']['status'], 'definitions_missing')
        body = s.calls[0][1]['json']
        self.assertEqual(body['dimensionFilter']['filter']['fieldName'], 'hostName')
        self.assertEqual(body['dateRanges'][0]['endDate'], '2026-10-04')

    @patch.dict(os.environ, {'GA4_PROPERTY_ID': '557297184', 'GSC_SITE_URL': m.ORIGIN + '/'})
    def test_partial_google_failure_never_reaches_publication(self):
        s = Session()
        original = s.request
        def fail(method, url, **kwargs):
            response = original(method, url, **kwargs)
            if url.endswith('/searchAnalytics/query'):
                response.status_code = 403
            return response
        s.request = fail
        with self.assertRaisesRegex(RuntimeError, 'HTTP 403'):
            m.refresh(s, None, datetime(2026, 10, 5, tzinfo=timezone.utc))

    @patch.dict(os.environ, {'GA4_PROPERTY_ID': '557297184', 'GSC_SITE_URL': m.ORIGIN + '/'})
    def test_truncated_ga_report_is_not_published_as_complete(self):
        class Truncated(Session):
            def request(self, *args, **kwargs):
                return Response({'rowCount': 10001})
        with self.assertRaisesRegex(RuntimeError, 'Incomplete GA'):
            m.refresh(Truncated(), None, datetime(2026, 10, 5, tzinfo=timezone.utc))

    @patch.dict(os.environ, {'GA4_PROPERTY_ID': '557297184', 'GSC_SITE_URL': m.ORIGIN + '/'})
    def test_eligible_content_and_vitals_publish_only_curated_fields(self):
        class Populated(Session):
            def request(self, method, url, **kwargs):
                body = kwargs.get('json', {})
                dims = body.get('dimensions')
                if url.endswith('/metadata'):
                    return Response({'dimensions': [{'apiName': 'customEvent:metric_name'}, {'apiName': 'customEvent:metric_rating'}]})
                if dims == [{'name': 'pagePath'}]:
                    return Response({'rows': [row('/eve/1/', 25, 4)]})
                if dims == [{'name': 'customEvent:metric_name'}, {'name': 'customEvent:metric_rating'}]:
                    return Response({'rows': [
                        {'dimensionValues': [{'value': 'LCP'}, {'value': 'good'}], 'metricValues': [{'value': '40'}]},
                        {'dimensionValues': [{'value': 'LCP'}, {'value': 'poor'}], 'metricValues': [{'value': '10'}]},
                        {'dimensionValues': [{'value': 'INP'}, {'value': 'good'}], 'metricValues': [{'value': '2'}]},
                    ]})
                return super().request(method, url, **kwargs)
        class Public:
            def get(self, url, **kwargs):
                response = Response({})
                response.text = '<meta property="og:title" content="事件 · 新文易數"><link rel="canonical" href="https://tag.observe.tw/eve/1/">'
                return response
        result = m.refresh(Populated(), Public(), datetime(2026, 10, 5, tzinfo=timezone.utc))
        self.assertEqual(result['content']['ranking'], [{'path': '/eve/1/', 'title': '事件', 'views': 25}])
        self.assertEqual(result['experience'], {'status': 'ready', 'metrics': [{'name': 'LCP', 'samples': 50, 'goodPercent': 80.0}]})


if __name__ == '__main__':
    unittest.main()
