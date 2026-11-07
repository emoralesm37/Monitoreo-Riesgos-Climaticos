import copy
import datetime as dt
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parent
def load(name,file):
    spec=importlib.util.spec_from_file_location(name,ROOT/file)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
shutdown=load('shutdown_plan','shutdown-plan.py')
account=load('account_check','account-check.py')

class ShutdownSafetyTests(unittest.TestCase):
    def report(self):
        return {'accountId':'000000000000','region':'us-east-2',
            'target':{'InstanceId':'i-1234567890abcdef0','RootDeviceType':'ebs'},
            'shutdownBehavior':{'InstanceInitiatedShutdownBehavior':{'Value':'stop'}},
            'stopProtection':{'DisableApiStop':{'Value':False}}}
    def test_stop_permission_is_one_instance_and_no_delete(self):
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp)/'new'
            result=shutdown.generate(self.report(),out,dt.datetime(2026,11,6,18,tzinfo=dt.timezone.utc))
            policy=json.loads((out/'stop-policy.json').read_text())
            self.assertEqual(policy['Statement'][0]['Action'],'ec2:StopInstances')
            self.assertTrue(policy['Statement'][0]['Resource'].endswith('instance/i-1234567890abcdef0'))
            target=json.loads((out/'schedule.json').read_text())['Target']
            self.assertEqual(json.loads(target['Input']),{'InstanceIds':['i-1234567890abcdef0']})
            self.assertFalse(result['installed'])
            self.assertEqual(result['deadlineUtc'],'2026-11-07T18:00:00+00:00')
            self.assertIn('Persistent=true',(out/'climateguard-demo-stop.timer').read_text())
    def test_terminate_or_unknown_shutdown_behavior_refused(self):
        for behavior in ['terminate',None]:
            report=self.report()
            report['shutdownBehavior']['InstanceInitiatedShutdownBehavior']['Value']=behavior
            with tempfile.TemporaryDirectory() as tmp, self.assertRaises(ValueError):
                shutdown.generate(report,Path(tmp)/'new')
    def test_stop_protection_must_be_known_disabled(self):
        for protection in [True,None]:
            report=self.report()
            report['stopProtection']['DisableApiStop']['Value']=protection
            with tempfile.TemporaryDirectory() as tmp, self.assertRaises(ValueError):
                shutdown.generate(report,Path(tmp)/'new')
    def test_never_overwrite_deadline(self):
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp)/'new'
            shutdown.generate(self.report(),out)
            with self.assertRaises(ValueError):
                shutdown.generate(self.report(),out)
    def test_wrong_region_or_instance_store_refused(self):
        for key,value in [('region','us-east-1'),('root','instance-store')]:
            report=self.report()
            if key=='root': report['target']['RootDeviceType']=value
            else: report[key]=value
            with tempfile.TemporaryDirectory() as tmp, self.assertRaises(ValueError):
                shutdown.generate(report,Path(tmp)/'new')

class PriceEvidenceTests(unittest.TestCase):
    def test_access_denial_is_not_a_zero_price(self):
        denied={'unverified':True,'error':'AccessDeniedException'}
        with patch.object(account,'query',return_value=denied):
            self.assertEqual(account.prices('AmazonEC2',{}),denied)
    def test_empty_price_result_is_not_free(self):
        with patch.object(account,'query',return_value={'PriceList':[]}):
            self.assertTrue(account.prices('AmazonEC2',{})['unverified'])
    def test_official_price_unit_and_effective_date_preserved(self):
        product={'product':{'sku':'synthetic','attributes':{'regionCode':'us-east-2'}},
            'terms':{'OnDemand':{'term':{'effectiveDate':'2026-11-01',
                'priceDimensions':{'price':{'unit':'Hrs','pricePerUnit':{'USD':'0.1504'}}}}}}}
        with patch.object(account,'query',return_value={'PriceList':[json.dumps(product)]}):
            result=account.prices('AmazonEC2',{})
            self.assertEqual(result[0]['usd'],'0.1504')
            self.assertEqual(result[0]['effectiveDate'],'2026-11-01')

class DemoCapacitySafetyTests(unittest.TestCase):
    def test_cpu_leaves_room_for_control_plane_and_system_pods(self):
        summary=json.loads((ROOT/'candidate/demo-summary.json').read_text())
        self.assertLessEqual(summary['requestedCpuMillicores'],1200)
        self.assertLessEqual(summary['limitsMemoryMiB'],6*1024)
    def test_stateful_application_owners_never_scale(self):
        summary=json.loads((ROOT/'candidate/demo-summary.json').read_text())
        for name in ['gateway','auth-service','report-service','sqlserver','mongodb','auth-db','alert-db']:
            self.assertEqual(summary['resourceBudgets'][name]['replicas'],1)
    def test_sql_minimum_memory_is_not_cut_to_fake_fit(self):
        summary=json.loads((ROOT/'candidate/demo-summary.json').read_text())
        sql=summary['resourceBudgets']['sqlserver']['resources']
        self.assertGreaterEqual(int(sql['requests']['memory'][:-2]),2048)
        self.assertGreaterEqual(int(sql['limits']['memory'][:-2]),2048)

if __name__=='__main__': unittest.main()
