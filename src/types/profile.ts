/** `GET /api/v1/users/me`에서 화면이 쓰는 값만. 권한 판단은 서버가 하므로 계정 종류는 담지 않는다. */
export interface MyProfile {
  /** 비었거나 오지 않으면 `null`. 인사말에서 닉네임 자리를 뺀다. */
  nickname: string | null;
}
