import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(
  new URL('../src/features/auth/firebase-phone-validation.ts', import.meta.url),
  'utf8',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function setup() {
  let now = 0;
  let user = { uid: 'first', phoneNumber: null };
  let finishLink;
  let links = 0;
  let refreshes = 0;
  const timers = new Map();
  let timerId = 0;
  const observers = [];
  const authListeners = [];
  const sdk = {
    getAuth: () => ({ currentUser: user }),
    onAuthStateChanged: (_, callback) => {
      authListeners.push(callback);
      callback(user);
      return () => {};
    },
    getIdToken: async () => {
      refreshes++;
      return 'test-proof';
    },
    linkWithCredential: (owner) => {
      links++;
      return new Promise((resolve) => {
        finishLink = () => {
          owner.phoneNumber = '+821012345678';
          resolve();
        };
      });
    },
    PhoneAuthProvider: { credential: (id, code) => ({ id, code }) },
    verifyPhoneNumber: () => ({ on: (_, callback) => observers.push(callback) }),
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (id) =>
      id === '@react-native-firebase/auth'
        ? sdk
        : id.includes('firebase-auth-errors')
          ? { readFirebaseSdkErrorCode: (e) => e?.code ?? null }
          : require(id),
    Date: { now: () => now },
    setTimeout: (callback, ms) => {
      timers.set(++timerId, { callback, at: now + ms });
      return timerId;
    },
    clearTimeout: (id) => timers.delete(id),
  });
  const store = exports.createFirebasePhoneValidation();
  store.observeUser();
  return {
    store,
    observers,
    advance(ms) {
      now += ms;
      for (const [id, timer] of timers) {
        if (timer.at <= now) {
          timers.delete(id);
          timer.callback();
        }
      }
    },
    sent(index, id) {
      observers[index]({ state: 'sent', verificationId: id });
    },
    changeUser(uid) {
      user = { uid, phoneNumber: null };
      for (const callback of authListeners) callback(user);
    },
    finish: () => finishLink(),
    links: () => links,
    refreshes: () => refreshes,
  };
}

// 응답이 없어도 시작 기준 간격 후 재전송하며 이전 성공·실패는 무시한다.
{
  const t = setup();
  t.store.requestCode();
  t.advance(14999);
  t.store.requestCode();
  assert.equal(t.observers.length, 1);
  t.advance(1);
  t.store.requestCode();
  assert.equal(t.observers.length, 2);
  t.sent(0, 'old');
  assert.equal(t.store.getState().stage.status, 'sending');
  t.sent(1, 'new');
  assert.equal(t.store.getState().stage.verificationId, 'new');
  t.observers[0]({ state: 'error' });
  assert.equal(t.store.getState().stage.verificationId, 'new');
}
// 타임아웃만으로 최신 응답을 무효화하지 않는다.
{
  const t = setup();
  t.store.requestCode();
  t.advance(45000);
  assert.equal(t.store.getState().stage.status, 'send-delayed');
  t.sent(0, 'late');
  assert.equal(t.store.getState().stage.verificationId, 'late');
}
{
  const t = setup();
  t.store.requestCode();
  t.advance(15000);
  t.sent(0, 'before-resend');
  assert.equal(t.store.getState().stage.verificationId, 'before-resend');
  t.store.setCode('123456');
  const verification = t.store.verifyCode();
  t.advance(45000);
  assert.equal(t.store.getState().connection.status, 'delayed');
  t.store.requestCode();
  await t.store.verifyCode();
  assert.equal(t.observers.length, 1);
  assert.equal(t.links(), 1);
  t.finish();
  await verification;
  assert.equal(t.store.getState().stage.status, 'complete');
  assert.equal(t.store.getState().connection.status, 'idle');
  assert.equal(t.refreshes(), 1);
}
// UID 변경 후에도 네이티브 연결 종료를 기다리고 종료 후 차단을 해제한다.
{
  const t = setup();
  t.store.requestCode();
  t.sent(0, 'id');
  t.store.setCode('123456');
  const verification = t.store.verifyCode();
  t.advance(45000);
  t.changeUser();
  assert.equal(t.store.getState().connection.status, 'delayed');
  t.store.requestCode();
  assert.equal(t.observers.length, 1);
  t.finish();
  await verification;
  assert.equal(t.store.getState().connection.status, 'idle');
  assert.equal(t.store.getState().stage.status, 'idle');
  assert.equal(t.refreshes(), 0);
  t.store.requestCode();
  assert.equal(t.observers.length, 2);
}
{
  const t = setup();
  t.store.requestCode();
  for (const seconds of [15, 30, 45, 60]) {
    t.advance(seconds * 1000);
    t.store.requestCode();
  }
  assert.equal(t.observers.length, 5);
  t.advance(60000);
  t.store.requestCode();
  assert.equal(t.observers.length, 5);
}
// Navigator 구독은 Phone 화면이 닫힌 동안에도 A → B → A를 감지하고 매번 초기화한다.
{
  const t = setup();
  t.store.requestCode();
  t.sent(0, 'account-a');
  t.store.setCode('111111');
  t.advance(15000);
  t.store.requestCode();
  assert.equal(t.store.getState().attempts, 2);
  t.changeUser('second');
  assert.equal(t.store.getState().uid, 'second');
  assert.equal(t.store.getState().attempts, 0);
  assert.equal(t.store.getState().code, '');
  t.changeUser('first');
  assert.equal(t.store.getState().uid, 'first');
  assert.equal(t.store.getState().attempts, 0);
  assert.equal(t.store.getState().stage.status, 'idle');
  assert.equal(t.store.getState().nextSendAt, 0);
}

console.log('Phone validation: 6 lifecycle scenarios passed');
