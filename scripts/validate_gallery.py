#!/usr/bin/env python3
"""Validate the public gallery and its local entry points, without dependencies."""

import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]


def validate():
    data = json.loads((ROOT / "gallery.json").read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("gallery.json은 작품 항목의 배열이어야 합니다.")
    seen = set()
    for entry in data:
        if not isinstance(entry, dict):
            raise ValueError("각 작품 항목은 객체여야 합니다.")
        unknown = set(entry) - {"id", "title", "description", "creator", "school"}
        if unknown:
            raise ValueError("허용되지 않은 필드가 있습니다. 공개 목록 형식을 확인하세요.")
        work_id = entry.get("id")
        if not isinstance(work_id, str) or not re.fullmatch(r"[0-9]{3,}", work_id):
            raise ValueError("작품 번호는 001부터 시작하는 3자리 이상의 숫자 문자열이어야 합니다.")
        number = int(work_id)
        if number < 1 or number > 9007199254740991 or work_id != f"{number:03d}":
            raise ValueError("작품 번호의 0 채움 형식이 올바르지 않습니다.")
        if work_id in seen:
            raise ValueError("중복된 작품 번호가 있습니다.")
        seen.add(work_id)
        for field in ("title", "description"):
            value = entry.get(field)
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"{work_id}: {field}에 비어 있지 않은 문자열이 필요합니다.")
        for field in ("creator", "school"):
            if field in entry and (not isinstance(entry[field], str) or not entry[field].strip()):
                raise ValueError(f"{work_id}: 비공개 {field} 필드는 빈 값 대신 생략하세요.")
        folder = ROOT / "works" / work_id
        target = folder / "index.html"
        if (ROOT / "works").is_symlink() or folder.is_symlink() or target.is_symlink():
            raise ValueError(f"{work_id}: 작품 경로에 심볼릭 링크를 사용할 수 없습니다.")
        if not target.is_file() or not target.read_text(encoding="utf-8").strip():
            raise ValueError(f"{work_id}: 비어 있지 않은 works/{work_id}/index.html이 필요합니다.")
    print(f"PASS: 작품 {len(data)}개의 목록 형식·번호·실행 파일 확인 (앱 기능과 공개 동의는 별도 검토)")


if __name__ == "__main__":
    try:
        validate()
    except (OSError, UnicodeError, ValueError, RecursionError) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        sys.exit(1)
