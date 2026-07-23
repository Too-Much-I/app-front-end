# React Navigation 탭 버튼 교체 후 아이콘 위치 이동 수정

하단 탭의 Android 리플을 없애고 iOS/Android 모두 opacity 피드백으로 통일하기 위해 React Navigation의 `PlatformPressable`을 공용 `Pressable`로 교체했다. 교체 직후 별도의 아이콘 스타일을 수정하지 않았는데도 탭 아이콘 위치가 달라졌고, 원인을 좁혀 기존 레이아웃을 보존하면서 피드백만 교체한 과정을 정리한다.

## 1. 배경

React Navigation의 하단 탭은 기본 버튼으로 `@react-navigation/elements`의 `PlatformPressable`을 사용한다. 이 컴포넌트는 Android 5 이상에서 리플을 사용하고, 해당 환경에서는 opacity 애니메이션을 실행하지 않는다.

프로젝트에서는 같은 버튼이 OS에 따라 다르게 반응하지 않도록 다음 동작으로 통일하려 했다.

- iOS: 누르는 동안 opacity 감소
- Android: 리플 없이 동일한 opacity 감소

`PlatformPressable`에 `pressOpacity`를 지정하는 것만으로는 Android 동작을 바꿀 수 없었다. 설치된 버전의 구현은 Android가 리플을 지원하면 opacity 애니메이션 함수에서 바로 반환하고, 전달된 `android_ripple` 값과 별개로 리플 설정을 구성하기 때문이다. 리플 색을 투명하게 만드는 방법도 리플만 보이지 않게 할 뿐, 이 조기 반환 때문에 Android opacity 피드백은 생기지 않는다.

그래서 `tabBarButton` 옵션에 프로젝트의 공용 `Pressable`을 연결했다.

## 2. 증상

기본 `PlatformPressable`을 공용 `Pressable`로 바꾼 뒤 하단 탭 아이콘과 라벨의 위치가 기존과 달라졌다. `tabBarIconStyle`이나 아이콘 크기 값은 바꾸지 않았기 때문에 처음에는 React Navigation이 버튼에 넣는 기본 padding을 의심했다.

React Navigation의 `BottomTabItem` 소스를 확인하면 세로 UIKit 탭 버튼에 대략 다음 레이아웃 스타일을 전달한다.

```tsx
{
  alignItems: "center",
  justifyContent: "flex-start",
  flexDirection: "column",
  padding: 5,
}
```

이 `padding: 5`를 덮기 위해 커스텀 탭 버튼에 `{ padding: 0 }`을 추가해봤지만, 이는 근본 원인에 대한 수정이 아니었다. 버튼이 받은 레이아웃을 다시 계산하는 대신 라이브러리 내부 스타일 일부를 애플리케이션에서 임의로 덮는 방식이라, 기존 버튼과의 차이를 하나 더 만들었다.

## 3. 실제 차이: 스타일 값이 아니라 스타일 전달 방식

교체 전후 코드를 비교했을 때 중요한 차이는 `style`의 값보다 이를 네이티브 `Pressable`에 전달하는 방식이었다.

React Navigation의 기본 `PlatformPressable`은 다음 구조를 사용한다.

```tsx
const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);

<AnimatedPressable
  style={[{ opacity: animatedOpacity }, styleFromBottomTabItem]}
/>
```

즉 `BottomTabItem`이 정적 배열로 만든 flex, 정렬, padding 스타일을 정적 스타일로 유지하고, 피드백용 opacity만 `Animated.Value`로 별도 관리한다.

반면 처음 만든 공용 `Pressable`은 전달받은 스타일이 정적이어도 항상 상태 콜백으로 변환했다.

```tsx
<RNPressable
  style={(state) => [
    styleFromBottomTabItem,
    state.pressed ? { opacity: 0.7 } : null,
  ]}
/>
```

React Native의 `Pressable`은 위와 같은 함수형 스타일을 공식적으로 지원한다. 따라서 **함수형 스타일을 사용하면 일반적으로 레이아웃이 이동한다는 의미는 아니다.** 이번 문제는 React Navigation이 구성한 버튼을 다른 구현으로 교체하면서, 기존 컴포넌트가 사용하던 `AnimatedPressable + 정적 레이아웃 스타일` 처리 경로까지 함께 바꾼 데 있었다.

실기기에서 다음 두 조건을 원래 방식으로 되돌렸을 때 아이콘 위치가 복구됐다.

1. 정적으로 들어온 레이아웃 스타일은 정적으로 전달한다.
2. opacity 상태만 `Animated.Value`로 분리한다.

따라서 이 문제의 실무적인 원인은 “동적 스타일은 위험하다”가 아니라 **커스텀 `tabBarButton`이 React Navigation 기본 버튼의 레이아웃 전달 계약을 그대로 보존하지 않았다**로 보는 것이 정확하다.

## 4. 최종 해결

### 공용 `Pressable`

`src/components/ui/Pressable.tsx`를 React Navigation 기본 버튼과 같은 `AnimatedPressable` 구조로 바꿨다.

- 전달받은 `style`이 정적이면 정적 배열 그대로 유지한다.
- `onPressIn`에서 `Animated.Value`를 `0.7`로 바꾼다.
- `onPressOut`에서 200ms 동안 opacity를 `1`로 복원한다.
- `android_ripple`을 만들지 않으므로 두 OS 모두 동일한 opacity 피드백이 난다.
- `android_ripple` prop은 타입에서 `never`로 막고 런타임에서도 제거해 소비처가 실수로 리플을 되살릴 수 없게 한다.
- 소비자가 함수형 `style`을 명시적으로 전달한 경우에는 기존 React Native API 계약대로 함수형 스타일도 계속 지원한다.

### 탭 전용 어댑터

`src/navigation/TabBarButton.tsx`에서는 React Navigation이 전달한 `style`을 수정하지 않고 그대로 공용 `Pressable`에 넘긴다.

```tsx
<Pressable {...props} style={style}>
  {children}
</Pressable>
```

단, `BottomTabItem`은 기본 `PlatformPressable`을 전제로 아래 피드백 관련 prop도 함께 전달하므로 공용 RN `Pressable`까지 흘려보내지 않는다.

- `android_ripple`: 그대로 넘기면 제거하려던 Android 리플이 다시 활성화된다.
- `pressOpacity`: 공용 `Pressable`의 opacity 정책과 중복되고 RN `Pressable`의 prop이 아니다.
- `hoverEffect`: React Navigation의 `PlatformPressable` 전용 prop이다.

React Navigation이 플랫폼별로 정해준 `role`, 접근성 prop, 이벤트, `href` 등은 유지한다. `ref`는 라이브러리 타입이 `View`보다 넓게 선언돼 있어 실제 네이티브 대상인 `Ref<View>`로만 좁혀 전달한다.

## 5. 채택하지 않은 방법

### `padding: 0`으로 위치 보정

현재 라이브러리 버전의 내부 padding에 의존하는 보정이다. 아이콘 위치가 맞아 보이더라도 React Navigation 업데이트나 가로형 탭, 태블릿 레이아웃에서 다시 어긋날 수 있다. 커스텀 버튼의 역할은 피드백 교체뿐이므로 라이브러리가 넘긴 레이아웃을 수정하지 않는 쪽을 택했다.

### 투명한 Android 리플

리플은 눈에 보이지 않지만 `PlatformPressable`은 Android 리플 지원 여부만 보고 opacity 애니메이션을 건너뛴다. 따라서 두 OS의 터치 피드백을 opacity로 통일한다는 요구사항을 만족하지 않는다.

### 탭 아이콘에 margin/translate 보정

증상을 아이콘에서 상쇄할 뿐 버튼 교체로 생긴 차이를 해결하지 못한다. 라벨, 배지, 폰트 크기나 safe-area가 바뀌면 별도 보정이 다시 필요해져 제외했다.

## 6. 검증

- 실기기에서 커스텀 버튼 적용 후 탭 아이콘 위치가 기존 배치로 복구된 것을 확인했다.
- Android 리플 없이 누르는 동안 opacity가 감소하는 것을 확인했다.
- 변경 파일에 대해 `oxlint`를 통과했다.
- `tsc --noEmit --noUnusedLocals false`를 통과했다.
- 기본 `tsc --noEmit`은 이번 변경과 무관하게 `src/screens/home/HomeScreen.tsx`의 미사용 `DebugGrid` 때문에 실패했다. 해당 작업은 이 수정 범위에서 건드리지 않았다.

## 7. 교훈

- 라이브러리 컴포넌트를 교체할 때는 보이는 prop뿐 아니라 ref, 접근성, 이벤트, 스타일 합성 방식까지 어댑터의 계약으로 봐야 한다.
- 커스텀 버튼은 터치 피드백만 책임지고, 네비게이션 라이브러리가 계산한 flex, padding, 정렬값은 그대로 보존한다.
- 내부 padding을 숫자로 상쇄하기 전에 기본 컴포넌트와 커스텀 컴포넌트가 스타일을 어떤 형태로 네이티브 뷰에 전달하는지 비교한다.
- 함수형 스타일 자체를 금지할 필요는 없다. 외부 라이브러리가 넘긴 정적 레이아웃을 단순히 전달하는 어댑터라면, 불필요하게 함수형 스타일로 변환하지 않는 것이 안전하다.
- `.oxlintrc.json`의 `no-restricted-imports`가 RN의 `Pressable`, `Button`, `Touchable*` 직접 import를 막는다. 새로운 터치 UI도 공용 `Pressable`을 거치므로 OS별 피드백이 다시 갈라지는 것을 코드 리뷰 전에 발견할 수 있다.
