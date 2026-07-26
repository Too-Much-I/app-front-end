# Spec-Driven Development

이 저장소는 GitHub Spec Kit과 Codex Skill을 사용해 Jira 이슈를 명세, 설계, 태스크,
구현으로 단계적으로 구체화한다. Jira 이슈는 요구사항 입력이며 구현 명령이나 완성된
명세가 아니다.

## 도구 설치

Spec Kit CLI는 저장소가 초기화된 버전과 맞추기 위해 `0.14.2`로 고정한다.

```sh
brew install uv
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@v0.14.2
specify integration status
```

Codex Skill은 `.agents/skills/`, 공유 워크플로와 템플릿은 `.specify/`에 있다. 처음
설치하거나 Skill이 갱신된 뒤에는 Codex 세션을 다시 시작한다.

## 기본 흐름

Codex에서 다음 Skill을 순서대로 사용한다.

1. `$speckit-specify`: Jira 이슈의 사실, 가정, 범위, 수용 기준으로 `spec.md`를 만든다.
2. `$speckit-clarify`: 제품 동작이나 범위의 모호함을 질문으로 해결한다.
3. **사람이 spec을 승인한다.** 승인 전에는 계획으로 넘어가지 않는다.
4. `$speckit-plan`: 현재 흐름, 대안, 결정, 실패 경로와 검증 계획을 만든다.
5. `$speckit-checklist`: 명세와 계획의 품질 체크리스트를 만든다.
6. **사람이 plan을 승인한다.** 승인 전에는 태스크나 구현으로 넘어가지 않는다.
7. `$speckit-tasks`: 독립적으로 검토할 수 있는 태스크를 만든다.
8. `$speckit-analyze`: spec, plan, tasks의 충돌과 누락을 읽기 전용으로 검사한다.
9. `$speckit-implement`: 승인된 태스크나 단계만 구현한다.
10. `$speckit-converge`: 코드와 명세의 차이를 확인하고 남은 태스크를 추가한다.
11. 사람이 diff와 검증 결과를 이해하고 승인한 뒤 commit, push, Jira 쓰기를 수행한다.

## Jira 사용 원칙

- 첫 조회는 읽기 전용으로 수행한다.
- 확인된 사실, 추론, 가정과 미해결 질문을 분리한다.
- Jira 상태, 댓글, 담당자 또는 필드는 사용자의 명시적 요청 없이 변경하지 않는다.
- `spec.md`의 `Issue` 필드와 branch 또는 commit에서 같은 이슈 키를 사용한다.
- Jira 내용과 저장소 동작이 충돌하면 구현하지 말고 차이를 먼저 보고한다.

시작 프롬프트 예시:

```text
Jira에서 SOMA-123을 읽기 전용으로 가져와줘.
댓글, 상태, 담당자는 변경하지 마.
확인된 사실, 가정, 모호한 부분과 수용 기준을 분리한 뒤
$speckit-specify로 명세 초안만 작성해줘. 내가 승인하기 전에는 plan으로 넘어가지 마.
```

## 개발자 주도권 확인

각 승인 단계에서 개발자는 다음을 설명할 수 있어야 한다.

- 사용자가 얻는 결과와 범위 밖 동작
- 현재 코드의 데이터, 상태 및 네비게이션 흐름
- 고려한 대안과 선택한 설계의 trade-off
- 정상, 오류, 중단 및 복구 경로
- 변경되는 파일의 책임과 검증 방법

설명할 수 없는 부분은 구현이나 커밋 전에 Codex에 다시 질문하고 직접 요약한다.

## 업그레이드

이 저장소는 `.specify/templates/`의 spec, plan, tasks 템플릿을 Constitution에 맞게
수정했다. 다음 명령으로 상태와 새 버전을 먼저 확인한다.

```sh
specify self check
specify integration status
specify self upgrade --dry-run
```

`specify integration upgrade --force` 또는 `specify init --force`는 커스텀 템플릿을
덮어쓸 수 있다. 강제 옵션을 사용하기 전에 깨끗한 브랜치에서 diff를 검토하고
`.specify/memory/constitution.md`와 커스텀 템플릿을 보존한다.
