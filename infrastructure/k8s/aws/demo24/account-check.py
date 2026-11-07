"""Run in authenticated AWS CloudShell. READ-ONLY; no credentials are printed.

python3 account-check.py [--instance-id i-...]
Writes account-check.json privately and prints a limited review summary.
"""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import re
import socket
import subprocess

REGION = 'us-east-2'


def query(service, action, *args, region=REGION):
    command = ['aws', service, action, '--region', region, '--output', 'json', '--no-cli-pager', *args]
    try:
        call = subprocess.run(command, capture_output=True, text=True, timeout=90)
        if call.returncode:
            match = re.search(r'\(([^)]+)\)', call.stderr)
            return {'unverified': True, 'error': match[1] if match else 'CLI_OR_PERMISSION_ERROR'}
        return json.loads(call.stdout)
    except (OSError, ValueError, subprocess.TimeoutExpired):
        return {'unverified': True, 'error': 'TOOL_UNAVAILABLE_OR_TIMEOUT'}


def prices(service, filters):
    raw = query('pricing', 'get-products', '--service-code', service,
        '--filters', json.dumps([{'Type':'TERM_MATCH','Field':k,'Value':v} for k,v in filters.items()]), region='us-east-1')
    if raw.get('unverified'):
        return raw
    values=[]
    for product in raw.get('PriceList', []):
        item=json.loads(product) if isinstance(product,str) else product
        for term in item.get('terms',{}).get('OnDemand',{}).values():
            for dimension in term.get('priceDimensions',{}).values():
                values.append({'sku':item['product']['sku'], 'attributes':item['product'].get('attributes',{}),
                    'unit':dimension['unit'], 'usd':dimension['pricePerUnit'].get('USD'),
                    'description':dimension.get('description'), 'effectiveDate':term.get('effectiveDate')})
    return values or {'unverified':True,'error':'NO_MATCHING_PRICE'}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--instance-id', default='i-REPLACE_INSTANCE_ID')
    parser.add_argument('--output', default='account-check.json')
    args=parser.parse_args()
    if args.instance_id and not re.fullmatch(r'i-[0-9a-f]{8,17}',args.instance_id):
        parser.error('Invalid instance ID')
    output=Path(args.output)
    if output.exists():
        parser.error('Choose a new output path; existing evidence is never overwritten')
    report={'measuredAt':dt.datetime.now(dt.timezone.utc).isoformat(),'region':REGION,'mutations':0}
    identity=query('sts','get-caller-identity')
    report['authenticated']=not identity.get('unverified',False)
    # Do not persist a session ARN or access keys; the account ID is used only for inventory.
    if not report['authenticated']:
        print(json.dumps({'blocked':'No authenticated AWS session','detail':identity}))
        return 2
    report['accountId']=identity.get('Account')
    report['plan']=query('freetier','get-account-plan-state',region='us-east-1')
    report['freeTierUsage']=query('freetier','get-free-tier-usage',region='us-east-1')
    try:
        report['dnsIPv4']=socket.gethostbyname('climateguard.garher.lat')
    except OSError:
        report['dnsIPv4']=None
    inventory=query('ec2','describe-instances')
    instances=[]
    for reservation in inventory.get('Reservations',[]):
        for item in reservation['Instances']:
            instances.append({key:item.get(key) for key in ['InstanceId','InstanceType','Architecture','State',
                'PublicIpAddress','PrivateIpAddress','RootDeviceName','RootDeviceType','Placement','CpuOptions','BlockDeviceMappings']})
    report['instances']=instances if not inventory.get('unverified') else inventory
    candidates=[i for i in instances if (i['InstanceId']==args.instance_id if args.instance_id else i['PublicIpAddress']==report['dnsIPv4'])]
    target=candidates[0] if len(candidates)==1 else None
    report['target']=target
    report['quota']=query('service-quotas','get-service-quota','--service-code','ec2','--quota-code','L-1216C47A')
    report['type']=query('ec2','describe-instance-types','--instance-types','m7i-flex.large')
    report['offering']=query('ec2','describe-instance-type-offerings','--location-type','region','--filters',
        'Name=instance-type,Values=m7i-flex.large','Name=location,Values=us-east-2')
    # An offering is NOT proof of free-plan eligibility, IAM permission or physical capacity.
    if target:
        instance=target['InstanceId']
        report['shutdownBehavior']=query('ec2','describe-instance-attribute','--instance-id',instance,'--attribute','instanceInitiatedShutdownBehavior')
        report['stopProtection']=query('ec2','describe-instance-attribute','--instance-id',instance,'--attribute','disableApiStop')
        report['ssm']=query('ssm','describe-instance-information','--filters',f'Key=InstanceIds,Values={instance}',
            '--query','InstanceInformationList[].{Id:InstanceId,Ping:PingStatus,Platform:PlatformName}')
        report['volumes']=query('ec2','describe-volumes','--filters',f'Name=attachment.instance-id,Values={instance}')
        report['addresses']=query('ec2','describe-addresses','--filters',f'Name=instance-id,Values={instance}',
            '--query','Addresses[].{PublicIp:PublicIp,AllocationId:AllocationId,AssociationId:AssociationId,InstanceId:InstanceId}')
        volume_ids=[i['Ebs']['VolumeId'] for i in target.get('BlockDeviceMappings',[]) if 'Ebs' in i]
        report['snapshots']=query('ec2','describe-snapshots','--owner-ids','self','--filters',
            'Name=volume-id,Values='+','.join(volume_ids),
            '--query','Snapshots[].{Id:SnapshotId,Volume:VolumeId,State:State,Progress:Progress,Started:StartTime,GiB:VolumeSize,Encrypted:Encrypted}') if volume_ids else []
    report['prices']={
        'm7i-flex.large':prices('AmazonEC2',{'instanceType':'m7i-flex.large','location':'US East (Ohio)',
            'operatingSystem':'Linux','tenancy':'Shared','preInstalledSw':'NA','capacitystatus':'Used'}),
        'gp3':prices('AmazonEC2',{'regionCode':REGION,'volumeApiName':'gp3','productFamily':'Storage'}),
        'gp2':prices('AmazonEC2',{'regionCode':REGION,'volumeApiName':'gp2','productFamily':'Storage'}),
        'snapshot':prices('AmazonEC2',{'regionCode':REGION,'usagetype':'USE2-EBS:SnapshotUsage'}),
        'ipv4':prices('AmazonVPC',{'regionCode':REGION,'usagetype':'USE2-PublicIPv4:InUseAddress'})}
    report['warnings']=['Remaining promotional credit must be confirmed in Billing if plan API is unavailable.',
        'FREE plan/type eligibility is not proven by describe-instance-types or type offerings.',
        'Snapshots listed here are not proof of a successful restore or database consistency.',
        'Account quotas and listed offerings do not guarantee available capacity.',
        'No plan upgrade, snapshot creation, stop/start, resize, volume or schedule creation was performed.']
    os.umask(0o077)
    with output.open('x',encoding='utf-8') as stream:
        json.dump(report,stream,indent=2)
    print(json.dumps({'report':str(output),'region':REGION,'authenticated':True,'target':target['InstanceId'] if target else 'NOT_UNIQUELY_IDENTIFIED',
        'plan':report['plan'],'quota':report['quota'],'prices':report['prices'],'mutations':0},indent=2))
    return 0 if target else 2


if __name__=='__main__':
    raise SystemExit(main())
