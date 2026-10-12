import { View } from 'react-native';
import { Text } from '@/components/ui/Text';
import type { ExamTableContext } from '@/types/exam';
import {
  getPart4MetadataValue,
  getPart4RecordLayout,
} from '@/features/learning/learning-table-layout';

/** The same table data, arranged by record so time and content never scroll apart. */
export function LearningTable({
  table,
  compact = false,
  condensed = false,
}: {
  table: ExamTableContext;
  compact?: boolean;
  condensed?: boolean;
}) {
  const { shared, short, primary, details } = getPart4RecordLayout(table, condensed);
  const title =
    table.title === table.title.toUpperCase()
      ? table.title.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
      : table.title;
  return (
    <View className={compact ? 'gap-sm' : 'gap-lg'}>
      {!compact ? (
        <Text accessibilityRole="header" className="text-lg font-semibold">
          {title}
        </Text>
      ) : null}
      {table.subtitles.map((line, i) => (
        <Text key={i} className="text-sm text-ink-muted">
          {line}
        </Text>
      ))}
      {table.metadata.length ? (
        <View className={condensed ? 'gap-sm' : 'flex-row flex-wrap gap-sm'}>
          {table.metadata.map((entry, i) => (
            <View
              key={i}
              className={
                condensed
                  ? 'flex-row items-start gap-md'
                  : 'min-w-0 flex-1 rounded-control bg-surface-muted p-sm'
              }
            >
              <Text
                className={
                  condensed ? 'flex-1 text-xs leading-5 text-ink-muted' : 'text-xs text-ink-muted'
                }
              >
                {entry.label}
              </Text>
              <Text
                className={condensed ? 'flex-1 text-right text-sm leading-5' : 'text-sm leading-5'}
              >
                {condensed ? getPart4MetadataValue(entry) : String(entry.value ?? '—')}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {shared.map((column) => (
        <View key={column.key} className="flex-row flex-wrap items-baseline gap-sm">
          <Text className="text-xs text-ink-muted">{column.label}</Text>
          <Text className="text-sm font-semibold">{String(table.items[0].cells[column.key])}</Text>
        </View>
      ))}
      {table.items.map((item, index) => {
        return (
          <View
            key={index}
            className={
              condensed
                ? `gap-xs ${index ? 'border-t border-line pt-sm' : ''}`
                : `gap-xs rounded-control border border-line bg-surface-muted ${compact ? 'p-xs' : 'p-sm'}`
            }
          >
            {short.length ? (
              <View className="flex-row flex-wrap gap-element">
                {short.map((col) => (
                  <Text
                    key={col.key}
                    accessibilityLabel={`${col.label}, ${item.cells[col.key] ?? '—'}`}
                    className={`text-sm font-semibold ${item.strikeThrough ? 'line-through text-ink-muted' : ''}`}
                  >
                    {String(item.cells[col.key] ?? '—')}
                  </Text>
                ))}
              </View>
            ) : null}
            {primary ? (
              <Text
                accessibilityLabel={`${primary.label}, ${item.cells[primary.key] ?? '—'}`}
                className={`text-sm leading-5 ${item.strikeThrough ? 'line-through text-ink-muted' : ''}`}
              >
                {String(item.cells[primary.key] ?? '—')}
              </Text>
            ) : null}
            {details.map((col) => (
              <View key={col.key} className="flex-row gap-sm">
                <Text className="text-xs leading-5 text-ink-muted" style={{ flex: 1 }}>
                  {col.label}
                </Text>
                <Text
                  className={`text-sm leading-5 ${item.strikeThrough ? 'line-through text-ink-muted' : ''}`}
                  style={{ flex: 4 }}
                >
                  {String(item.cells[col.key] ?? '—')}
                </Text>
              </View>
            ))}
            {item.statusNote ? (
              <Text className="text-xs leading-5 !text-brand-text">{item.statusNote}</Text>
            ) : null}
          </View>
        );
      })}
      {table.notes.map((note, i) => (
        <Text key={i} className="text-xs leading-5 text-ink-muted">
          {typeof note === 'string' ? note : note.text}
        </Text>
      ))}
    </View>
  );
}
