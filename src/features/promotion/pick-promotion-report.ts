import * as ImagePicker from 'expo-image-picker';

import type { PromotionReport } from '@/features/promotion/promotion-application';

/**
 * 사진첩에서 성적표 사진 한 장을 고른다. 취소하면 `null`.
 *
 * 고른 사진을 바꾸지 않고 원본 그대로 받는다(2026-10-27 결정) — iOS가 HEIC를 JPEG로 바꿔 주지 않게 `Current`로
 * 요청한다. 시스템 사진 선택기를 쓰므로 사진첩 전체 권한을 따로 묻지 않는다.
 */
export async function pickPromotionReport(): Promise<PromotionReport | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality: 1,
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
  });
  const asset = picked.canceled ? undefined : picked.assets[0];
  if (!asset) return null;

  const mimeType = asset.mimeType ?? 'image/jpeg';
  return {
    uri: asset.uri,
    mimeType,
    fileSize: asset.fileSize ?? null,
  };
}
