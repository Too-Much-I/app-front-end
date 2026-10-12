import type { ExamTableContext, ExamTableMetadata } from '@/types/exam';

/** Remove only known duplicate fee labels; retain amounts, conditions and unknown wording. */
export function getPart4MetadataValue(entry: ExamTableMetadata): string {
  const value = String(entry.value ?? '—');
  if (entry.label === 'Advance Registration')
    return value.replace(/^(?:advance (?:admission|registration)|early registration):\s*/i, '');
  if (entry.label === 'Same Day Registration')
    return value.replace(/^(?:door admission|registration (?:on arrival|at the event)):\s*/i, '');
  return value;
}

/** Group display columns without deleting any facts or changing the source records. */
export function getPart4RecordLayout(table: ExamTableContext, condensed: boolean) {
  const shared = condensed
    ? table.columns.filter((column) => {
        if (!/^(speaker|instructor|presenter)$/i.test(column.key) || table.items.length < 2)
          return false;
        const value = table.items[0].cells[column.key];
        return (
          value !== null &&
          value !== undefined &&
          value !== '' &&
          table.items.every(
            (item) => !item.strikeThrough && !item.statusNote && item.cells[column.key] === value,
          )
        );
      })
    : [];
  const short = table.columns.filter(
    (column) => !shared.includes(column) && /date|time|day/i.test(column.key + ' ' + column.label),
  );
  const details = table.columns.filter(
    (column) => !shared.includes(column) && !short.includes(column),
  );
  const primary = condensed
    ? details.find((column) =>
        /^(session|class|class_title|activity|event|occasion|tour|applicant|candidate|details)$/i.test(
          column.key,
        ),
      )
    : undefined;
  return { shared, short, primary, details: details.filter((column) => column !== primary) };
}
