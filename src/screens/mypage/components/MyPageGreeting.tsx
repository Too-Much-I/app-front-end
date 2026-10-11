import { Image, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { shadows } from '@/theme';

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const wavingRabbit = require('../../../../public/mascots/waving_rabbit.png');

interface MyPageGreetingProps {
  /** 없으면(아직 못 받았거나 비었으면) 닉네임 자리를 빼고 인사한다. */
  nickname: string | null;
}

/** 양손 흔드는 토끼와 인사. 토끼 머리가 카드 위로 올라오게 카드보다 크게 그린다. */
export function MyPageGreeting({ nickname }: MyPageGreetingProps) {
  return (
    <View
      className="h-24 flex-row items-end gap-3 rounded-card bg-surface pl-3 pr-5"
      style={shadows.card}
    >
      <Image
        accessibilityElementsHidden
        className="h-32 w-24"
        resizeMode="contain"
        source={wavingRabbit}
      />
      <View className="min-w-0 flex-1 self-center">
        <Text className="text-xl leading-7">
          {nickname === null ? (
            '안녕하세요!'
          ) : (
            <>
              안녕하세요, <Text className="text-xl leading-7 text-brand-text">{nickname}</Text>님!
            </>
          )}
        </Text>
        <Text className="mt-1 text-base text-ink-muted">오늘도 힘내봐요</Text>
      </View>
    </View>
  );
}
