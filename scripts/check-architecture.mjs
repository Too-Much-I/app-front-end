#!/usr/bin/env node
/**
 * 모듈 경계 검사와 PR용 의존성 변화 보고서 생성.
 *
 * 경로만 보고 의미를 단정할 수 있는 규칙은 실패시키고, 참조 수나 feature 간 결합처럼
 * 맥락이 필요한 변화는 보고만 한다. 규칙과 근거는
 * docs/architecture/04-dependency-boundaries.md 에 있다.
 */

import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const DEPCRUISE_BIN = join(ROOT, "node_modules/dependency-cruiser/bin/dependency-cruise.mjs");
const DEPCRUISE_CONFIG = join(ROOT, ".dependency-cruiser.cjs");
const REPORT_MARKER = "<!-- architecture-boundaries-report -->";
const MAX_REPORTED_EDGES = 20;
const MAX_REPORTED_COUPLING_CHANGES = 5;

function readArguments(argv) {
  const options = { baseDir: null, reportFile: null };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];

    if (argument === "--") {
      continue;
    } else if (argument === "--base-dir" && value) {
      options.baseDir = resolve(ROOT, value);
      index += 1;
    } else if (argument === "--report-file" && value) {
      options.reportFile = isAbsolute(value) ? value : resolve(ROOT, value);
      index += 1;
    } else {
      throw new Error(`알 수 없거나 값이 없는 인자: ${argument}`);
    }
  }

  return options;
}

function cruise(projectDir) {
  const output = execFileSync(
    process.execPath,
    [
      DEPCRUISE_BIN,
      "index.ts",
      "App.tsx",
      "src",
      "--config",
      DEPCRUISE_CONFIG,
      "--output-type",
      "json",
    ],
    {
      cwd: projectDir,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    },
  );

  return JSON.parse(output);
}

function internalEdges(cruiseResult) {
  const edges = [];
  for (const module of cruiseResult.modules) {
    for (const dependency of module.dependencies) {
      if (dependency.resolved?.startsWith("src/")) {
        edges.push({
          source: module.source,
          target: dependency.resolved,
          specifier: dependency.module,
          circular: dependency.circular,
          cycle: dependency.cycle ?? [],
        });
      }
    }
  }
  return edges;
}

function edgeKey(edge) {
  return `${edge.source}\0${edge.target}`;
}

function screenArea(path) {
  return path.match(/^src\/screens\/([^/]+)\//)?.[1] ?? null;
}

function featureArea(path) {
  return path.match(/^src\/features\/([^/]+)\//)?.[1] ?? null;
}

function isUiModule(path) {
  return /^src\/(?:screens|components)\//.test(path);
}

function canonicalCycle(edge) {
  const path = [edge.source, ...edge.cycle.map(({ name }) => name)];
  const members = path.at(-1) === path[0] ? path.slice(0, -1) : path;
  const rotations = members.map((_, index) => [...members.slice(index), ...members.slice(0, index)]);
  const canonicalMembers = rotations.sort((left, right) => left.join("\0").localeCompare(right.join("\0")))[0];
  return [...canonicalMembers, canonicalMembers[0]].join(" -> ");
}

function collectGraphBlockers(edges) {
  const blockers = [];
  const cycles = new Set();

  for (const edge of edges) {
    if (edge.circular) {
      const cycle = canonicalCycle(edge);
      if (!cycles.has(cycle)) {
        cycles.add(cycle);
        blockers.push({
          rule: "no-circular",
          source: edge.source,
          target: edge.target,
          message: `순환 의존성이 생겼다: ${cycle}`,
        });
      }
    }

    const sourceScreen = screenArea(edge.source);
    const targetScreen = screenArea(edge.target);
    if (sourceScreen && targetScreen && sourceScreen !== targetScreen) {
      blockers.push({
        rule: "no-cross-screen-import",
        source: edge.source,
        target: edge.target,
        message: `화면 영역 ${sourceScreen}에서 다른 화면 영역 ${targetScreen}의 구현을 직접 참조한다`,
      });
    }
  }

  return blockers;
}

function collectUiSymbolBlockers(projectDir, cruiseResult) {
  const blockers = [];
  const moduleBySource = new Map(cruiseResult.modules.map((module) => [module.source, module]));

  for (const [source, module] of moduleBySource) {
    if (!isUiModule(source) || !/\.(?:ts|tsx)$/.test(source)) continue;

    const absolutePath = join(projectDir, source);
    const sourceText = readFileSync(absolutePath, "utf8");
    const sourceFile = ts.createSourceFile(
      source,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      source.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );

    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;

      const specifier = statement.moduleSpecifier.text;
      const dependency = module.dependencies.find((candidate) => candidate.module === specifier);
      if (!dependency?.resolved?.startsWith("src/")) continue;

      const namedBindings = statement.importClause?.namedBindings;
      if (!namedBindings || !ts.isNamedImports(namedBindings)) continue;

      for (const element of namedBindings.elements) {
        const importedName = element.propertyName?.text ?? element.name.text;
        const line = sourceFile.getLineAndCharacterOfPosition(element.getStart(sourceFile)).line + 1;

        if (/^Raw[A-Z]/.test(importedName)) {
          blockers.push({
            rule: "no-raw-type-in-ui",
            source,
            target: dependency.resolved,
            line,
            message: `UI가 서버 원형 ${importedName}을 직접 import한다`,
          });
        }

        if (/\/map-[^/]+\.(?:ts|tsx)$/.test(dependency.resolved) && /^map[A-Z]/.test(importedName)) {
          blockers.push({
            rule: "no-mapper-call-in-ui",
            source,
            target: dependency.resolved,
            line,
            message: `UI가 응답 매퍼 ${importedName}을 직접 import한다`,
          });
        }
      }
    }
  }

  return blockers;
}

function warningForEdge(edge, isNew) {
  const sourceFeature = featureArea(edge.source);
  const targetFeature = featureArea(edge.target);
  const novelty = isNew ? "새로 " : "";

  if (edge.source.startsWith("src/components/ui/") && targetFeature) {
    return {
      rule: "shared-ui-feature-dependency",
      ...edge,
      message: `공용 UI가 ${targetFeature} feature를 ${novelty}참조한다`,
    };
  }

  const sourceOwnsTargetFeature = sourceFeature === targetFeature;
  const targetsFeatureInternals = /\/api\/|\/map-[^/]+\.(?:ts|tsx)$/.test(edge.target);
  if (targetFeature && !sourceOwnsTargetFeature && targetsFeatureInternals) {
    return {
      rule: "feature-internal-dependency",
      ...edge,
      message: `${targetFeature} feature의 API 또는 mapper 구현을 외부에서 ${novelty}참조한다`,
    };
  }

  if (sourceFeature && targetFeature && sourceFeature !== targetFeature) {
    return {
      rule: "cross-feature-dependency",
      ...edge,
      message: `${sourceFeature} feature가 ${targetFeature} feature를 ${novelty}참조한다`,
    };
  }

  return null;
}

function dependencyChanges(headEdges, baseEdges) {
  if (!baseEdges) {
    return { added: [], removed: [], warnings: headEdges.map((edge) => warningForEdge(edge, false)).filter(Boolean) };
  }

  const headByKey = new Map(headEdges.map((edge) => [edgeKey(edge), edge]));
  const baseByKey = new Map(baseEdges.map((edge) => [edgeKey(edge), edge]));
  const added = [...headByKey].filter(([key]) => !baseByKey.has(key)).map(([, edge]) => edge);
  const removed = [...baseByKey].filter(([key]) => !headByKey.has(key)).map(([, edge]) => edge);

  return {
    added,
    removed,
    warnings: added.map((edge) => warningForEdge(edge, true)).filter(Boolean),
  };
}

function couplingCounts(edges) {
  const fanIn = new Map();
  const fanOut = new Map();

  for (const { source, target } of edges) {
    fanOut.set(source, (fanOut.get(source) ?? 0) + 1);
    fanIn.set(target, (fanIn.get(target) ?? 0) + 1);
  }

  return { fanIn, fanOut };
}

function largestCouplingChanges(headEdges, baseEdges) {
  if (!baseEdges) return [];

  const head = couplingCounts(headEdges);
  const base = couplingCounts(baseEdges);
  const changes = [];

  for (const kind of ["fanIn", "fanOut"]) {
    const modules = new Set([...head[kind].keys(), ...base[kind].keys()]);
    for (const module of modules) {
      const before = base[kind].get(module) ?? 0;
      const after = head[kind].get(module) ?? 0;
      if (before !== after) changes.push({ kind, module, before, after, delta: after - before });
    }
  }

  return changes
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta) || left.module.localeCompare(right.module))
    .slice(0, MAX_REPORTED_COUPLING_CHANGES);
}

function edgeList(title, edges) {
  if (edges.length === 0) return [`- ${title}: 없음`];

  const lines = [`- ${title}: ${edges.length}개`];
  for (const edge of edges.slice(0, MAX_REPORTED_EDGES)) {
    lines.push(`  - \`${edge.source}\` → \`${edge.target}\``);
  }
  if (edges.length > MAX_REPORTED_EDGES) {
    lines.push(`  - 그 외 ${edges.length - MAX_REPORTED_EDGES}개`);
  }
  return lines;
}

function buildReport({ blockers, warnings, changes, couplingChanges, hasBase }) {
  const lines = [REPORT_MARKER, "## Architecture boundaries", ""];

  if (blockers.length === 0) {
    lines.push("✅ 차단 규칙 위반이 없습니다.", "");
  } else {
    lines.push(`❌ 차단 규칙 위반 ${blockers.length}건`, "");
    for (const blocker of blockers) {
      const location = blocker.line ? `${blocker.source}:${blocker.line}` : blocker.source;
      lines.push(`- **${blocker.rule}** — \`${location}\``, `  - ${blocker.message}`);
    }
    lines.push("");
  }

  lines.push("### 검토가 필요한 변화", "");
  if (warnings.length === 0) {
    lines.push("- 새 경계 경고가 없습니다.");
  } else {
    for (const warning of warnings.slice(0, MAX_REPORTED_EDGES)) {
      lines.push(
        `- **${warning.rule}** — \`${warning.source}\` → \`${warning.target}\``,
        `  - ${warning.message}`,
      );
    }
    if (warnings.length > MAX_REPORTED_EDGES) {
      lines.push(`- 그 외 ${warnings.length - MAX_REPORTED_EDGES}건`);
    }
  }
  lines.push("");

  lines.push("### 내부 의존성 변화", "");
  if (hasBase) {
    lines.push(...edgeList("추가", changes.added), ...edgeList("제거", changes.removed));
  } else {
    lines.push("- 비교 기준이 없어 현재 트리만 검사했습니다.");
  }
  lines.push("");

  lines.push("### 결합도 변화 상위", "");
  if (couplingChanges.length === 0) {
    lines.push(hasBase ? "- 변화 없음" : "- 비교 기준이 없어 계산하지 않았습니다.");
  } else {
    for (const change of couplingChanges) {
      const label = change.kind === "fanIn" ? "fan-in" : "fan-out";
      const sign = change.delta > 0 ? "+" : "";
      lines.push(`- \`${change.module}\` ${label}: ${change.before} → ${change.after} (${sign}${change.delta})`);
    }
  }
  lines.push(
    "",
    "> 경고와 참조 수는 정보성입니다. `architecture-boundaries` job을 실패시키는 것은 차단 규칙뿐입니다.",
  );

  return `${lines.join("\n")}\n`;
}

function annotation(kind, finding) {
  const escape = (value) => String(value).replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
  const file = `file=${escape(finding.source)}`;
  const line = finding.line ? `,line=${finding.line}` : "";
  console.log(`::${kind} ${file}${line},title=${escape(finding.rule)}::${escape(finding.message)}`);
}

function printResult(blockers, warnings, moduleCount, dependencyCount) {
  for (const blocker of blockers) annotation("error", blocker);
  for (const warning of warnings) annotation("warning", warning);

  if (blockers.length === 0) {
    console.log(
      `아키텍처 차단 검사 통과 — 모듈 ${moduleCount}개, 내부 의존성 ${dependencyCount}개, 경고 ${warnings.length}건`,
    );
  } else {
    console.error(`아키텍처 차단 검사 실패 — ${blockers.length}건, 경고 ${warnings.length}건`);
    console.error("규칙의 근거: docs/architecture/04-dependency-boundaries.md");
  }
}

const options = readArguments(process.argv.slice(2));
const headResult = cruise(ROOT);
const baseResult = options.baseDir ? cruise(options.baseDir) : null;
const headEdges = internalEdges(headResult);
const baseEdges = baseResult ? internalEdges(baseResult) : null;
const blockers = [
  ...collectGraphBlockers(headEdges),
  ...collectUiSymbolBlockers(ROOT, headResult),
];
const changes = dependencyChanges(headEdges, baseEdges);
const couplingChanges = largestCouplingChanges(headEdges, baseEdges);
const report = buildReport({
  blockers,
  warnings: changes.warnings,
  changes,
  couplingChanges,
  hasBase: Boolean(baseResult),
});

if (options.reportFile) writeFileSync(options.reportFile, report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);

printResult(blockers, changes.warnings, headResult.modules.length, headEdges.length);
process.exit(blockers.length === 0 ? 0 : 1);
