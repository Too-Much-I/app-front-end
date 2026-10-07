// 학습 기록(docs/learning) 해석과 머지 조건 판단. 리뷰 훅과 CI가 같은 규칙을 쓴다.
// 형식과 배경: docs/learning/README.md, docs/how-we-work.md

export const LEARNING_DIRECTORY = 'docs/learning/';
/** 1·2단계 대화를 AI가 모으고 사람이 확인한다. 구현 시작 시점의 내용을 고정한다. */
export const DESIGN_SECTION = '설계 논의';
/** 채워야 머지되는 섹션. 시나리오 지도는 AI가 쓰므로 넣지 않는다. 나머지 셋은 사람이 쓴다. */
export const REQUIRED_SECTIONS = [DESIGN_SECTION, '내가 찾은 것', '흐름 설명', '설계와 달라진 것'];
/** PR 본문에 이 줄과 사유가 있으면 학습 기록 없이 통과한다. */
export const NO_BEHAVIOR_CHANGE = '동작 변화 없음';
/** PR 본문에 이 줄과 사유가 있으면 학습 기록의 설계 논의만 채워져도 통과한다. 동작은 바뀌지만 5단계를 생략한 작업. */
export const SKIP_FLOW_REVIEW = '5단계 생략';

// 템플릿이 미리 채워 두는 빈 항목. 이것만 남아 있으면 쓰지 않은 것으로 본다.
const TEMPLATE_LINE = /^-\s*(쟁점|처음 판단|바뀐 계기|최종|다룬 실패 범위|다루지 않은 것|반증)\s*:\s*$/;

export function isLearningRecordPath(path) {
  return (
    path.startsWith(LEARNING_DIRECTORY) &&
    path.endsWith('.md') &&
    !path.slice(LEARNING_DIRECTORY.length).includes('/') &&
    path !== `${LEARNING_DIRECTORY}README.md`
  );
}

function stripComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, '');
}

/** 제목 비교 기준. 띄어쓰기를 무시해 `흐름설명`과 `흐름 설명`을 같은 섹션으로 본다. */
function normalizeTitle(title) {
  return title.replace(/\s+/g, '');
}

/**
 * 제목 단위로 나눈다. 사람이 손으로 쓰는 문서라 제목 표기는 너그럽게 받는다:
 * `#` 개수(`##`, `###` 등), `#` 뒤 공백 유무, 제목 안 띄어쓰기를 가리지 않는다.
 * 같은 제목이 반복되면 뒤의 것을 쓴다. 반환 키는 띄어쓰기를 뺀 제목이다.
 */
export function readLearningSections(markdown) {
  const sections = {};
  let current = null;
  for (const line of markdown.split('\n')) {
    const heading = /^#{1,6}\s*(\S.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      current = normalizeTitle(heading[1]);
      sections[current] = [];
    } else if (current) {
      sections[current].push(line);
    }
  }
  return Object.fromEntries(
    Object.entries(sections).map(([title, lines]) => [title, lines.join('\n')]),
  );
}

/** 제목 표기와 무관하게 한 섹션의 실제 내용을 읽는다. */
export function readSectionContent(markdown, title) {
  return sectionContent(readLearningSections(markdown)[normalizeTitle(title)]);
}

/** 주석·빈 템플릿 항목을 뺀 실제 내용. 비어 있으면 빈 문자열. */
export function sectionContent(text = '') {
  return stripComments(text)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !TEMPLATE_LINE.test(line))
    .join('\n');
}

export function missingSections(markdown, sections = REQUIRED_SECTIONS) {
  return sections.filter((title) => !readSectionContent(markdown, title));
}

function isDocumentationOnly(path) {
  return path.startsWith('docs/') || path.endsWith('.md');
}

// 템플릿이 "여기에 쓰라"고 남긴 `<사유>` 같은 자리표시. 그대로 두면 사유를 쓰지 않은 것이다.
const PLACEHOLDER = /^<[^>]*>$/;

/** PR 본문의 주석 밖에서 `<선언>: <사유>` 줄을 찾는다. 자리표시만 있으면 선언으로 보지 않는다. */
function readDeclarationReason(prBody, declaration) {
  const match = new RegExp(`^\\s*${declaration}\\s*:\\s*(\\S.*)$`, 'm').exec(
    stripComments(prBody),
  );
  const reason = match?.[1].trim();
  return reason && !PLACEHOLDER.test(reason) ? reason : null;
}

export function readNoBehaviorChangeReason(prBody = '') {
  return readDeclarationReason(prBody, NO_BEHAVIOR_CHANGE);
}

/**
 * PR 머지 조건. 내용이 맞는지는 판단하지 않는다(검증 불가). 비어 있지 않은지만 본다.
 * changedFiles: base...head에서 추가·수정된 파일(삭제 제외).
 * addedFiles: 그중 이 PR에서 새로 추가된 파일. 학습 기록은 새로 추가한 것만 인정한다 —
 *   이미 채워진 이전 작업의 기록을 조금 고쳐 통과하지 못하게 한다.
 * readFile: 저장소 기준 경로로 읽는다.
 */
export function evaluateLearningRecord({ changedFiles, addedFiles, prBody, readFile }) {
  if (changedFiles.length === 0) return { ok: true, reason: '변경 파일 없음' };
  if (changedFiles.every(isDocumentationOnly)) return { ok: true, reason: '문서만 변경' };
  const declared = readNoBehaviorChangeReason(prBody);
  if (declared) return { ok: true, reason: `${NO_BEHAVIOR_CHANGE}: ${declared}` };

  const records = addedFiles.filter(isLearningRecordPath);
  if (records.length === 0) {
    const modifiedOnly = changedFiles.some(isLearningRecordPath);
    return {
      ok: false,
      reason: `${modifiedOnly ? '이전 학습 기록을 수정한 것은 인정되지 않습니다. ' : ''}이 작업의 학습 기록(${LEARNING_DIRECTORY}YYYY-MM-DD-<작업>.md)을 새로 추가하거나, 설명할 동작 변화가 없으면 PR 본문에 "${NO_BEHAVIOR_CHANGE}: <실제 사유>"를 적어주세요.`,
    };
  }
  const skipped = readDeclarationReason(prBody, SKIP_FLOW_REVIEW);
  const required = skipped ? [DESIGN_SECTION] : REQUIRED_SECTIONS;
  const results = records.map((path) => ({
    path,
    missing: missingSections(readFile(path), required),
  }));
  const complete = results.find((result) => result.missing.length === 0);
  if (complete) {
    return {
      ok: true,
      reason: skipped
        ? `학습 기록: ${complete.path} (${SKIP_FLOW_REVIEW}: ${skipped})`
        : `학습 기록: ${complete.path}`,
    };
  }
  return {
    ok: false,
    reason: results
      .map((result) => `${result.path}: 비어 있는 섹션 — ${result.missing.join(', ')}`)
      .join('\n'),
  };
}
