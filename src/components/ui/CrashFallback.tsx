import { Image, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다. 웹 에러 화면과 같은 토끼다.
const dizzyRabbit = require('../../../public/mascots/error.png');

/**
 * 렌더 크래시 대체 화면. 웹 `ErrorFallbackScreen`(OOPS!·어지러운 토끼·제목·설명)을 따른다.
 *
 * 버튼은 하나만 둔다(2026-10-11 결정). 뒤로 갈 곳이 있으면 "뒤로 가기", 없으면 "다시 시도하기".
 * 앱 최상단 경계에서는 다시 그리면 첫 화면으로 돌아가 "홈으로"와 같은 동작이라 합쳤다.
 */
export function CrashFallback({
  action,
}: {
  action: { kind: 'go-back' | 'retry'; onPress: () => void };
}) {
  return (
    <SafeAreaView className="flex-1 bg-surface-subtle" edges={['top', 'bottom']}>
      <View accessibilityRole="alert" className="flex-1 items-center justify-center px-screen">
        {/* 웹의 큰 장식 글자(text-7xl)에 맞춘다. 글자 스케일 토큰은 3xl까지라 임의 값을 쓴다. */}
        <Text aria-hidden className="text-[64px] leading-[68px] !text-brand">
          OOPS!
        </Text>
        <Image
          accessibilityLabel="눈이 핑핑 도는 토끼 캐릭터"
          className="-mt-sm h-56 w-32"
          resizeMode="contain"
          source={dizzyRabbit}
        />
        <Text accessibilityRole="header" className="mt-section text-center text-2xl">
          에러가 발생했어요.
        </Text>
        <Text className="mt-md text-center text-sm leading-6 text-ink-muted">
          일시적인 오류일 수 있어요. 잠시 후 다시 시도해 주세요.
        </Text>
        <Button
          className="mt-section"
          label={action.kind === 'go-back' ? '뒤로 가기' : '다시 시도하기'}
          size="lg"
          onPress={action.onPress}
        />
      </View>
    </SafeAreaView>
  );
}
