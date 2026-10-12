import { Feather } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { Text } from '@/components/ui/Text';
import { colors, duration, easings, size, spacing } from '@/theme';

// A short, local burst around the badge, rather than particles across the reading surface.
const BURST_ANGLES = [-145, -90, -35, 35, 90, 145];

/** Overlays the sentence card without changing its size or the fixed controls below it. */
export function LearningShadowSuccess({
  nextLabel,
  displayMs,
}: {
  nextLabel: string;
  displayMs: number;
}) {
  const reduceMotion = useReducedMotion();
  const reveal = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const badgeScale = useRef(new Animated.Value(reduceMotion ? 1 : 0.92)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const copy = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`잘했어요. 다음은 ${nextLabel}입니다.`);
    if (reduceMotion) {
      reveal.setValue(1);
      badgeScale.setValue(1);
      copy.setValue(1);
      return;
    }
    const timing = (value: Animated.Value, toValue: number, milliseconds: number) =>
      Animated.timing(value, {
        toValue,
        duration: milliseconds,
        easing: easings.decelerate,
        useNativeDriver: true,
      });
    const animation = Animated.parallel([
      Animated.sequence([
        timing(reveal, 1, duration.base),
        Animated.delay(Math.max(0, displayMs - duration.base - duration.fast)),
        timing(reveal, 0, duration.fast),
      ]),
      Animated.sequence([
        timing(badgeScale, 1.08, duration.fast),
        timing(badgeScale, 1, duration.fast),
      ]),
      timing(burst, 1, duration.base),
      Animated.sequence([Animated.delay(duration.snap), timing(copy, 1, duration.base)]),
    ]);
    animation.start();
    return () => animation.stop();
  }, [nextLabel, displayMs, reduceMotion, reveal, badgeScale, burst, copy]);
  return (
    <Animated.View
      accessible
      pointerEvents="none"
      accessibilityLabel={`잘했어요. 다음은 ${nextLabel}입니다.`}
      className="absolute inset-0 flex-row items-center justify-center gap-lg bg-brand-50 px-card"
      style={{ opacity: reveal }}
    >
      <View className="h-20 w-20 items-center justify-center">
        {!reduceMotion ? (
          <>
            <Animated.View
              className="absolute h-16 w-16 rounded-pill border-2 border-brand-300"
              style={{
                opacity: burst.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
                transform: [
                  { scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.45] }) },
                ],
              }}
            />
            {BURST_ANGLES.map((angle) => {
              const radians = (angle * Math.PI) / 180;
              return (
                <Animated.View
                  key={angle}
                  className="absolute h-1 w-2 rounded-pill bg-brand-400"
                  style={{
                    opacity: burst.interpolate({
                      inputRange: [0, 0.2, 1],
                      outputRange: [0, 1, 0],
                    }),
                    transform: [
                      {
                        translateX: burst.interpolate({
                          inputRange: [0, 1],
                          outputRange: [
                            Math.cos(radians) * spacing['2xl'],
                            Math.cos(radians) * size.hitTarget,
                          ],
                        }),
                      },
                      {
                        translateY: burst.interpolate({
                          inputRange: [0, 1],
                          outputRange: [
                            Math.sin(radians) * spacing['2xl'],
                            Math.sin(radians) * size.hitTarget,
                          ],
                        }),
                      },
                      { rotate: `${angle}deg` },
                    ],
                  }}
                />
              );
            })}
          </>
        ) : null}
        <Animated.View
          className="h-14 w-14 items-center justify-center rounded-pill bg-brand-cta"
          style={{ transform: [{ scale: badgeScale }] }}
        >
          <Feather name="check" size={size.icon.xl} color={colors.surface.DEFAULT} />
        </Animated.View>
      </View>
      <Animated.View
        className="min-w-0 shrink gap-xs"
        style={{
          opacity: copy,
          transform: [
            {
              translateY: copy.interpolate({
                inputRange: [0, 1],
                outputRange: [reduceMotion ? 0 : spacing.sm, 0],
              }),
            },
          ],
        }}
      >
        <Text className="text-2xl !text-brand-text">잘했어요!</Text>
        <Text className="text-sm text-ink-muted">다음은 {nextLabel}</Text>
      </Animated.View>
    </Animated.View>
  );
}
