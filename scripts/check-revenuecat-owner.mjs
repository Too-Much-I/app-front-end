import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the real wrapper against a fake native SDK; no Store or network calls.
const source = readFileSync(new URL('../src/features/pass/revenuecat.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
let sdkId;
let configured;
let purchases = 0;
let logouts = 0;
let cancelled = false;
const sdk = {
  configure(options) {
    configured = options;
    sdkId = options.appUserID;
  },
  async logIn(id) {
    sdkId = id;
  },
  async logOut() {
    logouts++;
    sdkId = 'anonymous';
  },
  async getAppUserID() {
    return sdkId;
  },
  async getOfferings() {
    return { all: { premium: { identifier: 'premium' } } };
  },
  async purchasePackage() {
    purchases++;
    if (cancelled) throw { code: 'cancelled' };
    return { transaction: { transactionIdentifier: 'fake-transaction' } };
  },
};
const exports = {};
vm.runInNewContext(compiled, {
  exports,
  require(name) {
    if (name === 'react-native') return { Platform: { OS: 'ios' } };
    if (name === 'react-native-purchases')
      return {
        __esModule: true,
        default: sdk,
        PURCHASES_ERROR_CODE: { PURCHASE_CANCELLED_ERROR: 'cancelled' },
      };
    throw new Error('Unexpected dependency');
  },
});
await assert.rejects(exports.loadPassOffering('member-a'));
assert.equal(configured, undefined);
await exports.logInStoreCustomer('member-a');
assert.equal(configured.appUserID, 'member-a');
assert.equal((await exports.loadPassOffering('member-a')).identifier, 'premium');
assert.equal((await exports.purchasePassPackage({}, 'member-a')).kind, 'purchased');
await exports.logOutStoreCustomer();
assert.equal(logouts, 0);
await assert.rejects(exports.purchasePassPackage({}, 'member-a'));
await exports.logInStoreCustomer('member-b');
await assert.rejects(exports.purchasePassPackage({}, 'member-a'));
sdkId = 'unexpected-account';
await assert.rejects(exports.purchasePassPackage({}, 'member-b'));
assert.equal(purchases, 1);
await exports.logInStoreCustomer('member-b');
cancelled = true;
assert.equal((await exports.purchasePassPackage({}, 'member-b')).kind, 'cancelled');
console.log('RevenueCat owner checks passed (native SDK mock).');
