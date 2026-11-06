import os, tempfile
os.environ['GA_DB_PATH']=tempfile.mktemp(suffix='.sqlite3')
os.environ['GA_SECURE_COOKIES']='0'
from fastapi.testclient import TestClient
from server import app
c=TestClient(app,base_url='http://testserver')
assert c.get('/api/setup').json()['needs_setup']
assert c.post('/api/setup',json={'email':'admin@example.org','password':'strong-password-123'}).status_code==200
assert c.get('/api/me').json()['role']=='admin'
assert c.post('/api/users',json={'email':'editor@example.org','password':'another-password-123','role':'editor'}).status_code==200
assert c.get('/api/users').status_code==200
assert c.get('/api/state').json()['revision']==0
assert c.put('/api/state',json={'revision':0,'data':{'coFllGaDb':'{"events":[]}'}}).status_code==200
assert c.put('/api/state',json={'revision':0,'data':{}}).status_code==409
assert c.get('/api/state').json()['revision']==1
assert c.post('/api/logout').status_code==200
assert c.get('/api/state').status_code==401
assert c.post('/api/login',json={'email':'editor@example.org','password':'another-password-123'}).status_code==200
assert c.get('/api/me').json()['role']=='editor'
assert c.get('/api/users').status_code==403
assert c.put('/api/state',json={'revision':1,'data':{'hello':'world'}}).status_code==200
print('All API tests passed')
