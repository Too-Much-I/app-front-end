# 설정 화면 신설 및 마이페이지 제거 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 하단 탭에서 마이페이지를 제거하고, 홈 화면 알림 벨 옆에 설정 아이콘을 추가해 새 설정 화면(루트 스택 push 화면)으로 진입하게 만든다.

**Architecture:** 탭 파라미터 타입에서 `MyPage`를 제거하고 루트 스택 파라미터 타입에 `Settings`를 추가한다. 설정 화면은 `Reanswer`와 동일하게 탭 위에 push되는 루트 스택 화면이며, `src/screens/settings/`에 화면과 2개의 재사용 하위 컴포넌트(행, 섹션)로 구성한다. 홈 화면은 탭+루트 스택을 함께 참조하는 `CompositeNavigationProp`으로 설정 화면에 진입한다(`FeedbackScreen`과 동일 패턴).

**Tech Stack:** Expo/React Native, TypeScript(strict), React Navigation(bottom-tabs + native-stack), NativeWind(className), `@expo/vector-icons`(Feather).

## Global Constraints

- `pnpm`을 사용한다. npm/yarn 락파일을 만들지 않는다.
- 공용 `src/components/ui/Text.tsx`, `src/components/ui/Pressable.tsx`만 쓴다. RN 기본 `Text`/`Pressable`을 직접 쓰지 않는다(단, `Switch`는 공용 대체 컴포넌트가 없어 RN 기본을 그대로 쓴다).
- 색상/그림자/폰트는 `src/theme`의 토큰만 쓴다. 화면에 하드코딩된 hex를 흩뿌리지 않는다.
- 이 저장소에는 **자동화된 테스트 러너가 아직 없다**(`AGENTS.md`). 각 태스크의 검증은 `pnpm exec tsc --noEmit` / `pnpm lint`와 수동 확인으로 대체하고, 태스크마다 "Write the failing test" 스텝은 생략한다.
- 커밋 메시지는 한국어로, Conventional Commit 타입+스코프를 소문자 영어로 쓴다(예: `feat(settings): ...`).
- 이번 범위에는 마이크 테스트/음향 테스트 행을 포함하지 않는다(설계 문서 `docs/superpowers/specs/2026-08-04-settings-screen-design.md`에서 확정).

---

### Task 1: 탭 구조에서 마이페이지 제거

**Files:**
- Modify: `src/navigation/types.ts`
- Modify: `src/navigation/MainTabNavigator.tsx`

**Interfaces:**
- Consumes: 없음(기존 타입/컴포넌트 정리).
- Produces: `MainTabParamList`에 더 이상 `MyPage` 키가 없다. 이후 태스크에서 `MainTabParamList`를 참조하는 코드는 `Home | MockExam | Feedback`만 가정할 수 있다.

- [ ] **Step 1: `MainTabParamList`에서 `MyPage` 제거**

`src/navigation/types.ts`의 `MainTabParamList`에서 아래 줄을 삭제한다.

```ts
  MyPage: undefined;
```

변경 후 `MainTabParamList`는 다음과 같아야 한다:

```ts
export type MainTabParamList = {
  Home: undefined;
  MockExam: undefined;
  /**
   * 피드백 웹뷰. `examId`만 있으면 종합 피드백을, `questionNumber`가 함께 오면 해당 문제의
   * 문제별 피드백을 연다. 최초 답변은 회차를 생략하고 재답변 결과는 `retryCount`로 특정한다.
   */
  Feedback:
    | { examId?: string; questionNumber?: number; retryCount?: number }
    | undefined;
};
```

- [ ] **Step 2: `MainTabNavigator.tsx`에서 마이페이지 탭 제거**

`src/navigation/MainTabNavigator.tsx`에서 `MyPageScreen` import를 삭제한다.

변경 전:
```ts
import { FeedbackScreen } from "@/screens/feedback/FeedbackScreen";
import { HomeScreen } from "@/screens/home/HomeScreen";
import { MyPageScreen } from "@/screens/my-page/MyPageScreen";
import { MockExamStackNavigator } from "@/navigation/MockExamStackNavigator";
```

변경 후:
```ts
import { FeedbackScreen } from "@/screens/feedback/FeedbackScreen";
import { HomeScreen } from "@/screens/home/HomeScreen";
import { MockExamStackNavigator } from "@/navigation/MockExamStackNavigator";
```

같은 파일의 `TAB_CONFIG`에서 마이페이지 항목을 제거한다.

변경 전:
```ts
const TAB_CONFIG: TabConfig[] = [
  { name: "Home", title: "홈", icon: "home", component: HomeScreen },
  { name: "MockExam", title: "모의고사", icon: "clipboard", component: MockExamStackNavigator },
  { name: "Feedback", title: "피드백", icon: "message-circle", component: FeedbackScreen },
  { name: "MyPage", title: "마이페이지", icon: "user", component: MyPageScreen },
];
```

변경 후:
```ts
const TAB_CONFIG: TabConfig[] = [
  { name: "Home", title: "홈", icon: "home", component: HomeScreen },
  { name: "MockExam", title: "모의고사", icon: "clipboard", component: MockExamStackNavigator },
  { name: "Feedback", title: "피드백", icon: "message-circle", component: FeedbackScreen },
];
```

- [ ] **Step 3: 타입 체크로 확인**

Run: `pnpm exec tsc --noEmit`
Expected: 에러 없음. (이 시점에는 `src/screens/my-page/MyPageScreen.tsx`가 아직 남아있지만 어디서도 참조하지 않으므로 그 자체로는 에러가 나지 않는다.)

- [ ] **Step 4: 커밋**

```bash
git add src/navigation/types.ts src/navigation/MainTabNavigator.tsx
git commit -m "feat(navigation): 하단 탭에서 마이페이지 제거"
```

---

### Task 2: `SettingsRow` 컴포넌트 생성

**Files:**
- Create: `src/screens/settings/components/SettingsRow.tsx`

**Interfaces:**
- Consumes: `@/components/ui/Pressable`, `@/components/ui/Text`, `@/theme`(`colors`), `@expo/vector-icons`(`Feather`).
- Produces: `export function SettingsRow(props: SettingsRowProps)`와 `export type SettingsIconName = ComponentProps<typeof Feather>["name"]`. `SettingsRowProps`는 `{ icon: SettingsIconName; title: string; description?: string; onPress?: () => void; trailing?: ReactNode; destructive?: boolean; showDivider?: boolean }`. `onPress`가 없으면 누를 수 없는 정보 행(예: 버전 정보)으로 렌더링된다. `trailing` 기본값은 `chevron-right` 아이콘이다.

- [ ] **Step 1: 컴포넌트 작성**

`src/screens/settings/components/SettingsRow.tsx` 새 파일:

```tsx
import { Feather } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { colors } from "@/theme";

export type SettingsIconName = ComponentProps<typeof Feather>["name"];

type SettingsRowProps = {
  icon: SettingsIconName;
  title: string;
  description?: string;
  /** 없으면 누를 수 없는 정보 행(예: 버전 정보)으로 렌더링된다. */
  onPress?: () => void;
  trailing?: ReactNode;
  destructive?: boolean;
  showDivider?: boolean;
};

const DEFAULT_TRAILING = (
  <Feather name="chevron-right" size={20} color={colors.ink.disabled} />
);

export function SettingsRow({
  icon,
  title,
  description,
  onPress,
  trailing = DEFAULT_TRAILING,
  destructive = false,
  showDivider = true,
}: SettingsRowProps) {
  const badgeBackground = destructive ? colors.feedback.improvementSoft : colors.brand[100];
  const badgeColor = destructive ? colors.feedback.improvement : colors.brand.DEFAULT;
  const titleColor = destructive ? colors.feedback.improvement : colors.ink.DEFAULT;
  const rowClassName = `flex-row items-center gap-3 py-4 ${
    showDivider ? "border-b border-line" : ""
  }`;

  const content = (
    <>
      <View
        className="h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: badgeBackground }}
      >
        <Feather name={icon} size={18} color={badgeColor} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-base" style={{ color: titleColor }}>
          {title}
        </Text>
        {description ? (
          <Text className="mt-1 text-xs text-ink-muted">{description}</Text>
        ) : null}
      </View>
      {trailing}
    </>
  );

  if (!onPress) {
    return <View className={rowClassName}>{content}</View>;
  }

  return (
    <Pressable accessibilityLabel={title} className={rowClassName} onPress={onPress}>
      {content}
    </Pressable>
  );
}
```

- [ ] **Step 2: 타입 체크로 확인**

Run: `pnpm exec tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/screens/settings/components/SettingsRow.tsx
git commit -m "feat(settings): 설정 행 공용 컴포넌트 추가"
```

---

### Task 3: `SettingsSection` 컴포넌트 생성

**Files:**
- Create: `src/screens/settings/components/SettingsSection.tsx`

**Interfaces:**
- Consumes: `@/components/ui/Text`, `@/theme`(`shadows`).
- Produces: `export function SettingsSection({ title, children }: { title: string; children: ReactNode })`. 섹션 제목 + 흰 카드(그림자·테두리)로 `children`(`SettingsRow` 목록)을 감싼다.

- [ ] **Step 1: 컴포넌트 작성**

`src/screens/settings/components/SettingsSection.tsx` 새 파일:

```tsx
import type { ReactNode } from "react";
import { View } from "react-native";

import { Text } from "@/components/ui/Text";
import { shadows } from "@/theme";

type SettingsSectionProps = {
  title: string;
  children: ReactNode;
};

export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <View className="mt-8">
      <Text accessibilityRole="header" className="text-lg">
        {title}
      </Text>
      <View
        className="mt-3 overflow-hidden rounded-3xl border border-line bg-surface px-4"
        style={shadows.card}
      >
        {children}
      </View>
    </View>
  );
}
```

- [ ] **Step 2: 타입 체크로 확인**

Run: `pnpm exec tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/screens/settings/components/SettingsSection.tsx
git commit -m "feat(settings): 설정 섹션 공용 컴포넌트 추가"
```

---

### Task 4: `Settings` 라우트 타입 추가 및 `SettingsScreen` 생성

**Files:**
- Modify: `src/navigation/types.ts`
- Create: `src/screens/settings/SettingsScreen.tsx`

**Interfaces:**
- Consumes: Task 2의 `SettingsRow`(`icon`, `title`, `description?`, `onPress?`, `trailing?`, `destructive?`, `showDivider?`), Task 3의 `SettingsSection`(`title`, `children`).
- Produces: `RootStackParamList`에 `Settings: undefined` 추가. `export function SettingsScreen(props: NativeStackScreenProps<RootStackParamList, "Settings">)` — 이후 태스크에서 `RootNavigator`가 `component={SettingsScreen}`으로 등록한다.

- [ ] **Step 1: `RootStackParamList`에 `Settings` 추가**

`src/navigation/types.ts`의 `RootStackParamList`를 수정한다.

변경 전:
```ts
export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  /**
   * 재답변 녹음 화면. 웹 문제별 피드백의 `REANSWER_REQUESTED`가 준 값을 그대로 받는다.
   * `nextRetryCount`는 0-base 회차 인덱스이며 앱이 다시 계산하지 않는다.
   *
   * 피드백은 탭 화면(웹뷰)이고 이 화면은 탭 위를 덮어야 하므로 루트 스택에 둔다.
   */
  Reanswer: {
    examId: string;
    questionNumber: number;
    nextRetryCount: number;
  };
};
```

변경 후:
```ts
export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  /**
   * 재답변 녹음 화면. 웹 문제별 피드백의 `REANSWER_REQUESTED`가 준 값을 그대로 받는다.
   * `nextRetryCount`는 0-base 회차 인덱스이며 앱이 다시 계산하지 않는다.
   *
   * 피드백은 탭 화면(웹뷰)이고 이 화면은 탭 위를 덮어야 하므로 루트 스택에 둔다.
   */
  Reanswer: {
    examId: string;
    questionNumber: number;
    nextRetryCount: number;
  };
  /** 설정 화면. 탭이 아니라 홈 화면 헤더 아이콘으로 진입하는 루트 스택 push 화면이다. */
  Settings: undefined;
};
```

- [ ] **Step 2: `SettingsScreen` 작성**

`src/screens/settings/SettingsScreen.tsx` 새 파일:

```tsx
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Image, ScrollView, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import type { RootStackParamList } from "@/navigation/types";
import { SettingsRow } from "@/screens/settings/components/SettingsRow";
import { SettingsSection } from "@/screens/settings/components/SettingsSection";
import { colors, shadows } from "@/theme";

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const encouragementMascot = require("../../../public/mascots/greeting_rabbit.png");

type SettingsScreenProps = NativeStackScreenProps<RootStackParamList, "Settings">;

export function SettingsScreen({ navigation }: SettingsScreenProps) {
  const [isStudyReminderEnabled, setStudyReminderEnabled] = useState(true);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface-subtle">
      <View className="h-16 flex-row items-center px-5">
        <Pressable
          accessibilityLabel="뒤로 가기"
          className="h-10 w-10 items-center justify-center rounded-full"
          hitSlop={8}
          onPress={navigation.goBack}
        >
          <Feather name="arrow-left" size={24} color={colors.ink.DEFAULT} />
        </Pressable>
        <Text className="ml-2 text-2xl">설정</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-5 pb-10 pt-2">
          <View
            className="flex-row items-center gap-4 overflow-hidden rounded-3xl border border-line bg-brand-50 p-5"
            style={shadows.card}
          >
            <View className="min-w-0 flex-1">
              <Text className="text-xs" style={{ color: colors.brand.text }}>
                토선생의 한마디
              </Text>
              <Text className="mt-1 text-lg leading-7">
                오늘도 꾸준히 연습하면{"\n"}점수는 반드시 올라가요!
              </Text>
              <Text className="mt-2 text-sm text-ink-muted">
                토선생이 항상 응원할게요 🧡
              </Text>
            </View>
            <Image
              source={encouragementMascot}
              className="h-32 w-24"
              resizeMode="contain"
              accessible={false}
            />
          </View>

          <SettingsSection title="학습 설정">
            <SettingsRow
              description="오늘의 문제 및 학습 리마인드 알림을 받아요."
              icon="bell"
              showDivider={false}
              title="학습 알림"
              trailing={
                <Switch
                  onValueChange={setStudyReminderEnabled}
                  trackColor={{ false: colors.line.DEFAULT, true: colors.brand.DEFAULT }}
                  value={isStudyReminderEnabled}
                />
              }
            />
          </SettingsSection>

          <SettingsSection title="서비스">
            <SettingsRow
              icon="file-text"
              // TODO: 개인정보 처리방침 화면/링크가 생기면 연결
              onPress={() => console.log("[Settings] 개인정보 처리방침 press")}
              title="개인정보 처리방침"
            />
            <SettingsRow
              icon="clipboard"
              // TODO: 이용약관 화면/링크가 생기면 연결
              onPress={() => console.log("[Settings] 이용약관 press")}
              title="이용약관"
            />
            <SettingsRow
              description="버그 제보 및 기능 제안을 할 수 있어요."
              icon="message-circle"
              // TODO: 문의하기 화면/링크가 생기면 연결
              onPress={() => console.log("[Settings] 문의하기 press")}
              title="문의하기"
            />
            <SettingsRow
              description="토선생에게 별점을 남겨주세요!"
              icon="star"
              // TODO: 스토어 리뷰 링크가 생기면 연결
              onPress={() => console.log("[Settings] 앱 평가하기 press")}
              title="앱 평가하기"
            />
            <SettingsRow
              icon="info"
              showDivider={false}
              title="버전 정보"
              trailing={<Text className="text-sm text-ink-muted">v1.0.0</Text>}
            />
          </SettingsSection>

          <SettingsSection title="데이터 관리">
            <SettingsRow
              description="삭제 후 복구할 수 없으니 신중히 선택해주세요."
              destructive
              icon="trash-2"
              // TODO: 실제 삭제 로직과 확인 다이얼로그가 생기면 연결
              onPress={() => console.log("[Settings] 모든 학습 기록 삭제 press")}
              showDivider={false}
              title="모든 학습 기록 삭제"
            />
          </SettingsSection>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: 타입 체크로 확인**

Run: `pnpm exec tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git add src/navigation/types.ts src/screens/settings/SettingsScreen.tsx
git commit -m "feat(settings): 설정 화면 라우트 타입 및 화면 추가"
```

---

### Task 5: `RootNavigator`에 `SettingsScreen` 등록

**Files:**
- Modify: `src/navigation/RootNavigator.tsx`

**Interfaces:**
- Consumes: Task 4의 `SettingsScreen`.
- Produces: 루트 스택에 `Settings` 화면이 등록되어 어떤 화면에서든 `navigation.navigate("Settings")`로 진입할 수 있다.

- [ ] **Step 1: import 및 `Stack.Screen` 추가**

`src/navigation/RootNavigator.tsx` 전체를 다음으로 바꾼다.

```tsx
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { MainTabNavigator } from "@/navigation/MainTabNavigator";
import type { RootStackParamList } from "@/navigation/types";
import { ReanswerScreen } from "@/screens/reanswer/ReanswerScreen";
import { SettingsScreen } from "@/screens/settings/SettingsScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      {/* 녹음 중 스와이프로 빠져나가면 확인 없이 녹음이 사라지므로 제스처를 막는다. */}
      <Stack.Screen
        name="Reanswer"
        component={ReanswerScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}
```

- [ ] **Step 2: 타입 체크로 확인**

Run: `pnpm exec tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/navigation/RootNavigator.tsx
git commit -m "feat(settings): 루트 내비게이터에 설정 화면 등록"
```

---

### Task 6: 홈 화면 헤더에 설정 아이콘 추가

**Files:**
- Modify: `src/screens/home/HomeScreen.tsx`

**Interfaces:**
- Consumes: Task 5까지 등록된 `Settings` 루트 스택 화면.
- Produces: 홈 화면 헤더의 알림 벨 오른쪽에 설정 아이콘이 생기고, 누르면 `navigation.navigate("Settings")`가 호출된다.

- [ ] **Step 1: import 수정**

`src/screens/home/HomeScreen.tsx` 상단 import를 다음과 같이 바꾼다.

변경 전:
```ts
import { AntDesign, Feather } from "@expo/vector-icons";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import { Image, ScrollView, Text as RNText, View, type LayoutChangeEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { Sparkle, type SparkleProps } from "@/components/ui/Sparkle";
import { Text } from "@/components/ui/Text";
import { TickingClock } from "@/components/ui/TickingClock";
import type { MainTabParamList } from "@/navigation/types";
import { RECENT_FEEDBACK } from "@/screens/home/mocks/recent-feedback";
import { colors, shadows } from "@/theme";
```

변경 후:
```ts
import { AntDesign, Feather } from "@expo/vector-icons";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useNavigation, type CompositeNavigationProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { Image, ScrollView, Text as RNText, View, type LayoutChangeEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { Sparkle, type SparkleProps } from "@/components/ui/Sparkle";
import { Text } from "@/components/ui/Text";
import { TickingClock } from "@/components/ui/TickingClock";
import type { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { RECENT_FEEDBACK } from "@/screens/home/mocks/recent-feedback";
import { colors, shadows } from "@/theme";
```

- [ ] **Step 2: 내비게이션 타입 수정**

변경 전:
```ts
type HomeNavigationProp = BottomTabNavigationProp<MainTabParamList, "Home">;
```

변경 후:
```ts
/** 탭 안에서 루트 스택의 설정 화면으로 이동해야 하므로 두 내비게이터를 함께 쓴다. */
type HomeNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "Home">,
  NativeStackNavigationProp<RootStackParamList>
>;
```

- [ ] **Step 3: 헤더에 설정 아이콘 추가**

`src/screens/home/HomeScreen.tsx`의 헤더 알림 벨 블록을 찾는다.

변경 전:
```tsx
            <Pressable
              className="h-10 w-10 items-center justify-center rounded-full"
              // TODO: 알림 화면 라우트가 생기면 연결
              onPress={() => console.log("[Home] 알림 버튼 press")}
            >
              <View>
                <Feather name="bell" size={22} color={colors.ink.DEFAULT} />
                <View className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-brand" />
              </View>
            </Pressable>
```

변경 후:
```tsx
            <View className="flex-row items-center gap-1">
              <Pressable
                className="h-10 w-10 items-center justify-center rounded-full"
                // TODO: 알림 화면 라우트가 생기면 연결
                onPress={() => console.log("[Home] 알림 버튼 press")}
              >
                <View>
                  <Feather name="bell" size={22} color={colors.ink.DEFAULT} />
                  <View className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-brand" />
                </View>
              </Pressable>
              <Pressable
                accessibilityLabel="설정"
                className="h-10 w-10 items-center justify-center rounded-full"
                onPress={() => navigation.navigate("Settings")}
              >
                <Feather name="settings" size={22} color={colors.ink.DEFAULT} />
              </Pressable>
            </View>
```

- [ ] **Step 4: 타입 체크로 확인**

Run: `pnpm exec tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 5: 수동 확인**

Run: `pnpm start` 후 iOS 시뮬레이터/Expo Go에서 홈 화면 진입.
Expected: 알림 벨 오른쪽에 톱니바퀴 아이콘이 보이고, 누르면 설정 화면으로 이동한다. 설정 화면 좌측 상단 뒤로가기를 누르면 홈으로 돌아온다.

- [ ] **Step 6: 커밋**

```bash
git add src/screens/home/HomeScreen.tsx
git commit -m "feat(home): 헤더에 설정 아이콘 추가"
```

---

### Task 7: 마이페이지 화면 삭제

**Files:**
- Delete: `src/screens/my-page/MyPageScreen.tsx`

**Interfaces:**
- Consumes: 없음 — Task 1에서 이미 유일한 참조처(`MainTabNavigator.tsx`)를 정리했다.
- Produces: `src/screens/my-page/` 디렉터리가 저장소에서 사라진다.

- [ ] **Step 1: 참조가 없는지 확인**

Run: `grep -rn "my-page\|MyPageScreen" src`
Expected: 결과 없음(0줄).

- [ ] **Step 2: 파일과 빈 디렉터리 삭제**

```bash
git rm src/screens/my-page/MyPageScreen.tsx
rmdir src/screens/my-page
```

- [ ] **Step 3: 타입 체크로 확인**

Run: `pnpm exec tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git commit -m "chore(settings): 마이페이지 화면 삭제"
```

---

### Task 8: 최종 검증

**Files:**
- (검증만, 코드 변경 없음)

**Interfaces:**
- Consumes: Task 1~7의 모든 결과물.
- Produces: 없음.

- [ ] **Step 1: 린트**

Run: `pnpm lint`
Expected: 에러 없음.

- [ ] **Step 2: 타입 체크**

Run: `pnpm exec tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 수동 회귀 확인**

Run: `pnpm start` 후 iOS 시뮬레이터/Expo Go에서 아래를 확인한다.

Expected:
- 하단 탭이 홈 / 모의고사 / 피드백 3개다(마이페이지 탭이 없다).
- 홈 헤더에 알림 벨과 설정 아이콘이 나란히 보인다.
- 설정 아이콘을 누르면 설정 화면이 열리고, 히어로 카드·학습 설정(알림 토글 1행)·서비스(5행)·데이터 관리(1행) 섹션이 목업과 같은 순서로 보인다.
- 학습 알림 토글이 켜짐/꺼짐으로 반응한다(저장은 되지 않아도 됨).
- 서비스/데이터 관리 각 행을 눌렀을 때 앱이 죽지 않고 콘솔에 `[Settings] ...press` 로그가 찍힌다.
- 뒤로가기 화살표로 홈으로 돌아온다.

- [ ] **Step 4: 검증 결과 요약 보고**

이 태스크는 커밋하지 않는다 — 사람에게 위 확인 결과를 보고한다.
