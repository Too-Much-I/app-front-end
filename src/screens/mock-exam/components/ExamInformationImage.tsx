import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  Modal,
  PanResponder,
  type NativeTouchEvent,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { colors } from "@/theme";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2;
const DOUBLE_TAP_DELAY_MS = 300;
const TAP_MOVEMENT_THRESHOLD = 10;

type LoadState = "loading" | "loaded" | "error";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function touchDistance(touches: readonly NativeTouchEvent[]): number | undefined {
  const [first, second] = touches;
  if (!first || !second) return undefined;
  return Math.hypot(second.pageX - first.pageX, second.pageY - first.pageY);
}

function ZoomableImage({ imageUrl }: { imageUrl: string }) {
  const scale = useRef(new Animated.Value(MIN_SCALE)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scaleRef = useRef(MIN_SCALE);
  const translationRef = useRef({ x: 0, y: 0 });
  const viewportRef = useRef({ width: 1, height: 1 });
  const lastTouchRef = useRef<{ x: number; y: number } | undefined>(undefined);
  const lastDistanceRef = useRef<number | undefined>(undefined);
  const lastTouchCountRef = useRef(0);
  const gestureStartedAtRef = useRef(0);
  const gestureMovementRef = useRef(0);
  const hadMultipleTouchesRef = useRef(false);
  const lastTapAtRef = useRef(0);

  const setTranslation = useCallback(
    (x: number, y: number, nextScale = scaleRef.current) => {
      const maxX = (viewportRef.current.width * (nextScale - 1)) / 2;
      const maxY = (viewportRef.current.height * (nextScale - 1)) / 2;
      const nextX = clamp(x, -maxX, maxX);
      const nextY = clamp(y, -maxY, maxY);
      translationRef.current = { x: nextX, y: nextY };
      translateX.setValue(nextX);
      translateY.setValue(nextY);
    },
    [translateX, translateY],
  );

  const animateTo = useCallback(
    (nextScale: number) => {
      scaleRef.current = nextScale;
      translationRef.current = { x: 0, y: 0 };
      Animated.parallel([
        Animated.timing(scale, {
          toValue: nextScale,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [scale, translateX, translateY],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          scale.stopAnimation();
          translateX.stopAnimation();
          translateY.stopAnimation();
          const touches = event.nativeEvent.touches;
          const firstTouch = touches[0];
          lastTouchRef.current = firstTouch
            ? { x: firstTouch.pageX, y: firstTouch.pageY }
            : undefined;
          lastDistanceRef.current = touchDistance(touches);
          lastTouchCountRef.current = touches.length;
          gestureStartedAtRef.current = Date.now();
          gestureMovementRef.current = 0;
          hadMultipleTouchesRef.current = touches.length > 1;
        },
        onPanResponderMove: (event) => {
          const touches = event.nativeEvent.touches;
          const touchCount = touches.length;

          if (touchCount >= 2) {
            hadMultipleTouchesRef.current = true;
            const distance = touchDistance(touches);
            const previousDistance = lastDistanceRef.current;
            if (distance && previousDistance) {
              const nextScale = clamp(
                scaleRef.current * (distance / previousDistance),
                MIN_SCALE,
                MAX_SCALE,
              );
              scaleRef.current = nextScale;
              scale.setValue(nextScale);
              setTranslation(
                translationRef.current.x,
                translationRef.current.y,
                nextScale,
              );
            }
            lastDistanceRef.current = distance;
          } else {
            const touch = touches[0];
            const previousTouch = lastTouchRef.current;
            if (touch && previousTouch && lastTouchCountRef.current === 1) {
              const deltaX = touch.pageX - previousTouch.x;
              const deltaY = touch.pageY - previousTouch.y;
              gestureMovementRef.current += Math.hypot(deltaX, deltaY);
              if (scaleRef.current > MIN_SCALE) {
                setTranslation(
                  translationRef.current.x + deltaX,
                  translationRef.current.y + deltaY,
                );
              }
            }
          }

          const firstTouch = touches[0];
          lastTouchRef.current = firstTouch
            ? { x: firstTouch.pageX, y: firstTouch.pageY }
            : undefined;
          if (touchCount < 2) lastDistanceRef.current = undefined;
          lastTouchCountRef.current = touchCount;
        },
        onPanResponderRelease: () => {
          const isTap =
            !hadMultipleTouchesRef.current &&
            gestureMovementRef.current < TAP_MOVEMENT_THRESHOLD &&
            Date.now() - gestureStartedAtRef.current < DOUBLE_TAP_DELAY_MS;

          if (isTap) {
            const now = Date.now();
            if (now - lastTapAtRef.current < DOUBLE_TAP_DELAY_MS) {
              animateTo(scaleRef.current > MIN_SCALE ? MIN_SCALE : DOUBLE_TAP_SCALE);
              lastTapAtRef.current = 0;
              return;
            }
            lastTapAtRef.current = now;
          }

          if (scaleRef.current < 1.05) animateTo(MIN_SCALE);
        },
        onPanResponderTerminate: () => {
          if (scaleRef.current < 1.05) animateTo(MIN_SCALE);
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [animateTo, scale, setTranslation, translateX, translateY],
  );

  return (
    <View
      className="flex-1 overflow-hidden"
      onLayout={({ nativeEvent }) => {
        viewportRef.current = nativeEvent.layout;
        setTranslation(translationRef.current.x, translationRef.current.y);
      }}
      {...panResponder.panHandlers}
    >
      <Animated.Image
        accessibilityLabel="확대된 Part 4 정보 이미지"
        className="h-full w-full"
        resizeMode="contain"
        source={{ uri: imageUrl }}
        style={{
          transform: [{ scale }, { translateX }, { translateY }],
        }}
      />
    </View>
  );
}

interface ExamInformationImageProps {
  imageUrl: string;
  onLoad?: () => void;
}

/** Part 4 정보 이미지를 보여주고, 탭하면 확대·이동 가능한 전체 화면 뷰어를 연다. */
export function ExamInformationImage({ imageUrl, onLoad }: ExamInformationImageProps) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [imageRevision, setImageRevision] = useState(0);
  const [aspectRatio, setAspectRatio] = useState(4 / 3);
  const [isViewerVisible, setIsViewerVisible] = useState(false);
  const previousImageUrlRef = useRef(imageUrl);
  const reportedLoadRef = useRef(false);

  useEffect(() => {
    if (previousImageUrlRef.current === imageUrl) return;
    previousImageUrlRef.current = imageUrl;
    reportedLoadRef.current = false;
    setLoadState("loading");
    setAspectRatio(4 / 3);
    setIsViewerVisible(false);
    setImageRevision((revision) => revision + 1);
  }, [imageUrl]);

  const image = (
    <Image
      key={imageRevision}
      accessible={false}
      className="h-full w-full"
      resizeMode="contain"
      source={{ uri: imageUrl }}
      onError={() => setLoadState("error")}
      onLoad={({ nativeEvent }) => {
        const { width, height } = nativeEvent.source;
        if (width > 0 && height > 0) setAspectRatio(clamp(width / height, 0.65, 1.6));
        setLoadState("loaded");
        if (!reportedLoadRef.current) {
          reportedLoadRef.current = true;
          onLoad?.();
        }
      }}
    />
  );

  return (
    <>
      {loadState === "loaded" ? (
        <Pressable
          accessibilityHint="전체 화면에서 손가락 두 개로 확대하거나 축소할 수 있습니다"
          accessibilityLabel="Part 4 정보 이미지 확대해서 보기"
          accessibilityRole="button"
          className="w-full overflow-hidden rounded-2xl border border-line bg-surface-muted"
          onPress={() => setIsViewerVisible(true)}
          style={{ aspectRatio }}
        >
          {image}
          <View className="absolute bottom-3 right-3 flex-row items-center gap-1.5 rounded-full bg-exam-navy px-3 py-2">
            <MaterialCommunityIcons name="magnify-plus-outline" size={18} color="white" />
            <Text className="text-xs text-white">눌러서 확대</Text>
          </View>
        </Pressable>
      ) : (
        <View
          className="aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl border border-line bg-surface-muted"
        >
          {image}
          {loadState === "loading" ? (
            <View className="absolute inset-0 items-center justify-center bg-surface-muted">
              <Text className="text-sm text-ink-muted">정보 이미지를 불러오는 중이에요.</Text>
            </View>
          ) : (
            <View className="absolute inset-0 items-center justify-center bg-surface-muted">
              <MaterialCommunityIcons
                name="image-off-outline"
                size={32}
                color={colors.ink.muted}
              />
              <Text accessibilityLiveRegion="polite" className="mt-2 text-sm text-ink-muted">
                정보 이미지를 불러오지 못했어요.
              </Text>
              <Pressable
                accessibilityRole="button"
                className="mt-3 rounded-full border border-brand-300 px-4 py-2"
                onPress={() => {
                  setLoadState("loading");
                  setImageRevision((revision) => revision + 1);
                }}
              >
                <Text className="text-sm text-brand-text">다시 불러오기</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      <Modal
        animationType="fade"
        statusBarTranslucent
        visible={isViewerVisible}
        onRequestClose={() => setIsViewerVisible(false)}
      >
        {isViewerVisible ? <StatusBar style="light" /> : null}
        <SafeAreaView accessibilityViewIsModal className="flex-1 bg-exam-navy">
          <View className="flex-row items-center justify-between px-4 py-3">
            <Text className="text-base text-white">정보 이미지</Text>
            <Pressable
              accessibilityLabel="확대 화면 닫기"
              accessibilityRole="button"
              className="h-11 w-11 items-center justify-center rounded-full border border-white"
              onPress={() => setIsViewerVisible(false)}
            >
              <MaterialCommunityIcons name="close" size={24} color="white" />
            </Pressable>
          </View>
          {isViewerVisible ? (
            <ZoomableImage imageUrl={imageUrl} />
          ) : (
            <View className="flex-1" />
          )}
          <Text className="px-4 pb-3 pt-2 text-center text-xs text-white">
            두 손가락으로 확대·축소하고, 확대 후 움직여 보세요. 두 번 누르면 배율이 바뀝니다.
          </Text>
        </SafeAreaView>
      </Modal>
    </>
  );
}
