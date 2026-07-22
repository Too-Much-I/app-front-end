import { Feather } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { ComponentProps, ComponentType } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FeedbackScreen } from "@/screens/feedback/FeedbackScreen";
import { HomeScreen } from "@/screens/home/HomeScreen";
import { MockExamScreen } from "@/screens/mock-exam/MockExamScreen";
import { MyPageScreen } from "@/screens/my-page/MyPageScreen";
import { StudyScreen } from "@/screens/study/StudyScreen";
import { TabBarButton } from "@/navigation/TabBarButton";
import type { MainTabParamList } from "@/navigation/types";
import { colors, FONT_FAMILY, tabBar } from "@/theme";

const Tab = createBottomTabNavigator<MainTabParamList>();

type TabConfig = {
  name: keyof MainTabParamList;
  title: string;
  icon: ComponentProps<typeof Feather>["name"];
  component: ComponentType;
};

const TAB_CONFIG: TabConfig[] = [
  { name: "Home", title: "홈", icon: "home", component: HomeScreen },
  { name: "MockExam", title: "모의고사", icon: "clipboard", component: MockExamScreen },
  { name: "Feedback", title: "피드백", icon: "message-circle", component: FeedbackScreen },
  { name: "Study", title: "학습", icon: "book-open", component: StudyScreen },
  { name: "MyPage", title: "마이페이지", icon: "user", component: MyPageScreen },
];

export function MainTabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand.DEFAULT,
        tabBarInactiveTintColor: colors.ink.disabled,
        tabBarButton: TabBarButton,
        tabBarIconStyle: {
          width: tabBar.iconSize,
          height: tabBar.iconSize,
          marginBottom: tabBar.iconLabelGap,
        },
        // 폰트와 행 높이를 고정해야 iOS/Android에서 라벨이 같은 높이를 차지하고,
        // 그래야 아래 height 계산이 두 플랫폼에서 모두 맞는다.
        tabBarLabelStyle: {
          fontFamily: FONT_FAMILY,
          fontSize: tabBar.labelFontSize,
          lineHeight: tabBar.labelLineHeight,
        },
        // 하단 inset(홈 인디케이터/제스처 바)만 런타임에 더한다.
        tabBarStyle: {
          backgroundColor: colors.surface.DEFAULT,
          borderTopColor: colors.line.DEFAULT,
          height: tabBar.contentHeight + insets.bottom,
          paddingTop: tabBar.verticalPadding,
          paddingBottom: tabBar.verticalPadding + insets.bottom,
        },
      }}
    >
      {TAB_CONFIG.map(({ name, title, icon, component }) => (
        <Tab.Screen
          key={name}
          name={name}
          component={component}
          options={{
            title,
            tabBarIcon: ({ color }) => <Feather name={icon} color={color} size={tabBar.iconSize} />,
          }}
        />
      ))}
    </Tab.Navigator>
  );
}
