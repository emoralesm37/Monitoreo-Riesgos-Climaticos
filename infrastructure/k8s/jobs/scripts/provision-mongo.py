import os
from pymongo import MongoClient

try:
    root = MongoClient(host='mongodb', port=27017, username=os.environ['ROOT_USER'],
                       password=os.environ['ROOT_PASSWORD'], authSource='admin', serverSelectionTimeoutMS=5000)
    for db_name, prefix in [('ClimateGuardReports', 'REPORT'), ('ClimateGuardAudit', 'AUDIT')]:
        username, password = os.environ[prefix + '_USER'], os.environ[prefix + '_PASSWORD']
        database = root[db_name]
        found = database.command('usersInfo', username)['users']
        if not found:
            database.command('createUser', username, pwd=password, roles=[{'role': 'readWrite', 'db': db_name}])
        elif {'role': 'readWrite', 'db': db_name} not in found[0]['roles']:
            raise RuntimeError('Privileges require review')
        check = MongoClient(host='mongodb', port=27017, username=username, password=password,
                            authSource=db_name, serverSelectionTimeoutMS=5000)
        check[db_name].command('ping')
        check.close()
    root.close()
    print('Application users provisioned/verified. Existing users were not altered.')
except Exception:
    raise SystemExit('Mongo bootstrap failed; review privately. No existing credentials were changed.') from None
