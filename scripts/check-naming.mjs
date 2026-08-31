#!/usr/bin/env node
/**
 * 네이밍 규칙 검사.
 *
 * 왜 oxlint 규칙이 아니라 별도 스크립트인가:
 *
 * 1. 가장 중요한 규칙(서로 다른 파일이 같은 이름을 export하지 않는다)은 파일 하나만 보고는
 *    판단할 수 없다. 린터 규칙은 파일 단위로 돌기 때문에 프로젝트 전체 인덱스가 필요한
 *    이 검사를 표현할 수 없다.
 * 2. oxlint의 JS 플러그인은 alpha이며 semver를 따르지 않는다고 명시돼 있다. CI 게이트를
 *    거기 걸면 oxlint를 올릴 때마다 깨질 수 있다.
 * 3. 예외를 소스의 `oxlint-disable` 주석이 아니라 이 파일의 ALLOWLIST에 이유와 함께 적는다.
 *    이 저장소는 억제 주석이 0건이고, 그 성질을 지키는 편이 낫다.
 *
 * 규칙과 그 근거는 docs/architecture/01-naming-dictionary.md 에 있다.
 * 규칙을 바꾸려면 그 문서와 이 파일을 함께 고친다.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SRC = join(ROOT, "src");

/**
 * 규칙을 어기지만 그대로 두기로 한 것들. 새로 추가할 때는 반드시 이유를 함께 적는다.
 * 비어 있는 편이 좋다 — 항목이 늘어나면 규칙 쪽을 의심한다.
 */
const ALLOWLIST = {
  duplicateExport: new Set([
    // 예: "someName" — 이유
  ]),
  componentFileName: new Set([
    // 예: "src/foo/Bar.tsx" — 이유
  ]),
  hookFileName: new Set([]),
  aliasedReExport: new Set([]),
  mapperPerFile: new Set([]),
};

function walk(dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      entries.push(...walk(path));
    } else if (extname(path) === ".ts" || extname(path) === ".tsx") {
      entries.push(path);
    }
  }
  return entries;
}

/** `use-challenge-result` → `useChallengeResult` */
function toCamelCase(kebab) {
  return kebab.replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase());
}

const files = walk(SRC).sort();
const problems = [];

function report(rule, file, message) {
  problems.push({ rule, file: relative(ROOT, file), message });
}

/** 파일이 최상위에서 내보내는 이름들. 재수출 블록(`export { ... }`)은 여기 넣지 않는다. */
function readTopLevelExports(source) {
  const names = [];
  const pattern =
    /^export\s+(?:async\s+)?(?:function|const|class|type|interface|enum)\s+([A-Za-z0-9_$]+)/gm;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    names.push(match[1]);
  }
  return names;
}

const exportOwners = new Map();

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const relPath = relative(ROOT, file);
  const ext = extname(file);
  const base = basename(file, ext);
  const exports = readTopLevelExports(source);

  for (const name of exports) {
    if (!exportOwners.has(name)) exportOwners.set(name, []);
    exportOwners.get(name).push(relPath);
  }

  // ── 규칙 2: 컴포넌트 파일은 PascalCase이고, 파일명이 곧 컴포넌트 이름이다.
  if (ext === ".tsx") {
    const component = source.match(/^export\s+(?:function|const)\s+([A-Z][A-Za-z0-9_$]*)/m)?.[1];
    if (component && !ALLOWLIST.componentFileName.has(relPath)) {
      if (!/^[A-Z]/.test(base)) {
        report("component-file-name", file, `컴포넌트 ${component}를 내보내는데 파일명이 PascalCase가 아니다`);
      } else if (base !== component) {
        report("component-file-name", file, `파일명과 컴포넌트 이름이 다르다 (export: ${component})`);
      }
    }
  }

  // ── 규칙 3: use-*.ts 는 파일명과 같은 이름의 훅을 내보낸다.
  if (base.startsWith("use-") && !ALLOWLIST.hookFileName.has(relPath)) {
    const expected = toCamelCase(base);
    if (!exports.includes(expected)) {
      const found = exports.filter((name) => name.startsWith("use"));
      report(
        "hook-file-name",
        file,
        `${expected}를 내보내지 않는다${found.length ? ` (있는 훅: ${found.join(", ")})` : ""}`,
      );
    }
  }

  // ── 규칙 4: 재수출하며 이름을 바꾸지 않는다. 한 대상에 두 이름이 생긴다.
  if (!ALLOWLIST.aliasedReExport.has(relPath)) {
    for (const match of source.matchAll(/^export\s*\{[^}]*\bas\b[^}]*\}/gms)) {
      report("aliased-re-export", file, `이름을 바꾸는 재수출: ${match[0].replace(/\s+/g, " ").slice(0, 80)}`);
    }
  }

  // ── 규칙 5: map-*.ts 하나에 매퍼 하나.
  if (base.startsWith("map-") && !ALLOWLIST.mapperPerFile.has(relPath)) {
    const mappers = exports.filter((name) => name.startsWith("map"));
    if (mappers.length > 1) {
      report("mapper-per-file", file, `매퍼가 ${mappers.length}개다: ${mappers.join(", ")}`);
    }
  }
}

// ── 규칙 1: 서로 다른 파일이 같은 이름을 내보내지 않는다.
//    중복 구현을 의도적으로 허용하더라도 이름은 겹치지 않게 한다 — 예측 가능성.
for (const [name, owners] of exportOwners) {
  if (owners.length > 1 && !ALLOWLIST.duplicateExport.has(name)) {
    problems.push({
      rule: "duplicate-export",
      file: owners[0],
      message: `${name}를 ${owners.length}개 파일이 내보낸다:\n      ${owners.join("\n      ")}`,
    });
  }
}

const RULE_TITLES = {
  "duplicate-export": "서로 다른 파일이 같은 이름을 내보낸다",
  "component-file-name": "컴포넌트 파일명 규칙",
  "hook-file-name": "훅 파일명 규칙",
  "aliased-re-export": "이름을 바꾸는 재수출",
  "mapper-per-file": "map-*.ts 하나에 매퍼 하나",
};

if (problems.length === 0) {
  console.log(`네이밍 검사 통과 — 파일 ${files.length}개, 이름 ${exportOwners.size}개`);
  process.exit(0);
}

console.error(`네이밍 검사 실패 — ${problems.length}건\n`);
for (const rule of Object.keys(RULE_TITLES)) {
  const matched = problems.filter((problem) => problem.rule === rule);
  if (matched.length === 0) continue;
  console.error(`  [${rule}] ${RULE_TITLES[rule]}`);
  for (const { file, message } of matched) {
    console.error(`    ${file}\n      ${message}`);
  }
  console.error("");
}
console.error("규칙의 근거: docs/architecture/01-naming-dictionary.md");
console.error("그대로 두기로 했다면 scripts/check-naming.mjs 의 ALLOWLIST에 이유와 함께 적는다.");
process.exit(1);
