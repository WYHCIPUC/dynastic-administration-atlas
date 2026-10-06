"""Rule-based prototype for modern-role to historical-role lookup.

The prototype deliberately reports functional analogies instead of pretending
that modern ranks map one-to-one to ancient品秩. It reads the curated examples
file produced with this research package and keeps uncertainty visible.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parent
EXAMPLES = ROOT / "office_mapping_examples.json"

FUNCTION_KEYWORDS = {
    "finance": "财政 税务 财务 预算 国库 审计 赋税 田赋 漕运 盐政",
    "military": "军队 军事 军区 驻防 边防 司令 兵营 武官 武警 作战",
    "policing": "公安 警察 治安 刑侦 捕盗 巡检 监狱",
    "justice": "法院 检察 司法 审判 刑狱 律法 案件",
    "administration": "政府 行政 厅 局 委 部 处 县长 市长 省长 主任",
    "education": "教育 学校 教委 大学 教师 科举 讲学",
    "medical": "医院 医疗 医生 卫生 药 医馆 疾病",
    "engineering": "工程 水利 交通 建设 工务 营造",
    "diplomacy_frontier": "外交 使馆 边疆 民族 西藏 新疆 蒙古 藩属 都护",
    "technology": "技术 研发 工程师 研究员 实验室 软件 科学",
}

LEVEL_KEYWORDS = {
    "central": "中央 国家 部委 国务院 京师 朝廷",
    "provincial": "省 省级 厅 巡抚 总督",
    "prefectural": "市 地区 府 州",
    "county": "县 县级",
    "grassroots": "乡 镇 街道 村 里",
    "frontier": "边疆 边防 驻防 口岸 都护",
}


def normalize(text: str) -> str:
    return re.sub(r"\s+", "", text.lower())


def detect_tags(text: str, table: dict[str, str]) -> list[str]:
    value = normalize(text)
    return [tag for tag, words in table.items() if any(w in value for w in words.split())]


def iter_records(payload: Any) -> Iterable[dict[str, Any]]:
    """Accept either a list or a {"examples": [...]} document."""
    if isinstance(payload, list):
        yield from (x for x in payload if isinstance(x, dict))
    elif isinstance(payload, dict):
        examples = payload.get("examples", payload.get("records", []))
        if isinstance(examples, list):
            yield from (x for x in examples if isinstance(x, dict))


def flatten_text(value: Any) -> str:
    if isinstance(value, dict):
        return " ".join(flatten_text(v) for v in value.values())
    if isinstance(value, list):
        return " ".join(flatten_text(v) for v in value)
    return str(value)


def record_text(record: dict[str, Any]) -> str:
    pieces: list[str] = []
    for key in (
        "modern_input",
        "modern_role",
        "input",
        "functional_tags",
        "functions",
        "organization",
        "primary_candidate",
        "historical_office",
        "ancient_candidate",
        "office_name",
        "institution_level",
        "function_domains",
        "duty_difference",
        "daily_activities",
        "clothing",
        "life",
        "risks",
        "dynasty",
    ):
        pieces.append(flatten_text(record.get(key, "")))
    # Include nested primary/alternative candidate fields. This allows the
    # CLI to rank historical candidates rather than only ranking examples.
    for key in ("primary", "alternatives"):
        if key in record:
            pieces.append(flatten_text(record[key]))
    return normalize(" ".join(pieces))


def score(query: str, record: dict[str, Any]) -> tuple[float, dict[str, Any]]:
    q = normalize(query)
    q_functions = set(detect_tags(q, FUNCTION_KEYWORDS))
    q_levels = set(detect_tags(q, LEVEL_KEYWORDS))
    text = record_text(record)
    r_functions = set(detect_tags(text, FUNCTION_KEYWORDS))
    r_levels = set(detect_tags(text, LEVEL_KEYWORDS))

    function_hits = sorted(q_functions & r_functions)
    level_hits = sorted(q_levels & r_levels)
    lexical_hits = sum(1 for token in re.findall(r"[\u4e00-\u9fff]{2,}", q) if token in text)

    # Function is more meaningful than the modern title itself; level is a
    # smaller adjustment because historical jurisdictions vary by dynasty.
    raw = 0.55 * min(1.0, len(function_hits) / max(1, len(q_functions)))
    raw += 0.20 * min(1.0, len(level_hits) / max(1, len(q_levels)))
    raw += 0.25 * min(1.0, lexical_hits / 2)
    confidence = record.get("confidence", record.get("置信度", "中"))
    if isinstance(confidence, (int, float)):
        confidence_label = "高" if confidence >= 0.8 else "中" if confidence >= 0.5 else "低"
    else:
        confidence_label = str(confidence)
    return raw, {
        "function_hits": function_hits,
        "level_hits": level_hits,
        "lexical_hits": lexical_hits,
        "confidence": confidence_label,
    }


def iter_candidates(records: Iterable[dict[str, Any]]) -> Iterable[dict[str, Any]]:
    """Flatten each example into one primary and zero or more alternatives."""
    for record in records:
        modern_input = record.get("modern_input", record.get("modern_role", record.get("input", "")))
        primary = record.get("primary")
        alternatives = record.get("alternatives", [])
        if isinstance(primary, dict):
            yield {"modern_input": modern_input, **primary}
        if isinstance(alternatives, list):
            for candidate in alternatives:
                if isinstance(candidate, dict):
                    yield {"modern_input": modern_input, **candidate}


def load_records(path: Path = EXAMPLES) -> list[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"找不到示例数据：{path}")
    with path.open("r", encoding="utf-8") as handle:
        return list(iter_records(json.load(handle)))


def search(query: str, records: list[dict[str, Any]], limit: int = 3) -> list[dict[str, Any]]:
    ranked = []
    candidates = list(iter_candidates(records))
    # Older data files may contain flat records; preserve compatibility.
    if not candidates:
        candidates = records
    for record in candidates:
        value, diagnostics = score(query, record)
        if value <= 0:
            continue
        ranked.append((value, record, diagnostics))
    ranked.sort(key=lambda item: item[0], reverse=True)
    results = []
    for value, record, diagnostics in ranked[:limit]:
        results.append({"similarity": round(value, 3), **diagnostics, **record})
    return results


def infer_scenario(query: str) -> dict[str, str]:
    """Choose a transparent default setting when the user omits place/era."""
    levels = set(detect_tags(query, LEVEL_KEYWORDS))
    if "frontier" in levels:
        location = "边疆驻防或边镇（由候选官职进一步校正）"
    elif "central" in levels:
        location = "京师中央官署"
    elif "provincial" in levels:
        location = "省城或路府治所"
    elif "prefectural" in levels:
        location = "府州城"
    elif "county" in levels:
        location = "县城与县署"
    elif "grassroots" in levels:
        location = "乡里、里甲或保甲基层"
    else:
        location = "按候选官职的典型驻地分别呈现"
    return {
        "dynasty": "未指定；按候选官职所属时期分别呈现",
        "location": location,
        "assumption": "现代输入未指定朝代和地区，生活细节使用该官职的典型情景，并把推测标为情景重建。",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="现代职位到历史角色的职能类比检索原型")
    parser.add_argument("query", help="现代单位与职位的自由文本")
    parser.add_argument("--limit", type=int, default=3, help="返回候选数，默认3")
    parser.add_argument("--data", type=Path, default=EXAMPLES, help="示例映射 JSON 路径")
    args = parser.parse_args()

    records = load_records(args.data)
    output = {
        "modern_input": args.query,
        "detected_functions": detect_tags(args.query, FUNCTION_KEYWORDS),
        "detected_levels": detect_tags(args.query, LEVEL_KEYWORDS),
        "inferred_scenario": infer_scenario(args.query),
        "candidates": search(args.query, records, args.limit),
        "method_note": "候选是职能类比，不是现代职级与古代品秩的一一换算；生活细节须以记录中的证据等级为准。",
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
