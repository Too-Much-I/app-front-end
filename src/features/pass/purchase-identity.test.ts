import { createPurchaseIdentity } from '@/features/pass/purchase-identity';

function setup(stored: string | null = null) {
  let saved = stored;
  let issued = 0;
  const dependencies = {
    requestRef: jest.fn(() => Promise.resolve(`issued-${++issued}`)),
    readStored: jest.fn(() => Promise.resolve(saved)),
    store: jest.fn((value: string) => {
      saved = value;
      return Promise.resolve();
    }),
    clearStored: jest.fn(() => {
      saved = null;
      return Promise.resolve();
    }),
    logInStore: jest.fn((_value: string) => Promise.resolve()),
    logOutStore: jest.fn(() => Promise.resolve()),
  };
  return { identity: createPurchaseIdentity(dependencies), dependencies, saved: () => saved };
}

describe('결제용 ID 확보', () => {
  it('저장된 값이 있으면 서버에 묻지 않고 그 값으로 RevenueCat에 로그인한다', async () => {
    const { identity, dependencies } = setup('stored-ref');

    await expect(identity.ensure()).resolves.toBe('stored-ref');
    expect(dependencies.requestRef).not.toHaveBeenCalled();
    expect(dependencies.logInStore).toHaveBeenCalledWith('stored-ref');
  });

  it('저장된 값이 없으면 받아서 저장한다', async () => {
    const { identity, saved } = setup();

    await expect(identity.ensure()).resolves.toBe('issued-1');
    expect(saved()).toBe('issued-1');
  });

  it('저장에 실패해도 결제는 막지 않는다', async () => {
    const { identity, dependencies } = setup();
    dependencies.store.mockRejectedValue(new Error('disk full'));

    await expect(identity.ensure()).resolves.toBe('issued-1');
    expect(dependencies.logInStore).toHaveBeenCalledWith('issued-1');
  });

  it('RevenueCat 로그인에 실패하면 던진다 — 결제를 시작하지 않게', async () => {
    const { identity, dependencies } = setup('stored-ref');
    dependencies.logInStore.mockRejectedValue(new Error('sdk'));

    await expect(identity.ensure()).rejects.toThrow('sdk');
  });

  it('동시에 부르면 한 번만 받는다', async () => {
    const { identity, dependencies } = setup();

    const values = await Promise.all([identity.ensure(), identity.ensure()]);

    expect(values).toEqual(['issued-1', 'issued-1']);
    expect(dependencies.requestRef).toHaveBeenCalledTimes(1);
  });
});

describe('계정이 바뀔 수 있을 때(로그인 화면)', () => {
  it('reset 뒤 ensure는 이전 회원 값을 쓰지 않고 새로 받는다', async () => {
    const { identity, dependencies } = setup();
    await identity.ensure();

    await identity.reset();

    await expect(identity.ensure()).resolves.toBe('issued-2');
    expect(dependencies.logOutStore).toHaveBeenCalledTimes(1);
  });

  it('A의 ensure가 늦게 끝나도 뒤에 부른 reset이 지운다', async () => {
    const { identity, saved } = setup();

    const ensureA = identity.ensure();
    const reset = identity.reset();
    await Promise.all([ensureA, reset]);

    // 남은 값으로 다른 회원이 결제하면 이전 회원에게 이용권이 붙는다.
    expect(saved()).toBeNull();
  });

  it('reset 앞에 줄 선 ensure를 reset 뒤에 함께 쓰지 않는다', async () => {
    const { identity } = setup();

    const ensureA = identity.ensure();
    void identity.reset();
    const ensureB = identity.ensure();

    expect(ensureB).not.toBe(ensureA);
    await expect(ensureA).resolves.toBe('issued-1');
    await expect(ensureB).resolves.toBe('issued-2');
  });

  it('logOut이 실패해도 reset은 던지지 않는다', async () => {
    const { identity, dependencies } = setup();
    dependencies.logOutStore.mockRejectedValue(new Error('sdk'));

    await expect(identity.reset()).resolves.toBeUndefined();
  });
});
