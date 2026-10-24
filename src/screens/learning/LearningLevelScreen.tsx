import { Feather } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRef, useState } from 'react';
import {
  Animated,
  Image,
  ScrollView,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import type { LearningLevel } from '@/features/learning/learning-level';
import type { MainTabParamList, RootStackParamList } from '@/navigation/types';
import { LEVEL_CARD_ORDER, LEVEL_CARDS } from '@/screens/learning/learning-level-cards';
import { colors, shadows, size, spacing } from '@/theme';

/** 탭 안에서 루트 스택의 파트 화면으로 이동해야 하므로 두 내비게이터를 함께 쓴다. */
type LearningNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Learning'>,
  NativeStackNavigationProp<RootStackParamList>
>;

/**
 * 가운데 카드 양옆으로 이웃 카드가 보이는 폭.
 * 이웃이 보여야 옆으로 넘길 수 있다는 걸 알아챈다. 시안(390px 폭에서 300px 카드)의 비율을 그대로 옮겼다.
 */
const NEIGHBOR_PEEK = 45;
const CARD_GAP = spacing.md;
/** 가운데가 아닌 카드는 조금 작고 흐리게 둬서 지금 고른 카드가 어느 것인지 보이게 한다. */
const SIDE_CARD_SCALE = 0.92;
const SIDE_CARD_OPACITY = 0.6;
/** 세 캐릭터의 높이를 같게 맞춘다. 폭은 각 그림의 비율이 정한다. */
const MASCOT_HEIGHT = 200;

export function LearningLevelScreen() {
  const navigation = useNavigation<LearningNavigationProp>();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth - NEIGHBOR_PEEK * 2;
  const snapInterval = cardWidth + CARD_GAP;

  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [activeIndex, setActiveIndex] = useState(0);

  const activeLevel: LearningLevel = LEVEL_CARD_ORDER[activeIndex] ?? LEVEL_CARD_ORDER[0];
  const activeCard = LEVEL_CARDS[activeLevel];

  // 넘기는 도중에도 버튼 색이 따라 바뀌도록 멈출 때가 아니라 움직일 때마다 가장 가까운 카드를 고른다.
  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
    useNativeDriver: true,
    listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nearest = Math.round(event.nativeEvent.contentOffset.x / snapInterval);
      const clamped = Math.min(Math.max(nearest, 0), LEVEL_CARD_ORDER.length - 1);
      setActiveIndex((current) => (current === clamped ? current : clamped));
    },
  });

  function startLevel(level: LearningLevel) {
    navigation.navigate('LearningParts', { level });
  }

  function scrollToCard(index: number) {
    const clamped = Math.min(Math.max(index, 0), LEVEL_CARD_ORDER.length - 1);
    scrollRef.current?.scrollTo({ x: clamped * snapInterval, animated: true });
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-surface-subtle">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-section">
        <View className="gap-xs px-screen pt-section">
          <Text accessibilityRole="header" className="text-2xl">
            어느 수준으로 말해 볼까요?
          </Text>
          <Text className="text-sm text-ink-muted">트랙별로 학습하는 답변의 수준이 달라져요</Text>
        </View>

        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          // 한 번 넘기면 한 장만 움직이게 한다. 세 장뿐이라 세게 넘겨 끝까지 날아가면 가운데를 건너뛴다.
          decelerationRate="fast"
          disableIntervalMomentum
          showsHorizontalScrollIndicator={false}
          snapToInterval={snapInterval}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          contentContainerStyle={{
            paddingHorizontal: NEIGHBOR_PEEK,
            paddingVertical: spacing.lg,
            gap: CARD_GAP,
          }}
        >
          {LEVEL_CARD_ORDER.map((level, index) => {
            const card = LEVEL_CARDS[level];
            const inputRange = [
              (index - 1) * snapInterval,
              index * snapInterval,
              (index + 1) * snapInterval,
            ];
            return (
              <Animated.View
                key={level}
                className="overflow-hidden rounded-chip bg-surface"
                style={[
                  shadows.card,
                  {
                    width: cardWidth,
                    opacity: scrollX.interpolate({
                      inputRange,
                      outputRange: [SIDE_CARD_OPACITY, 1, SIDE_CARD_OPACITY],
                      extrapolate: 'clamp',
                    }),
                    transform: [
                      {
                        scale: scrollX.interpolate({
                          inputRange,
                          outputRange: [SIDE_CARD_SCALE, 1, SIDE_CARD_SCALE],
                          extrapolate: 'clamp',
                        }),
                      },
                    ],
                  },
                ]}
              >
                {/*
                  가운데 카드를 누르면 아래 버튼과 같이 파트 화면으로 간다. 옆 카드를 누르면 바로 들어가지 않고
                  가운데로 옮긴다 — 넘기다 스친 카드로 원하지 않은 등급에 들어가지 않게 한다(2026-10-23).
                */}
                <Pressable
                  accessibilityHint={
                    index === activeIndex
                      ? '파트를 고르는 화면으로 이동합니다'
                      : '이 카드를 가운데로 옮깁니다'
                  }
                  accessibilityLabel={`${card.label}. ${card.exampleAnswer}`}
                  accessibilityRole="button"
                  className="flex-1"
                  onPress={() => (index === activeIndex ? startLevel(level) : scrollToCard(index))}
                >
                  <View
                    className="items-center justify-center py-lg"
                    style={{ backgroundColor: card.color }}
                  >
                    <Image
                      accessibilityLabel={card.mascotLabel}
                      source={card.mascot}
                      resizeMode="contain"
                      style={{
                        height: MASCOT_HEIGHT,
                        width: MASCOT_HEIGHT * card.mascotAspectRatio,
                      }}
                    />
                  </View>
                  <View className="flex-1 gap-element p-card">
                    <View>
                      <Text className="text-3xl">{card.label}</Text>
                      <Text className="text-xs text-ink-muted">{card.tag}</Text>
                    </View>
                    <Text className="text-sm">{card.exampleAnswer}</Text>
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
        </Animated.ScrollView>

        <View className="flex-row items-center justify-center gap-lg">
          <Pressable
            accessibilityLabel="이전 등급"
            accessibilityRole="button"
            className="h-11 w-11 items-center justify-center"
            disabled={activeIndex === 0}
            onPress={() => scrollToCard(activeIndex - 1)}
          >
            <Feather name="chevron-left" size={size.icon.md} color={colors.ink.muted} />
          </Pressable>
          <View className="flex-row items-center gap-content">
            {LEVEL_CARD_ORDER.map((level, index) => (
              <Pressable
                key={level}
                accessibilityLabel={`${LEVEL_CARDS[level].label} 카드로 이동`}
                accessibilityRole="button"
                accessibilityState={{ selected: index === activeIndex }}
                hitSlop={spacing.md}
                className={
                  index === activeIndex
                    ? 'h-2 w-6 rounded-pill bg-ink'
                    : 'h-2 w-2 rounded-pill bg-line'
                }
                onPress={() => scrollToCard(index)}
              />
            ))}
          </View>
          <Pressable
            accessibilityLabel="다음 등급"
            accessibilityRole="button"
            className="h-11 w-11 items-center justify-center"
            disabled={activeIndex === LEVEL_CARD_ORDER.length - 1}
            onPress={() => scrollToCard(activeIndex + 1)}
          >
            <Feather name="chevron-right" size={size.icon.md} color={colors.ink.muted} />
          </Pressable>
        </View>

        {/*
          공용 Button은 색을 variant로만 고르는데, 이 버튼은 가운데 카드의 색을 따라 세 가지로 바뀐다.
          등급 색을 Button variant로 올리면 공용 버튼이 학습 등급을 알게 되므로 이 화면에서 직접 그린다.
        */}
        <Pressable
          accessibilityHint="파트를 고르는 화면으로 이동합니다"
          accessibilityRole="button"
          className="mx-screen mt-content min-h-control-lg items-center justify-center rounded-control"
          style={[shadows.card, { backgroundColor: activeCard.color }]}
          onPress={() => startLevel(activeLevel)}
        >
          <Text className="text-base">{activeCard.label} 답변으로 연습하기</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
