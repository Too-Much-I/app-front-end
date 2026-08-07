import { useRef } from "react";
import { ScrollView, View } from "react-native";

import { Text } from "@/components/ui/Text";
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
}

/** Part 4 public 표 계약을 고정 column 가정 없이 표시하는 공용 native renderer. */
export function Part4Table({ table, onReady }: Part4TableProps) {
  const reportedTableRef = useRef<ExamTableContext | null>(null);
  const minimumTableWidth = table.columns.length * MIN_COLUMN_WIDTH;

  return (
    <View
      className="w-full gap-4"
      onLayout={() => {
        if (reportedTableRef.current === table) return;
        reportedTableRef.current = table;
        onReady?.();
      }}
    >
      <View className="gap-1">
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
        <Text className="text-xs text-ink-muted">좌우로 밀어 모든 열을 확인하세요.</Text>
      ) : null}

      <ScrollView
        accessibilityHint="좌우로 밀어 첫 번째 열부터 마지막 열까지 확인할 수 있습니다"
        accessibilityLabel="Part 4 정보 표"
        bounces={false}
        contentContainerStyle={{ flexGrow: 1 }}
        horizontal
        showsHorizontalScrollIndicator
      >
        <View
          className="flex-grow overflow-hidden rounded-xl border border-line"
          style={{ minWidth: minimumTableWidth }}
        >
          <View className="flex-row bg-exam-navy">
            {table.columns.map((column, columnIndex) => (
              <View
                className={`flex-1 px-3 py-3 ${
                  columnIndex < table.columns.length - 1 ? "border-r border-line" : ""
                }`}
                key={`${column.key}-${columnIndex}`}
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
                className={rowIndex < table.items.length - 1 ? "border-b border-line" : ""}
                key={`row-${rowIndex}`}
              >
                <View className="flex-row bg-surface">
                  {table.columns.map((column, columnIndex) => {
                    const displayValue = formatExamTableValue(item.cells[column.key]);
                    return (
                      <View
                        className={`flex-1 px-3 py-3 ${
                          columnIndex < table.columns.length - 1
                            ? "border-r border-line"
                            : ""
                        }`}
                        key={`${column.key}-${columnIndex}`}
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
