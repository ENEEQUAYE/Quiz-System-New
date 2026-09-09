const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../backend/models/User');
const Session = require('../backend/models/LoginSession');
const auth = require('../backend/middleware/authMiddleware');
const router = require('../backend/routes/auth');
const vm = require('node:vm');
const fs = require('node:fs');

test('server session lifecycle', async t => {
  process.env.JWT_SECRET = 'session-regression-test-only';
  const user = new User({ firstName: 'Test', lastName: 'Student', email: 'test@example.invalid', status: 'active' });
  const sessions = new Map();
  function matches(record, filter) {
    return record && String(record._id) === String(filter._id) && String(record.user) === String(filter.user) &&
      record.expiresAt > filter.expiresAt.$gt && record.lastActivityAt > filter.lastActivityAt.$gt;
  }
  t.mock.method(Session.prototype, 'save', async function() { sessions.set(String(this._id), this); return this; });
  t.mock.method(User, 'findById', async () => user);
  t.mock.method(Session, 'findOne', async filter => {
    const record = sessions.get(String(filter._id));
    return matches(record, filter) ? record : null;
  });
  t.mock.method(Session, 'findOneAndUpdate', async (filter, update) => {
    const record = sessions.get(String(filter._id));
    if (!matches(record, filter)) return null;
    record.lastActivityAt = new Date(Math.max(record.lastActivityAt, update.$max.lastActivityAt));
    return record;
  });
  t.mock.method(Session, 'deleteOne', async filter => { sessions.delete(String(filter._id)); });
  function response() {
    return { statusCode: 200, status(n) { this.statusCode=n; return this; }, json(b) { this.body=b; return this; }, set() {return this;} };
  }
  async function authenticate(token) {
    const req = { header: () => 'Bearer ' + token };
    const res = response();
    let allowed = false;
    await auth(req, res, () => { allowed=true; });
    return {req,res,allowed};
  }
  function endpoint(path, method) {
    return router.stack.find(l => l.route?.path === path && l.route.methods[method]).route.stack.at(-1).handle;
  }
  const token = await user.generateAuthToken();
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  assert.equal(decoded.exp-decoded.iat, 8*60*60);
  assert.ok(decoded.sid);
  const record = sessions.get(decoded.sid);
  assert.ok(record);
  const first = await authenticate(token);
  assert.equal(first.allowed, true);
  const initialActivity = record.lastActivityAt.getTime();
  await endpoint('/session','get')(first.req,response());
  await authenticate(token);
  assert.equal(record.lastActivityAt.getTime(), initialActivity, 'polling must not renew idle time');

  record.lastActivityAt = new Date(Date.now()-29*60*1000);
  const beforeAbsolute = record.expiresAt.getTime();
  const active = await authenticate(token);
  await endpoint('/session/activity','post')(active.req,response());
  assert.ok(record.lastActivityAt.getTime() > Date.now()-1000);
  assert.equal(record.expiresAt.getTime(), beforeAbsolute, 'activity must not extend absolute lifetime');

  record.lastActivityAt = new Date(Date.now()-Session.IDLE_MS-100);
  assert.equal((await authenticate(token)).res.statusCode,401);
  const expiredResponse=response();
  await endpoint('/session/activity','post')(active.req,expiredResponse);
  assert.equal(expiredResponse.statusCode,401,'activity cannot revive a session expired after middleware');
  record.lastActivityAt=new Date();
  record.expiresAt=new Date(Date.now()-1);
  assert.equal((await authenticate(token)).allowed,false);
  record.expiresAt=new Date(Date.now()+100000);
  user.status='rejected';
  assert.equal((await authenticate(token)).allowed,false);
  user.status='active';
  await endpoint('/logout','post')(active.req,response());
  assert.equal((await authenticate(token)).allowed,false,'revoked token must fail immediately');
  const legacy=jwt.sign({_id:String(user._id)},process.env.JWT_SECRET,{expiresIn:'1d'});
  assert.equal((await authenticate(legacy)).res.statusCode,401);
  t.mock.method(Session,'findOne',async()=>{throw new Error('Simulated database outage');});
  assert.equal((await authenticate(token)).res.statusCode,503,'outage must not masquerade as expiry');
});

function browser({ token = 'x.' + Buffer.from(JSON.stringify({sid:'test'})).toString('base64url') + '.x', pathname='/take-quiz.html' } = {}) {
  const callbacks={}; const intervals=[]; const calls=[]; const redirects=[]; const nodes=[];
  const storage=new Map(token ? [['token',token],['user','{}']] : []);
  const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
  const sessionStorage={...localStorage, getItem:k=>sessionStorage.map.get(k)||null,setItem:(k,v)=>sessionStorage.map.set(k,v),removeItem:k=>sessionStorage.map.delete(k),map:new Map()};
  let now=0; let status=200; let idle=30*60000; let absolute=8*3600000;
  const listen=(name,fn)=>{(callbacks[name] ||= []).push(fn);};
  const document={hidden:false,body:{append:n=>nodes.push(n)},addEventListener:listen,querySelector:()=>null,
    createElement:()=>({style:{},setAttribute(){},addEventListener:listen,append(...children){this.children=children;}})};
  const location={pathname,search:'?id=6800c2a621fe5984f825c52a',href:'https://example.test'+pathname,replace:url=>redirects.push(url)};
  const context={document,location,localStorage,sessionStorage,performance:{now:()=>now},URL,URLSearchParams,Headers,Request,Event,console,
    atob:s=>Buffer.from(s,'base64').toString(),setInterval:fn=>intervals.push(fn),
    addEventListener:listen,dispatchEvent:event=>(callbacks[event.type]||[]).forEach(fn=>fn(event)),
    API_URL:'https://example.test/api',
    fetch:async (url,init)=>{calls.push({url,init});return {status,ok:status===200,json:async()=>({serverNow:1000,idleExpiresAt:1000+idle,expiresAt:1000+absolute})};}};
  context.window=context;
  vm.runInNewContext(fs.readFileSync('frontend/js/login-session.js','utf8'),context);
  return {context,calls,redirects,nodes,storage,intervals,callbacks, setTime:v=>now=v,setStatus:v=>status=v,
    setDeadlines:(i,a)=>{idle=i;absolute=a;},emit:(name,event={})=>(callbacks[name]||[]).forEach(fn=>fn(event))};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('browser warns, counts deliberate interaction only, and handles expiry', async () => {
  const b=browser(); await b.context.loginSessionReady;
  assert.equal(b.calls.length,1);
  b.setTime(28*60000+1); b.intervals[0]();
  assert.match(b.nodes[0].children[0].textContent,/inactivity/);
  await b.context.fetch('https://example.test/api/quizzes/x/session',{method:'POST',headers:{Authorization:'Bearer '+b.storage.get('token')}});
  assert.equal(b.calls.filter(c=>c.url.endsWith('/activity')).length,0,'autosave must not renew');
  b.emit('pointerdown',{isTrusted:false}); await flush();
  assert.equal(b.calls.filter(c=>c.url.endsWith('/activity')).length,0);
  b.emit('pointerdown',{isTrusted:true}); await flush();
  assert.equal(b.calls.filter(c=>c.url.endsWith('/activity')).length,1);
  b.setStatus(401);
  await b.context.fetch('https://example.test/api/quizzes/x',{headers:{Authorization:'Bearer '+b.storage.get('token')}});
  assert.equal(b.storage.has('token'),false);
  assert.match(b.redirects[0],/session=expired/);
  assert.match(b.context.sessionStorage.getItem('loginReturnUrl'),/^take-quiz/);
});
test('legacy tokens are cleared; session state checks do not trust browser wall time', async()=>{
  const b=browser({token:'x.'+Buffer.from('{}').toString('base64url')+'.x'});
  assert.equal(b.storage.has('token'),false);
  const active=browser(); await active.context.loginSessionReady;
  assert.equal(active.redirects.length,0);
  active.setDeadlines(60000,30000);
  active.emit('visibilitychange'); await flush();
  assert.equal(active.nodes[0].children[1].hidden,true,'absolute deadline cannot be extended');
});
test('logout waits for revocation and cross-tab replacement does not erase a new login', async()=>{
  const b=browser(); await b.context.loginSessionReady;
  b.setStatus(503);
  b.emit('click',{target:{closest:()=>({})},preventDefault(){},stopImmediatePropagation(){}});
  await flush(); assert.ok(b.storage.get('token')); assert.equal(b.redirects.length,0);
  b.setStatus(200);
  b.emit('click',{target:{closest:()=>({})},preventDefault(){},stopImmediatePropagation(){}});
  await flush(); assert.equal(b.storage.has('token'),false); assert.match(b.redirects[0],/logout/);
  const other=browser(); await other.context.loginSessionReady;
  other.storage.set('token','new-login');
  other.emit('storage',{key:'token',newValue:'new-login'});
  assert.equal(other.storage.get('token'),'new-login');
});
