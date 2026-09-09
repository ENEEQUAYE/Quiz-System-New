const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../backend/models/User');
const LoginSession = require('../backend/models/LoginSession');
const authRoutes = require('../backend/routes/auth');
const userRoutes = require('../backend/routes/user');

async function serve(t, app) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return async (path, { body, token, method = 'GET' } = {}) => {
    const response = await fetch('http://127.0.0.1:' + server.address().port + path, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: response.status, body: await response.json() };
  };
}
function app() {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRoutes);
  app.use('/users', userRoutes);
  return app;
}

test('public registration ignores privileged fields and returns no session or secrets', async t => {
  let saved;
  t.mock.method(User.prototype, 'save', async function() { await this.validate(); saved = this; return this; });
  t.mock.method(User.prototype, 'generateAuthToken', async () => { throw new Error('Pending accounts must not receive tokens'); });
  const request = await serve(t, app());
  const body = {
    firstName: 'Test', lastName: 'Student', email: 'Student@example.invalid', password: 'test-password',
    phone: '123', role: 'admin', status: 'active', approvedBy: new mongoose.Types.ObjectId(),
    approvedAt: new Date(), quizzesAllowed: [new mongoose.Types.ObjectId()],
    resetPasswordToken: 'injected-reset-token', resetPasswordExpires: new Date(), _id: new mongoose.Types.ObjectId()
  };
  const response = await request('/auth/register', {method:'POST',body});
  assert.equal(response.status,201);
  assert.equal(saved.role,'student'); assert.equal(saved.status,'pending');
  assert.equal(saved.approvedBy,undefined); assert.equal(saved.approvedAt,undefined);
  assert.equal(saved.quizzesAllowed.length,0); assert.notEqual(String(saved._id),String(body._id));
  assert.equal(saved.resetPasswordToken,undefined);
  assert.equal(response.body.token,undefined);
  assert.equal(response.body.user.password,undefined);
  assert.equal(response.body.user.resetPasswordToken,undefined);
  assert.equal(saved.email,'student@example.invalid');
  const invalid = await request('/auth/register',{method:'POST',body:{...body,email:{$ne:null}}});
  assert.equal(invalid.status,400);
  t.mock.method(User.prototype,'save',async()=>{const error=new Error('sensitive duplicate key detail');error.code=11000;throw error;});
  const duplicate = await request('/auth/register',{method:'POST',body});
  assert.equal(duplicate.status,409); assert.ok(!JSON.stringify(duplicate.body).includes('sensitive'));
});

test('user management rejects students but allows admins and safe self-service', async t => {
  process.env.JWT_SECRET = 'privilege-regression-test-only';
  let role = 'student';
  const id = new mongoose.Types.ObjectId();
  const sid = new mongoose.Types.ObjectId();
  const account = () => new User({_id:id,firstName:'Test',lastName:'User',email:'test@example.invalid',role,status:'active',
    password:'stored-password-hash',resetPasswordToken:'stored-reset-hash',resetPasswordExpires:new Date()});
  t.mock.method(LoginSession,'findOne',async()=>({_id:sid}));
  t.mock.method(User,'findById',async()=>account());
  let directoryReads=0; let projection;
  t.mock.method(User,'find',()=>{directoryReads++;return {select(fields){projection=fields;return this;},sort:async()=>[account()]};});
  const token=jwt.sign({_id:String(id),sid:String(sid)},process.env.JWT_SECRET,{expiresIn:'1h'});
  const request=await serve(t,app());
  for(const [path,method] of [
    ['/users','GET'],['/users/pending','GET'],['/users/pending/count','GET'],
    ['/users/'+id+'/status','PUT'],['/users/admin','POST'],['/users/'+id,'DELETE']
  ]) {
    const response=await request(path,{method,token,body:method==='GET'?undefined:{}});
    assert.equal(response.status,403,path+' must require admin role');
  }
  assert.equal(directoryReads,0);
  assert.equal((await request('/users')).status,401);
  for(const path of ['/users/me','/auth/me']) {
    const response=await request(path,{token});
    assert.equal(response.status,200);
    const data=JSON.stringify(response.body);
    assert.ok(!data.includes('stored-password-hash')); assert.ok(!data.includes('stored-reset-hash'));
    assert.ok(!data.includes('resetPasswordExpires'));
  }
  role='admin';
  const directory=await request('/users',{token});
  assert.equal(directory.status,200);
  assert.equal(directoryReads,1);
  assert.ok(!projection.includes('password')); assert.ok(!projection.includes('resetPassword'));
  assert.equal(directory.body.users[0].password,undefined);
});

test('passwords are hidden by default without breaking login or password comparison', async t => {
  for(const field of ['password','resetPasswordToken','resetPasswordExpires']) assert.equal(User.schema.path(field).options.select,false);
  const hash=await bcrypt.hash('valid-password',4);
  const account=new User({firstName:'Test',lastName:'User',email:'test@example.invalid',status:'active',password:hash});
  assert.equal(await account.comparePassword('valid-password'),true);
  assert.equal(await account.comparePassword('wrong-password'),false);
  assert.equal(JSON.parse(JSON.stringify(account)).password,undefined);
  const withoutHash=new User({_id:account._id,firstName:'Test',lastName:'User',email:account.email});
  t.mock.method(User,'findById',()=>({select(field){assert.equal(field,'+password');return Promise.resolve(account);}}));
  assert.equal(await withoutHash.comparePassword('valid-password'),true,'password changes must work on default-selected users');

  t.mock.method(User,'findOne',()=>({select(field){assert.equal(field,'+password');return Promise.resolve(account);}}));
  t.mock.method(User.prototype,'generateAuthToken',async()=> 'authenticated-session');
  const request=await serve(t,app());
  const login=await request('/auth/login',{method:'POST',body:{email:account.email,password:'valid-password'}});
  assert.equal(login.status,200); assert.equal(login.body.token,'authenticated-session');
  assert.equal(login.body.user.password,undefined);
  const invalid=await request('/auth/login',{method:'POST',body:{email:{$ne:null},password:'valid-password'}});
  assert.equal(invalid.status,400);
});
