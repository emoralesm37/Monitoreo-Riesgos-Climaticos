"""OFFLINE: generate reviewable AWS Scheduler + systemd stop plans, never install.

Requires actual read-only account-check evidence; refuses unknown shutdown behavior.
"""
import argparse
import datetime as dt
import json
from pathlib import Path
import re


def generate(report, output, now=None):
    now=now or dt.datetime.now(dt.timezone.utc)
    target=report.get('target') or {}
    instance=target.get('InstanceId','')
    account=report.get('accountId','')
    if not re.fullmatch(r'i-[0-9a-f]{8,17}',instance) or not re.fullmatch(r'[0-9]{12}',account):
        raise ValueError('Actual instance/account identification is required')
    if report.get('region')!='us-east-2' or target.get('RootDeviceType')!='ebs':
        raise ValueError('Only the identified Ohio EBS-backed instance is allowed')
    behavior=report.get('shutdownBehavior',{}).get('InstanceInitiatedShutdownBehavior',{}).get('Value')
    if behavior!='stop':
        raise ValueError('Verified shutdown behavior STOP is required; do not risk termination')
    if report.get('stopProtection',{}).get('DisableApiStop',{}).get('Value') is not False:
        raise ValueError('Stop protection state must be verified disabled first')
    if output.exists():
        raise ValueError('Use a NEW plan directory; never silently extend an existing deadline')
    output.mkdir(parents=True,mode=0o700)
    deadline=(now+dt.timedelta(hours=24)).replace(microsecond=0)
    name='cg-demo-stop-'+instance
    instance_arn=f'arn:aws:ec2:us-east-2:{account}:instance/{instance}'
    role='cg-demo-stop-'+instance
    trust={'Version':'2012-10-17','Statement':[{'Effect':'Allow',
        'Principal':{'Service':'scheduler.amazonaws.com'},'Action':'sts:AssumeRole',
        'Condition':{'StringEquals':{'aws:SourceAccount':account},
            'ArnEquals':{'aws:SourceArn':f'arn:aws:scheduler:us-east-2:{account}:schedule-group/default'}}}]}
    policy={'Version':'2012-10-17','Statement':[{'Effect':'Allow','Action':'ec2:StopInstances','Resource':instance_arn}]}
    schedule={'Name':name,'GroupName':'default','ScheduleExpression':'at('+deadline.strftime('%Y-%m-%dT%H:%M:%S')+')',
        'ScheduleExpressionTimezone':'UTC','FlexibleTimeWindow':{'Mode':'OFF'},'State':'ENABLED',
        'ActionAfterCompletion':'NONE', 'Target':{'Arn':'arn:aws:scheduler:::aws-sdk:ec2:stopInstances',
            'RoleArn':f'arn:aws:iam::{account}:role/{role}', 'Input':json.dumps({'InstanceIds':[instance]}),
            'RetryPolicy':{'MaximumEventAgeInSeconds':3600,'MaximumRetryAttempts':3}}}
    for filename,value in [('trust.json',trust),('stop-policy.json',policy),('schedule.json',schedule)]:
        (output/filename).write_text(json.dumps(value,indent=2),encoding='utf-8')
    service='''[Unit]
Description=ClimateGuard approved 24-hour demo shutdown (EC2 behavior must be stop)
ConditionPathExists=/etc/climateguard-demo-stop/stop-behavior-verified
[Service]
Type=oneshot
ExecStart=/usr/bin/systemctl poweroff
'''
    timer=f'''[Unit]
Description=ClimateGuard absolute 24-hour shutdown deadline
[Timer]
OnCalendar={deadline.strftime('%Y-%m-%d %H:%M:%S')} UTC
Persistent=true
AccuracySec=1s
RandomizedDelaySec=0
Unit=climateguard-demo-stop.service
[Install]
WantedBy=timers.target
'''
    (output/'climateguard-demo-stop.service').write_text(service,encoding='utf-8')
    (output/'climateguard-demo-stop.timer').write_text(timer,encoding='utf-8')
    summary={'installed':False,'schedule':name,'role':role,'instanceId':instance,'region':'us-east-2',
        'createdAtUtc':now.isoformat(),'deadlineUtc':deadline.isoformat(),
        'deadlineGuatemala':(deadline-dt.timedelta(hours=6)).strftime('%Y-%m-%d %H:%M:%S UTC-06'),
        'hours':24,'dataDeletion':False,'awsChangesExecuted':0,
        'gates':['User approval of exact instance/cost/schedule/IAM role',
            'Read back Scheduler state, deadline, target and policy after creation',
            'Verify systemd timer on actual EC2; benign dispatch proof is not proof of EC2 stopped',
            'Verify instance stopped and CloudTrail event after deadline',
            'EBS, snapshots and IPv4 may continue billing after stop']}
    (output/'summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
    return summary


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--account-report',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    print(json.dumps(generate(json.loads(args.account_report.read_text(encoding='utf-8')),args.output),indent=2))
