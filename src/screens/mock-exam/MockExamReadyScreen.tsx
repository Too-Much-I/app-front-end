import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import type { MockExamStackParamList } from "@/navigation/types";
import { ExamReadyNoticeCard } from "@/screens/mock-exam/components/ExamReadyNoticeCard";
import { colors, shadows } from "@/theme";

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
// "조용히" 몸짓의 마스코트 — 안내 목록 첫 항목(조용한 곳에서 응시)과 그림이 그대로 맞는다.
const readyMascot = require("../../../public/mascots/shh.png");

type MockExamReadyScreenProps = NativeStackScreenProps<
  MockExamStackParamList,
  "MockExamReady"
>;

/**
 * 모의고사 준비(안내) 화면 — 모의고사 탭 자체가 이 화면이다.
 *
 * 마이크 권한·소리 확인 같은 검증은 하지 않는 안내 전용 화면이다. 그래서 "시작하기"는
 * 항상 눌린다. 검증 게이트가 필요해지면 이 화면에 조건을 얹는 게 아니라 별도 단계를 둔다.
 *
 * 탭바는 그대로 남는다 — 아직 응시에 진입하지 않았으므로 다른 탭으로 빠져나갈 수 있어야 한다.
 * (실제 응시 화면은 반대로 탭바를 숨겨야 한다. 20분 응시 중 탭 오터치로 세션이 날아가면 안 된다.)
 */
export function MockExamReadyScreen({ navigation }: MockExamReadyScreenProps) {
  const handleStartExam = () => {
    // TODO: createExamSession()(features/exam/api/exam-session-create.ts) 연결.
    // 연결할 때 버튼 연타 방지가 함께 필요하다 — docs/exam-session-duplicate-request-fix.md 참고.
    console.log("[MockExamReady] 시작하기 press");
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface-subtle">
      <View className="px-5 py-4">
        <Text className="text-xl">모의고사</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-5 pb-4">
          {/* 헤드라인 — 아래 목록 전체가 무엇을 위한 것인지 한 줄로 묶어준다 */}
          <View className="flex-row items-center gap-2">
            <View className="flex-1">
              <Text className="text-2xl leading-8">시작하기 전에{"\n"}확인해주세요</Text>
              <Text className="mt-1.5 text-sm text-ink-muted">
                한 번 시작하면 중간에 멈출 수 없어요
              </Text>
            </View>
            {/* 원본이 정사각형(1254×1254)이라 정사각 박스에 넣으면 잘리지 않는다 */}
            <Image source={readyMascot} className="h-32 w-32" resizeMode="contain" />
          </View>

          <View className="mt-4">
            <ExamReadyNoticeCard />
          </View>
        </View>
      </ScrollView>

      <View className="gap-3 px-5 pb-4 pt-2">
        {/* 규칙: 버튼이 주황이면 아이콘·글자는 흰색 */}
        <Pressable
          className="flex-row items-center justify-center gap-2 rounded-2xl bg-brand-cta py-4"
          style={shadows.card}
          onPress={handleStartExam}
        >
          {/*
            마이크가 아니라 play-circle을 쓴다. 이 버튼을 눌러서 시작되는 건 녹음이 아니라
            Part 1 디렉션이다 — 마이크 아이콘은 "지금 말하세요"를 약속하는데 다음 화면이
            그 약속을 지키지 않는다.
          */}
          <Feather name="play-circle" size={20} color="#FFFFFF" />
          <Text className="text-base text-white">모의고사 시작하기</Text>
        </Pressable>

        {/* 물음표 아이콘만 두면 도움말/FAQ로 읽히므로 열리는 콘텐츠 이름을 함께 쓴다. */}
        <Pressable
          className="flex-row items-center justify-center gap-1.5 py-2"
          hitSlop={8}
          onPress={() => navigation.navigate("ExamPartGuide")}
        >
          <Feather name="help-circle" size={16} color={colors.ink.muted} />
          <Text className="text-sm text-ink-muted">파트별 진행 방식 보기</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
