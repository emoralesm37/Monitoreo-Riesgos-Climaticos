import json
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import Mock

from bridge import Client, Queue, envelopes


def config():
    return {'baseUrl': 'https://climateguard.garher.lat/api', 'email': 'test@example.invalid',
        'password': 'not-a-real-password', 'channels': {
            'temperature_c': {'sensorId': 1, 'deviceId': 'test-temp', 'unit': 'C'},
            'humidity_pct': {'sensorId': 2, 'deviceId': 'test-hum', 'unit': '%'},
            'water_level_m': {'sensorId': 3, 'deviceId': 'test-water', 'unit': 'm'}}}


class BridgeTests(unittest.TestCase):
    def test_nulls_are_skipped_and_uncalibrated_level_is_not_sent(self):
        rows = envelopes({'schema': 'climateguard.uno.v1', 'temperature_c': 26,
            'humidity_pct': None, 'water_level_m': 0.2, 'water_calibrated': False}, config())
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0][1]['unit'], 'C')

    def test_invalid_or_infinite_values_are_rejected(self):
        for value in [float('nan'), float('inf'), True, '26', -1, 60]:
            with self.assertRaises(ValueError):
                envelopes({'schema': 'climateguard.uno.v1', 'temperature_c': value}, config())

    def test_calibrated_level_uses_meters_and_new_uuid_per_capture(self):
        frame = {'schema': 'climateguard.uno.v1', 'water_level_m': 0.23, 'water_calibrated': True}
        a, b = envelopes(frame, config()), envelopes(frame, config())
        self.assertEqual(a[0][1]['value'], 0.23)
        self.assertEqual(a[0][1]['unit'], 'm')
        self.assertNotEqual(a[0][1]['measurementId'], b[0][1]['measurementId'])

    def test_outbox_survives_restart_and_retry_content_is_identical(self):
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / 'queue.sqlite3'
            q = Queue(file)
            q.save(envelopes({'schema': 'climateguard.uno.v1', 'temperature_c': 26}, config()))
            original = q.db.execute('SELECT body FROM pending').fetchone()[0]
            client = Mock()
            client.call.side_effect = OSError('offline')
            q.flush(client)
            q.db.close()
            q = Queue(file)
            client.call.side_effect = None
            client.call.return_value = (200, {'sensorReadingId': 99, 'duplicate': True})
            self.assertEqual(q.flush(client), 1)
            self.assertEqual(client.call.call_args.args[1], json.loads(original))
            self.assertEqual(q.db.execute('SELECT status FROM pending').fetchone()[0], 'sent')
            q.db.close()

    def test_conflict_is_retained_without_changing_measurement(self):
        q = Queue(':memory:')
        q.save(envelopes({'schema': 'climateguard.uno.v1', 'temperature_c': 26}, config()))
        client = Mock()
        client.call.side_effect = urllib.error.HTTPError('https://example.invalid', 409, '', {}, None)
        q.flush(client)
        self.assertEqual(q.db.execute('SELECT status,http FROM pending').fetchone(), ('rejected', 409))
        q.db.close()

    def test_refresh_rotates_both_tokens(self):
        c = Client(config())
        c.refresh = 'old-test-refresh'
        c.request = Mock(return_value=(200, {'accessToken': 'new-test-access', 'refreshToken': 'new-test-refresh'}))
        c.authenticate()
        self.assertEqual(c.refresh, 'new-test-refresh')
        c.request.assert_called_once_with('/auth/refresh', {'refreshToken': 'old-test-refresh'})


if __name__ == '__main__':
    unittest.main()
