import { Directory, File, Paths } from 'expo-file-system';
import { getValidRecordingFile } from '@/features/audio/recording-file';

/** Keep recorder ownership until a complete, readable session copy is available. */
export async function preserveLearningRecording(sourceUri: string, generationId: number) {
  const source = getValidRecordingFile(sourceUri);
  const folder = new Directory(Paths.cache, 'learning-session-recordings');
  folder.create({ idempotent: true, intermediates: true });
  const saved = new File(folder, `${Date.now()}-${generationId}.m4a`);
  try {
    // Expo 57 copy() is asynchronous. Publishing early races exists checks and source cleanup.
    await source.copy(saved);
    return getValidRecordingFile(saved.uri).uri;
  } catch (error) {
    try {
      if (saved.exists) saved.delete();
    } catch {
      // A failed partial copy can be evicted by the OS; preserve the original for retry.
    }
    throw error;
  }
}
