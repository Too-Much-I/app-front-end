import { Feather } from "@expo/vector-icons";
import { useCallback, useRef, useState } from "react";
import {
  type LayoutChangeEvent,
  ScrollView,
  View,
  type ViewStyle,
} from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { colors } from "@/theme";
import type { ExamTableContext, ExamTableScalar } from "@/types/exam";

const MIN_COLUMN_WIDTH = 144;

function formatExamTableValue(value: ExamTableScalar | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function formatStatus(status: string): string {
  const displayStatus = status.replace(/_/g, " ").trim();
  return (displayStatus || "unknown").toUpperCase();
}

interface Part4TableProps {
  table: ExamTableContext;
  onReady?: () => void;
  onRequestLandscape?: () => void;
  landscapeActionDisabled?: boolean;
}

/** Part 4 public 표 계약을 고정 column 가정 없이 표시하는 공용 native renderer. */
export function Part4Table({
  table,
  onReady,
  onRequestLandscape,
  landscapeActionDisabled = false,
}: Part4TableProps) {
  const reportedTableRef = useRef<ExamTableContext | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const columnCount = table.columns.length;
  const columnWidth =
    columnCount > 0
      ? Math.max(MIN_COLUMN_WIDTH, viewportWidth / columnCount)
      : viewportWidth;
  const tableWidth = columnWidth * columnCount;
  const columnStyle: ViewStyle = {
    flexGrow: 0,
    flexShrink: 0,
    width: columnWidth,
  };

  const handleViewportLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    setViewportWidth((currentWidth) =>
      currentWidth === nextWidth ? currentWidth : nextWidth,
    );
  }, []);

  return (
    <View
      className="relative w-full gap-4"
      onLayout={() => {
        if (reportedTableRef.current === table) return;
        reportedTableRef.current = table;
        onReady?.();
      }}
    >
      {onRequestLandscape ? (
        <Pressable
          accessibilityHint="시험 화면 요소를 숨기고 Part 4 표만 가로 전체화면으로 엽니다"
          accessibilityLabel="Part 4 표 확대"
          accessibilityRole="button"
          accessibilityState={{ disabled: landscapeActionDisabled }}
          className={`absolute right-0 top-0 z-10 h-11 w-11 items-center justify-center rounded-full border ${
            landscapeActionDisabled
              ? "border-line bg-surface-muted"
              : "border-brand-300 bg-surface"
          }`}
          disabled={landscapeActionDisabled}
          hitSlop={4}
          onPress={onRequestLandscape}
        >
          <Feather
            color={
              landscapeActionDisabled ? colors.ink.disabled : colors.brand.text
            }
            name="maximize-2"
            size={21}
          />
        </Pressable>
      ) : null}

      <View className={`gap-1 ${onRequestLandscape ? "px-14" : ""}`}>
        <Text accessibilityRole="header" className="text-center text-2xl text-exam-navy">
          {formatExamTableValue(table.title)}
        </Text>
        {table.subtitles.map((subtitle, index) => (
          <Text
            className="text-center text-sm leading-6 text-ink-muted"
            key={`subtitle-${index}`}
          >
            {formatExamTableValue(subtitle)}
          </Text>
        ))}
      </View>

      {table.metadata.length > 0 ? (
        <View className="flex-row flex-wrap gap-2" accessibilityLabel="표 부가 정보">
          {table.metadata.map((entry, index) => (
            <View
              className="min-w-40 flex-1 rounded-xl border border-line bg-surface-muted px-3 py-2"
              key={`${entry.key}-${index}`}
            >
              <Text className="text-xs text-ink-muted">{entry.label}</Text>
              <Text
                accessibilityLabel={`${entry.label}, ${formatExamTableValue(entry.value)}`}
                className="mt-0.5 text-sm text-exam-navy"
              >
                {formatExamTableValue(entry.value)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {table.columns.length > 2 ? (
        <Text className="text-xs text-ink-muted">스크롤을 밀어 모든 열을 확인하세요.</Text>
      ) : null}

      <ScrollView
        accessibilityHint="스크롤을 밀어 첫 번째 열부터 마지막 열까지 확인할 수 있습니다"
        accessibilityLabel="Part 4 정보 표"
        bounces={false}
        contentContainerStyle={{ flexGrow: 1 }}
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator
        onLayout={handleViewportLayout}
      >
        <View
          className="overflow-hidden rounded-xl border border-line"
          style={{ width: tableWidth || viewportWidth }}
        >
          <View
            className="flex-row items-stretch border-b border-line bg-exam-navy"
            style={{ width: tableWidth }}
          >
            {table.columns.map((column, columnIndex) => (
              <View
                className={`self-stretch px-3 py-3 ${
                  columnIndex < table.columns.length - 1 ? "border-r border-line" : ""
                }`}
                key={`${column.key}-${columnIndex}`}
                style={columnStyle}
              >
                <Text accessibilityRole="header" className="text-sm text-white">
                  {column.label}
                </Text>
              </View>
            ))}
          </View>

          {table.items.length === 0 ? (
            <View className="items-center px-3 py-4">
              <Text className="text-sm text-ink-muted">표 항목이 없습니다.</Text>
            </View>
          ) : (
            table.items.map((item, rowIndex) => (
              <View
                className={
                  rowIndex < table.items.length - 1 ? "border-b border-line" : ""
                }
                key={`row-${rowIndex}`}
                style={{ width: tableWidth }}
              >
                {/* 가장 많이 줄바꿈된 셀이 행 높이를 정하고, 나머지 셀과
                    세로 구분선도 그 높이까지 함께 늘어난다. */}
                <View className="flex-row items-stretch bg-surface">
                  {table.columns.map((column, columnIndex) => {
                    const displayValue = formatExamTableValue(item.cells[column.key]);
                    return (
                      <View
                        className={`self-stretch px-3 py-3 ${
                          columnIndex < table.columns.length - 1
                            ? "border-r border-line"
                            : ""
                        }`}
                        key={`${column.key}-${columnIndex}`}
                        style={columnStyle}
                      >
                        <Text
                          accessibilityLabel={`${column.label}, ${
                            displayValue === "—" ? "값 없음" : displayValue
                          }`}
                          className={`text-sm leading-6 ${
                            item.strikeThrough
                              ? "text-ink-muted line-through"
                              : "text-exam-navy"
                          }`}
                        >
                          {displayValue}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {item.statusNote ? (
                  <View className="items-start border-t border-line bg-surface px-3 py-2">
                    <View className="rounded-full border border-line bg-surface-muted px-3 py-1">
                      <Text
                        accessibilityLabel={`상태 ${formatStatus(item.status)}, ${item.statusNote}`}
                        className="text-xs text-ink-muted"
                      >
                        {formatStatus(item.status)} · {item.statusNote}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {table.notes.length > 0 ? (
        <View className="gap-2 rounded-xl border border-line bg-surface-muted p-3">
          <Text accessibilityRole="header" className="text-sm text-exam-navy">
            Notes
          </Text>
          {table.notes.map((note, index) => (
            <View className="flex-row gap-2" key={`${note.scope}-${index}`}>
              <Text accessibilityElementsHidden className="text-sm text-ink-muted">
                •
              </Text>
              <Text className="flex-1 text-sm leading-6 text-ink-muted">{note.text}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
