import { memo, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import type { LearningWordState } from '@/features/learning/learning-playback-words';
import { duration, easings } from '@/theme';

const LearningWordBox = memo(function LearningWordBox({
  word,
  state,
  hidden,
  showInitials,
  reduceMotion,
}: {
  word: string;
  state: LearningWordState;
  hidden: boolean;
  showInitials: boolean;
  reduceMotion: boolean;
}) {
  const completedOpacity = useRef(new Animated.Value(state === 'pending' ? 0 : 1)).current;
  const activeOpacity = useRef(new Animated.Value(state === 'active' ? 1 : 0)).current;
  useEffect(() => {
    const completed = state === 'pending' ? 0 : 1;
    const active = state === 'active' ? 1 : 0;
    if (reduceMotion) {
      completedOpacity.setValue(completed);
      activeOpacity.setValue(active);
      return;
    }
    // Opacity stays on the native driver. Rapid word changes retarget the current fade.
    const transition = Animated.parallel([
      Animated.timing(completedOpacity, {
        toValue: completed,
        duration: duration.fast,
        easing: easings.decelerate,
        useNativeDriver: true,
      }),
      Animated.timing(activeOpacity, {
        toValue: active,
        duration: active ? duration.fast : duration.base,
        easing: easings.decelerate,
        useNativeDriver: true,
      }),
    ]);
    transition.start();
    return () => transition.stop();
  }, [state, reduceMotion, completedOpacity, activeOpacity]);
  return (
    <View className="relative">
      {/* This base reserves the size; the two color layers never participate in layout. */}
      <View className="rounded-chip border border-line bg-surface-muted px-xs">
        <Text className={`text-[22px] leading-8 !text-ink-muted ${hidden ? 'opacity-0' : ''}`}>
          {word}
        </Text>
        {hidden && showInitials ? (
          <Text
            accessible={false}
            className="absolute left-xs top-0 text-[22px] leading-8 !text-ink-muted"
          >
            {word.match(/[a-z0-9]/i)?.[0] ?? ''}
          </Text>
        ) : null}
      </View>
      <Animated.View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="absolute inset-0 rounded-chip border border-brand-300 bg-brand-50 px-xs"
        style={{ opacity: completedOpacity }}
      >
        <Text className="text-[22px] leading-8 !text-brand-text">{word}</Text>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="absolute inset-0 rounded-chip border border-brand-700 bg-brand-700 px-xs"
        style={{ opacity: activeOpacity }}
      >
        <Text className="text-[22px] leading-8 !text-white">{word}</Text>
      </Animated.View>
    </View>
  );
});

export function LearningWordBoxes({
  words,
  states,
  hidden,
  showInitials = false,
  accessibilityLabel,
}: {
  words: readonly string[];
  states: readonly LearningWordState[];
  hidden?: ReadonlySet<number>;
  showInitials?: boolean;
  accessibilityLabel?: string;
}) {
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let mounted = true;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? words.join(' ')}
      className="flex-row flex-wrap gap-xs"
    >
      {words.map((word, index) => (
        <LearningWordBox
          key={`${index}:${word}`}
          word={word}
          state={states[index] ?? 'pending'}
          hidden={hidden?.has(index) ?? false}
          showInitials={showInitials}
          reduceMotion={reduceMotion}
        />
      ))}
    </View>
  );
}
