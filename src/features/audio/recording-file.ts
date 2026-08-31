import { File } from "expo-file-system";

export class RecordingFileError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RecordingFileError";
  }
}

export function getValidRecordingFile(audioFileUri: string): File {
  const file = new File(audioFileUri);
  if (!file.exists || file.size <= 0) {
    throw new RecordingFileError("유효한 녹음 파일을 찾지 못했어요.");
  }
  return file;
}

export function deleteRecordingFile(audioFileUri: string): void {
  const file = new File(audioFileUri);
  if (file.exists) file.delete();
}
