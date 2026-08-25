import { View } from "react-native";

/** 자리를 지키는 회색 덩어리 하나. 크기·모양은 호출부가 className으로 정한다. */
export function SkeletonBlock({ className }: { className: string }) {
  return <View className={`rounded-full bg-surface-muted ${className}`} />;
}
