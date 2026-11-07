"""Colorado FLL GA - multi-user web server. SQLite-backed shared workspace."""
import hashlib, json, os, secrets, sqlite3, time
from contextlib import contextmanager
from pathlib import Path
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

ROOT=Path(__file__).resolve().parent
DB=Path(os.environ.get('GA_DB_PATH',str(ROOT/'data'/'ga.sqlite3')))
COOKIE_SECURE=os.environ.get('GA_SECURE_COOKIES','1')!='0'
SESSION_DAYS=7
ph=PasswordHasher()
app=FastAPI(title='Colorado FLL GA')

@contextmanager
def connection():
 DB.parent.mkdir(parents=True,exist_ok=True)
 con=sqlite3.connect(DB,timeout=20)
 con.row_factory=sqlite3.Row
 con.execute('PRAGMA journal_mode=WAL')
 con.execute('PRAGMA foreign_keys=ON')
 try:
  yield con
  con.commit()
 finally: con.close()

def init():
 with connection() as c:
  c.executescript('''CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','editor','viewer','ja')),created INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS workspace(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,contents TEXT NOT NULL,updated_by INTEGER REFERENCES users(id),updated_at INTEGER);
  INSERT OR IGNORE INTO workspace(id,revision,contents) VALUES(1,0,'{}');
  CREATE TABLE IF NOT EXISTS jokes(id INTEGER PRIMARY KEY,setup TEXT NOT NULL,punchline TEXT NOT NULL,created_by INTEGER REFERENCES users(id));
  CREATE TABLE IF NOT EXISTS ja_events(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,event_id TEXT NOT NULL,PRIMARY KEY(user_id,event_id));
  CREATE TABLE IF NOT EXISTS awards(id INTEGER PRIMARY KEY,event_id TEXT NOT NULL,category TEXT NOT NULL,placement TEXT NOT NULL,team_number TEXT NOT NULL,team_name TEXT NOT NULL,remarks TEXT NOT NULL DEFAULT '',published INTEGER NOT NULL DEFAULT 0,updated_by INTEGER REFERENCES users(id),updated_at INTEGER NOT NULL);''')
init()

def current_user(request):
 token=request.cookies.get('ga_session','')
 if not token:return None
 h=hashlib.sha256(token.encode()).hexdigest()
 with connection() as c:
  row=c.execute('SELECT users.id,users.email,users.role FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires>?',(h,int(time.time()))).fetchone()
 return dict(row) if row else None

def require(request,write=False,admin=False):
 u=current_user(request)
 if not u:raise HTTPException(401,'Sign in required')
 if admin and u['role']!='admin':raise HTTPException(403,'Administrator access required')
 if write and u['role'] in ('viewer','ja'):raise HTTPException(403,'Read-only account')
 return u

def check_origin(request):
 origin=request.headers.get('origin')
 if not origin:return
 from urllib.parse import urlparse
 parsed=urlparse(origin)
 allowed={x.strip().rstrip('/') for x in os.environ.get('GA_ALLOWED_ORIGINS','https://fll-mc-tool.fly.dev').split(',') if x.strip()}
 if parsed.scheme not in ('https', 'http') or f'{parsed.scheme}://{parsed.netloc}' not in allowed:
  raise HTTPException(403,'Invalid origin')

class Credentials(BaseModel):
 email:str=Field(max_length=254)
 password:str=Field(min_length=12,max_length=256)
class CreateUser(Credentials):
 role:str='editor'
class State(BaseModel):
 revision:int
 data:dict

def normalized(email):return email.strip().lower()

def set_session(resp,user_id):
 token=secrets.token_urlsafe(40)
 with connection() as c:c.execute('INSERT INTO sessions VALUES(?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),user_id,int(time.time())+SESSION_DAYS*86400))
 resp.set_cookie('ga_session',token,httponly=True,secure=COOKIE_SECURE,samesite='strict',max_age=SESSION_DAYS*86400,path='/')

@app.get('/')
def index():return FileResponse(ROOT/'static'/'index.html')
@app.get('/app.js')
def appjs():return FileResponse(ROOT/'static'/'app.js',media_type='text/javascript')
@app.get('/awards.js')
def awardsjs():return FileResponse(ROOT/'static'/'awards.js',media_type='text/javascript')
@app.get('/cloud.js')
def cloudjs():return FileResponse(ROOT/'static'/'cloud.js',media_type='text/javascript')
@app.get('/api/setup')
def setup():
 with connection() as c: return {'needs_setup':c.execute('SELECT count(*) FROM users').fetchone()[0]==0}
@app.post('/api/setup')
def first_admin(body:Credentials,request:Request):
 check_origin(request)
 with connection() as c:
  if c.execute('SELECT count(*) FROM users').fetchone()[0]:raise HTTPException(409,'Setup already completed')
  try:cur=c.execute('INSERT INTO users(email,password_hash,role,created) VALUES(?,?,?,?)',(normalized(body.email),ph.hash(body.password),'admin',int(time.time())))
  except sqlite3.IntegrityError:raise HTTPException(409,'Account exists')
  uid=cur.lastrowid
 resp=JSONResponse({'ok':True,'role':'admin'});set_session(resp,uid);return resp
@app.post('/api/register')
def register(body:Credentials,request:Request):
 check_origin(request)
 email=normalized(body.email)
 if '@' not in email or email.startswith('@') or email.endswith('@'):raise HTTPException(422,'Valid email required')
 with connection() as c:
  try:cur=c.execute('INSERT INTO users(email,password_hash,role,created) VALUES(?,?,?,?)',(email,ph.hash(body.password),'viewer',int(time.time())))
  except sqlite3.IntegrityError:raise HTTPException(409,'Email already registered')
  uid=cur.lastrowid
 resp=JSONResponse({'ok':True,'role':'viewer'});set_session(resp,uid);return resp

@app.post('/api/login')
def login(body:Credentials,request:Request):
 check_origin(request)
 with connection() as c:r=c.execute('SELECT * FROM users WHERE email=?',(normalized(body.email),)).fetchone()
 try:valid=bool(r and ph.verify(r['password_hash'],body.password))
 except (VerifyMismatchError,Exception):valid=False
 if not valid:raise HTTPException(401,'Invalid email or password')
 resp=JSONResponse({'ok':True,'role':r['role']});set_session(resp,r['id']);return resp
@app.post('/api/logout')
def logout(request:Request):
 check_origin(request)
 token=request.cookies.get('ga_session','')
 with connection() as c:c.execute('DELETE FROM sessions WHERE token_hash=?',(hashlib.sha256(token.encode()).hexdigest(),))
 resp=JSONResponse({'ok':True});resp.delete_cookie('ga_session',path='/');return resp
@app.get('/api/me')
def me(request:Request):return require(request)
@app.get('/api/state')
def state(request:Request):
 require(request)
 with connection() as c:r=c.execute('SELECT revision,contents,updated_at FROM workspace WHERE id=1').fetchone()
 return {'revision':r['revision'],'data':json.loads(r['contents']),'updated_at':r['updated_at']}
@app.put('/api/state')
def save_state(body:State,request:Request):
 u=require(request,write=True);check_origin(request)
 payload=json.dumps(body.data,separators=(',',':'),ensure_ascii=False)
 if len(payload)>8_000_000:raise HTTPException(413,'Workspace exceeds 8 MB; reduce embedded files')
 with connection() as c:
  cur=c.execute('UPDATE workspace SET contents=?,revision=revision+1,updated_by=?,updated_at=? WHERE id=1 AND revision=?',(payload,u['id'],int(time.time()),body.revision))
  if cur.rowcount==0:
   r=c.execute('SELECT revision FROM workspace WHERE id=1').fetchone()
   raise HTTPException(409,detail={'message':'Another announcer saved changes. Reload before saving again.','revision':r['revision']})
 return {'revision':body.revision+1,'ok':True}
@app.get('/api/users')
def users(request:Request):
 require(request,admin=True)
 with connection() as c:return [dict(x) for x in c.execute('SELECT id,email,role,created FROM users ORDER BY id')]
@app.post('/api/users')
def create_user(body:CreateUser,request:Request):
 require(request,admin=True);check_origin(request)
 if body.role not in ('admin','editor','viewer','ja'):raise HTTPException(422,'Invalid role')
 with connection() as c:
  try:c.execute('INSERT INTO users(email,password_hash,role,created) VALUES(?,?,?,?)',(normalized(body.email),ph.hash(body.password),body.role,int(time.time())))
  except sqlite3.IntegrityError:raise HTTPException(409,'Email already registered')
 return {'ok':True}
@app.get('/health')
def health():return {'status':'ok'}


class JokeInput(BaseModel):
 setup:str=Field(min_length=1,max_length=300)
 punchline:str=Field(min_length=1,max_length=1000)

@app.get('/api/jokes')
def list_jokes(request:Request):
 require(request)
 with connection() as c:return [dict(row) for row in c.execute('SELECT id,setup,punchline FROM jokes ORDER BY id')]

@app.post('/api/jokes')
def add_joke(body:JokeInput,request:Request):
 u=require(request,admin=True);check_origin(request)
 with connection() as c:
  cur=c.execute('INSERT INTO jokes(setup,punchline,created_by) VALUES(?,?,?)',(body.setup.strip(),body.punchline.strip(),u['id']))
  return {'id':cur.lastrowid,'ok':True}

@app.put('/api/jokes/{joke_id}')
def edit_joke(joke_id:int,body:JokeInput,request:Request):
 require(request,admin=True);check_origin(request)
 with connection() as c:
  cur=c.execute('UPDATE jokes SET setup=?,punchline=? WHERE id=?',(body.setup.strip(),body.punchline.strip(),joke_id))
  if not cur.rowcount:raise HTTPException(404,'Joke not found')
 return {'ok':True}

@app.delete('/api/jokes/{joke_id}')
def delete_joke(joke_id:int,request:Request):
 require(request,admin=True);check_origin(request)
 with connection() as c:
  cur=c.execute('DELETE FROM jokes WHERE id=?',(joke_id,))
  if not cur.rowcount:raise HTTPException(404,'Joke not found')
 return {'ok':True}

class RoleChange(BaseModel):
 role:str
class GrantInput(BaseModel):
 event_id:str=Field(min_length=1,max_length=120)
class AwardInput(BaseModel):
 event_id:str=Field(min_length=1,max_length=120)
 category:str=Field(min_length=1,max_length=120)
 placement:str=Field(min_length=1,max_length=80)
 team_number:str=Field(max_length=40)
 team_name:str=Field(min_length=1,max_length=200)
 remarks:str=Field(default='',max_length=4000)
 published:bool=False

def can_manage_awards(c,u,event_id):
 return u['role']=='admin' or (u['role']=='ja' and bool(c.execute('SELECT 1 FROM ja_events WHERE user_id=? AND event_id=?',(u['id'],event_id)).fetchone()))

@app.patch('/api/users/{user_id}/role')
def change_role(user_id:int,body:RoleChange,request:Request):
 u=require(request,admin=True);check_origin(request)
 if body.role not in ('admin','editor','viewer','ja'):raise HTTPException(422,'Invalid role')
 if user_id==u['id'] and body.role!='admin':raise HTTPException(400,'Cannot remove your own admin role')
 with connection() as c:
  if not c.execute('UPDATE users SET role=? WHERE id=?',(body.role,user_id)).rowcount:raise HTTPException(404,'User not found')
  if body.role!='ja':c.execute('DELETE FROM ja_events WHERE user_id=?',(user_id,))
 return {'ok':True}

@app.get('/api/ja-assignments')
def assignments(request:Request):
 u=require(request)
 with connection() as c:
  if u['role']=='admin':return [dict(r) for r in c.execute('SELECT user_id,event_id FROM ja_events')]
  return [dict(r) for r in c.execute('SELECT user_id,event_id FROM ja_events WHERE user_id=?',(u['id'],))]

@app.post('/api/users/{user_id}/events')
def grant_event(user_id:int,body:GrantInput,request:Request):
 require(request,admin=True);check_origin(request)
 with connection() as c:
  r=c.execute('SELECT role FROM users WHERE id=?',(user_id,)).fetchone()
  if not r or r['role']!='ja':raise HTTPException(422,'Assign the JA role first')
  c.execute('INSERT OR IGNORE INTO ja_events(user_id,event_id) VALUES(?,?)',(user_id,body.event_id))
 return {'ok':True}

@app.delete('/api/users/{user_id}/events/{event_id}')
def revoke_event(user_id:int,event_id:str,request:Request):
 require(request,admin=True);check_origin(request)
 with connection() as c:c.execute('DELETE FROM ja_events WHERE user_id=? AND event_id=?',(user_id,event_id))
 return {'ok':True}

@app.get('/api/awards')
def list_awards(request:Request,event_id:str):
 u=require(request)
 with connection() as c:
  if can_manage_awards(c,u,event_id):
   rows=c.execute('SELECT * FROM awards WHERE event_id=? ORDER BY category,placement,id',(event_id,))
  else:
   rows=c.execute('SELECT * FROM awards WHERE event_id=? AND published=1 ORDER BY category,placement,id',(event_id,))
  return [dict(r) for r in rows]

@app.post('/api/awards')
def create_award(body:AwardInput,request:Request):
 u=require(request);check_origin(request)
 with connection() as c:
  if not can_manage_awards(c,u,body.event_id):raise HTTPException(403,'Not assigned to this event')
  cur=c.execute('INSERT INTO awards(event_id,category,placement,team_number,team_name,remarks,published,updated_by,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',(body.event_id,body.category.strip(),body.placement.strip(),body.team_number.strip(),body.team_name.strip(),body.remarks.strip(),int(body.published),u['id'],int(time.time())))
  return {'id':cur.lastrowid,'ok':True}

@app.put('/api/awards/{award_id}')
def update_award(award_id:int,body:AwardInput,request:Request):
 u=require(request);check_origin(request)
 with connection() as c:
  old=c.execute('SELECT event_id FROM awards WHERE id=?',(award_id,)).fetchone()
  if not old:raise HTTPException(404,'Award not found')
  if not can_manage_awards(c,u,old['event_id']) or not can_manage_awards(c,u,body.event_id):raise HTTPException(403,'Not assigned to this event')
  c.execute('UPDATE awards SET event_id=?,category=?,placement=?,team_number=?,team_name=?,remarks=?,published=?,updated_by=?,updated_at=? WHERE id=?',(body.event_id,body.category.strip(),body.placement.strip(),body.team_number.strip(),body.team_name.strip(),body.remarks.strip(),int(body.published),u['id'],int(time.time()),award_id))
 return {'ok':True}

@app.delete('/api/awards/{award_id}')
def delete_award(award_id:int,request:Request):
 u=require(request);check_origin(request)
 with connection() as c:
  r=c.execute('SELECT event_id FROM awards WHERE id=?',(award_id,)).fetchone()
  if not r:raise HTTPException(404,'Award not found')
  if not can_manage_awards(c,u,r['event_id']):raise HTTPException(403,'Not assigned to this event')
  c.execute('DELETE FROM awards WHERE id=?',(award_id,))
 return {'ok':True}
