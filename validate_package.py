"""Self-checks for the research and role-mapping package."""

from __future__ import annotations

import csv
import json
from pathlib import Path

import role_matcher


ROOT = Path(__file__).resolve().parent


def load_json(name: str):
    with (ROOT / name).open(encoding="utf-8") as handle:
        return json.load(handle)


def main() -> None:
    schema = load_json("role_mapping_schema.json")
    assert schema["$schema"].endswith("draft/2020-12/schema")
    examples = load_json("office_mapping_examples.json")
    sample = load_json("sample_mapping_output.json")

    assert len(examples["examples"]) == 8
    assert all(len(item["alternatives"]) == 2 for item in examples["examples"])
    known_example_sources = set(examples["source_registry"])
    example_refs = {
        source_id
        for item in examples["examples"]
        for candidate in [item["primary"], *item["alternatives"]]
        for source_id in candidate["source_ids"]
    }
    assert example_refs <= known_example_sources
    assert sample["schema_version"] == "1.0"
    assert sample["historical_candidates"]
    sample_sources = {item["source_id"] for item in sample["sources"]}
    sample_refs = {
        evidence["source_id"]
        for candidate in sample["historical_candidates"]
        for evidence in candidate["evidence_refs"]
    }
    assert sample_refs <= sample_sources

    with (ROOT / "dynasty_systems.csv").open(encoding="utf-8-sig", newline="") as handle:
        matrix = list(csv.DictReader(handle))
    with (ROOT / "source_registry.csv").open(encoding="utf-8-sig", newline="") as handle:
        sources = list(csv.DictReader(handle))
    source_ids = {row["source_id"] for row in sources}
    matrix_refs = {source_id for row in matrix for source_id in row["source_ids"].split(";")}
    assert len(matrix) == 88
    assert len({row["period"] for row in matrix}) == 11
    assert len({row["dimension"] for row in matrix}) == 8
    assert matrix_refs <= source_ids
    assert len(sources) >= 40

    records = role_matcher.load_records()
    queries = [
        "财政厅厅长",
        "县公安局长",
        "军分区主官",
        "医院负责人",
        "企业技术人员",
        "省级教育部门负责人",
        "法院院长",
        "边疆事务负责人",
    ]
    for query in queries:
        result = role_matcher.search(query, records, 3)
        assert len(result) == 3, query
        assert all(0 <= item["similarity"] <= 1 for item in result)
        assert all(item["confidence"] in {"高", "中", "低"} for item in result)

    print("PASS: schema, examples, source references, 88 matrix rows, and 8 matcher queries")


if __name__ == "__main__":
    main()
