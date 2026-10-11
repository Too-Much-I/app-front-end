import { Image, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { shadows } from '@/theme';

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const wavingRabbit = require('../../../../public/mascots/waving_rabbit.png');

interface MyPageGreetingProps {
  /** 없으면(아직 못 받았거나 비었으면) 닉네임 자리를 빼고 인사한다. */
  nickname: string | null;
}

/**
 * 양손 흔드는 토끼와 인사. 토끼 머리가 카드 위로 올라오게 카드보다 크게 그린다.
 *
 * 카드 높이는 최소값만 둔다. `Text`는 기기 글씨 크기 설정을 따르므로, 글씨가 커지거나 닉네임이
 * 여러 줄로 감기면 문구가 높이를 밀어 올려야 다음 영역과 겹치지 않는다. 토끼는 카드 아래에
 * 붙어 있어서(`items-end`) 카드가 낮을 때만 위로 솟고, 카드가 커지면 그 안에 들어간다.
 */
export function MyPageGreeting({ nickname }: MyPageGreetingProps) {
  return (
    <View
      className="min-h-24 flex-row items-end gap-3 rounded-card bg-surface pl-3 pr-5"
      style={shadows.card}
    >
      <Image
        accessibilityElementsHidden
        className="h-32 w-24"
        resizeMode="contain"
        source={wavingRabbit}
      />
      <View className="min-w-0 flex-1 self-center py-4">
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
