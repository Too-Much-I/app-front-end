import { decideAppUpdate, parseAppVersion } from '@/features/app-version/app-version';

describe('설치 버전과 최소 버전 비교', () => {
  it.each([
    ['2.9.9', '3.0.0'],
    ['3.0.0', '3.0.1'],
    ['3.0.9', '3.1.0'],
    // 문자열 비교였다면 '3.10.0' < '3.9.0'으로 잘못 판단한다.
    ['3.9.0', '3.10.0'],
  ])('설치 %s가 최소 %s보다 낮으면 업데이트가 필요하다', (installed, minimum) => {
    expect(decideAppUpdate(installed, minimum)).toBe('required');
  });

  it.each([
    ['3.0.0', '3.0.0'],
    ['3.0.1', '3.0.0'],
    ['3.10.0', '3.9.0'],
    ['4.0.0', '3.99.99'],
  ])('설치 %s가 최소 %s 이상이면 업데이트가 필요 없다', (installed, minimum) => {
    expect(decideAppUpdate(installed, minimum)).toBe('not-required');
  });

  it.each([
    [null, '3.0.0'],
    ['3.0.0', null],
    ['3.0', '3.0.0'],
    ['3.0.0', 'v3.0.0'],
    ['3.0.0-beta', '3.0.0'],
    ['', '3.0.0'],
  ])('설치 %p, 최소 %p처럼 읽을 수 없으면 막지 않고 unknown이다', (installed, minimum) => {
    expect(decideAppUpdate(installed, minimum)).toBe('unknown');
  });

  it('앞뒤 공백은 무시하고 읽는다', () => {
    expect(parseAppVersion(' 3.0.1 ')).toEqual([3, 0, 1]);
  });
});
