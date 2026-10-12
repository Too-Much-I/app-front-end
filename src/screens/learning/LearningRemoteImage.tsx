import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, type ImageProps } from 'react-native';
import { Text } from '@/components/ui/Text';
import { resolveLearningMedia } from '@/features/learning/api/resolve-learning-media';
import type { LearningPhoto } from '@/features/learning/learning-types';

/** Retry an expired S3 URL once through the authenticated backend. */
export function LearningRemoteImage({
  media,
  ...props
}: Omit<ImageProps, 'source'> & { media: LearningPhoto }) {
  const [url, setUrl] = useState(media.url);
  const [failed, setFailed] = useState(false);
  const refreshed = useRef(false);
  const request = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (refreshed.current) {
      setFailed(true);
      return;
    }
    refreshed.current = true;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      const next = await resolveLearningMedia(media, controller.signal, true);
      if (!controller.signal.aborted) setUrl(next);
    } catch {
      if (!controller.signal.aborted) setFailed(true);
    }
  }, [media]);
  useEffect(() => {
    setUrl(media.url);
    setFailed(false);
    refreshed.current = false;
    if (Date.parse(media.expiresAt) < Date.now() + 60_000) void refresh();
    return () => request.current?.abort();
  }, [media, refresh]);
  return failed ? (
    <Text className="text-xs text-ink-muted">
      사진을 불러오지 못했어요. 목록에서 다시 열어 주세요.
    </Text>
  ) : (
    <Image {...props} source={{ uri: url }} onError={() => void refresh()} />
  );
}
