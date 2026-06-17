/**
 * 数据服务层
 *
 * 目前所有数据均从 frontend/public/data/ 下的本地 JSON 读取（通过 fetch）。
 * 数据由 scripts/copy-data.sh 从项目根的 datasets/ 与 outputs/ 拷贝而来：
 *   public/data/cases/{caseId}.json     ← datasets/cases/processed/{caseId}.json
 *   public/data/outputs/{caseId}.json   ← outputs/{caseId}/state_final.json
 *   public/data/manifest.json           ← 拷贝脚本生成的 id 清单
 *
 * 之所以需要 manifest.json：浏览器无法列目录，必须有一份显式的 id 清单
 * 才能实现 listCases()。
 *
 * 将来若接入实时后端，只需替换这一层的实现，类型契约保持不变。
 */

import type {
  CaseInput,
  CaseOutput,
  CaseSplit,
  CaseSummary,
  DataManifest,
} from "../types";

/** 数据根目录（尊重 Vite 的 base 配置）。 */
const DATA_BASE = `${import.meta.env.BASE_URL}data`;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`请求失败 ${url}（HTTP ${res.status}）`);
  }
  return (await res.json()) as T;
}

/* ---- manifest 缓存（同一会话只取一次）--------------------------------- */

let manifestCache: DataManifest | null = null;

async function getManifest(): Promise<DataManifest> {
  if (!manifestCache) {
    manifestCache = await fetchJson<DataManifest>(`${DATA_BASE}/manifest.json`);
  }
  return manifestCache;
}

/** 根据 manifest 的划分清单判断某案件归属（开发集 / 测试集 / 不在划分中）。 */
function splitOf(manifest: DataManifest, caseId: string): CaseSplit | null {
  if (manifest.splits?.development.includes(caseId)) return "dev";
  if (manifest.splits?.test.includes(caseId)) return "test";
  return null;
}

function toSummary(
  c: CaseInput,
  hasOutput: boolean,
  split: CaseSplit | null,
): CaseSummary {
  return {
    case_id: c.case_id,
    title: c.title,
    task_mode: c.task_mode,
    case_category: c.domain.case_category,
    primary_issue_type: c.domain.primary_issue_type,
    difficulty: c.metadata.difficulty,
    paired_case_id: c.metadata.paired_case_id,
    pair_variant: c.metadata.pair_variant,
    neutral_summary: c.case_narrative.neutral_summary,
    has_output: hasOutput,
    split,
  };
}

/**
 * 读取所有案件，返回摘要列表。
 */
export async function listCases(): Promise<CaseSummary[]> {
  const manifest = await getManifest();
  const outputs = new Set(manifest.outputs);
  const cases = await Promise.all(manifest.cases.map((id) => getCase(id)));
  return cases.map((c) =>
    toSummary(c, outputs.has(c.case_id), splitOf(manifest, c.case_id)),
  );
}

/**
 * 读取单个案件输入。
 */
export async function getCase(caseId: string): Promise<CaseInput> {
  return fetchJson<CaseInput>(`${DATA_BASE}/cases/${caseId}.json`);
}

/**
 * 第一个已有运行产物的案件 id（用于演示模式自动跳转到首个可展示的案例）。
 * 没有任何产物时返回 null。仅读 manifest，不拉取案件正文。
 */
export async function firstRunCaseId(): Promise<string | null> {
  const manifest = await getManifest();
  return manifest.outputs[0] ?? null;
}

/**
 * 读取单个案件的运行产物（state_final.json）。
 * 若该案件没有产物则返回 null。
 */
export async function getCaseOutput(caseId: string): Promise<CaseOutput | null> {
  const manifest = await getManifest();
  if (!manifest.outputs.includes(caseId)) {
    return null;
  }
  try {
    return await fetchJson<CaseOutput>(`${DATA_BASE}/outputs/${caseId}.json`);
  } catch {
    return null;
  }
}

/**
 * 根据 pairId 找到最小对照组的 A/B 两案，按 pair_variant 排序（A 在前）。
 *
 * pairId 既可以是配对基名（如 "criminal_001"），也可以是其中一个成员 id
 * （如 "criminal_001a"）——后者会通过 metadata.paired_case_id 找到另一半。
 */
export async function getPairCases(
  pairId: string,
): Promise<[CaseInput, CaseInput]> {
  const manifest = await getManifest();

  let members: CaseInput[];
  if (manifest.cases.includes(pairId)) {
    // pairId 本身是一个成员 id：取它和它的配对案。
    const first = await getCase(pairId);
    const other = await getCase(first.metadata.paired_case_id);
    members = [first, other];
  } else {
    // pairId 是配对基名：取 {base}a 与 {base}b。
    members = await Promise.all([
      getCase(`${pairId}a`),
      getCase(`${pairId}b`),
    ]);
  }

  const sorted = [...members].sort((a, b) => {
    if (a.metadata.pair_variant === b.metadata.pair_variant) {
      return a.case_id.localeCompare(b.case_id);
    }
    return a.metadata.pair_variant === "A" ? -1 : 1;
  });

  return [sorted[0], sorted[1]];
}
