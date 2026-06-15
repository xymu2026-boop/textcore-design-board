"""批量处理 素材/ 下所有 .docx：跑完整流水线 + 打分 + 写报告。

用法:
  python scripts/batch_process.py            # 处理全部
  python scripts/batch_process.py --limit 1  # 只处理 1 篇(测试)
报告: data/batch_report.csv（增量写，单篇失败跳过不中断）。
"""
from __future__ import annotations

import argparse
import asyncio
import csv
import io
import re
import subprocess
import sys
import time
from pathlib import Path

from starlette.datastructures import Headers, UploadFile

from textcore.config import load_env
from textcore.pipeline.deterministic.quality_rubric import score_course
from textcore.pipeline.events import StatusEventBroker
from textcore.pipeline.runner import run_fake_pipeline
from textcore.storage import CourseRepository

load_env()
ROOT = Path(__file__).resolve().parents[1]
MATERIALS = ROOT / "素材"
REPORT = ROOT / "data" / "batch_report.csv"
NOTIFY = Path.home() / "Products" / "ai-control-tower"
DOCX_CT = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
FIELDS = [
    "idx", "course_id", "file", "status", "chunks", "orig_chars",
    "faithful", "concise", "study", "outline",
    "cards", "materials", "classics_matched", "review_flags",
    "quality", "seconds",
]


def feishu(msg: str) -> None:
    try:
        subprocess.run(
            ["./node_modules/.bin/tsx", "scripts/notify.ts", msg],
            cwd=NOTIFY, timeout=30, capture_output=True,
        )
    except Exception:
        pass


def _text_len(s: str) -> int:
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"[#>*`\-\[\]()|]+", "", s)
    return len(re.sub(r"\s+", "", s))


def _ratio(state: dict, key: str, orig: int) -> str:
    body = state.get("versions", {}).get(key, {}).get("body_md", "")
    return f"{_text_len(body) / orig:.0%}" if orig else "0%"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    docs = sorted(MATERIALS.glob("*.docx"))
    if args.limit:
        docs = docs[: args.limit]
    repo = CourseRepository()
    repo.migrate()
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    new_file = not REPORT.exists()
    report_fh = REPORT.open("a", newline="", encoding="utf-8")
    writer = csv.DictWriter(report_fh, fieldnames=FIELDS)
    if new_file:
        writer.writeheader()
        report_fh.flush()

    total = len(docs)
    feishu(f"【文心·批量开始】共 {total} 篇课稿，逐篇跑完整流水线+打分，预计每篇几分钟。")
    ok = 0
    for idx, doc in enumerate(docs, 1):
        name = doc.name
        cid = f"course_batch_{idx:02d}"
        t0 = time.time()
        row = {f: "" for f in FIELDS}
        row.update(idx=idx, course_id=cid, file=name)
        try:
            with doc.open("rb") as fh:
                upload = UploadFile(
                    file=io.BytesIO(fh.read()),
                    filename=name,
                    headers=Headers({"content-type": DOCX_CT}),
                )
            source_path = repo.create_course(cid, upload)
            asyncio.run(
                run_fake_pipeline(
                    repository=repo,
                    events=StatusEventBroker(),
                    course_id=cid,
                    source_filename=name,
                    source_path=source_path,
                )
            )
            st = repo.get_state(cid)
            orig = sum(len(p.get("text", "")) for p in st.get("paragraphs", []))
            sc = score_course(st)
            row.update(
                status=st.get("status"),
                chunks=len(st.get("chunks", [])),
                orig_chars=orig,
                faithful=_ratio(st, "faithful", orig),
                concise=_ratio(st, "concise", orig),
                study=_ratio(st, "study", orig),
                outline=_ratio(st, "outline", orig),
                cards=len(st.get("knowledge_cards", [])),
                materials=len(st.get("writing_materials", [])),
                classics_matched=sum(1 for r in st.get("classics_refs", []) if r.get("matched")),
                review_flags=len(st.get("review_flags", [])),
                quality=sc.get("overall"),
                seconds=int(time.time() - t0),
            )
            ok += 1
            print(f"[{idx}/{total}] OK {name} q={sc.get('overall')} "
                  f"{row['faithful']}/{row['concise']}/{row['study']}/{row['outline']} "
                  f"{row['seconds']}s", flush=True)
        except Exception as exc:  # noqa: BLE001 - 单篇失败不中断批量
            row.update(status=f"failed: {str(exc)[:60]}", seconds=int(time.time() - t0))
            print(f"[{idx}/{total}] FAIL {name}: {exc}", flush=True)
        writer.writerow(row)
        report_fh.flush()
        if idx % 5 == 0 or idx == total:
            feishu(f"【文心·批量进度 {idx}/{total}】已成功 {ok} 篇，报告 data/batch_report.csv")

    report_fh.close()
    feishu(f"【文心·批量完成 ✅】{ok}/{total} 篇成功。报告 data/batch_report.csv，可在课稿库逐篇验收。")
    print(f"DONE {ok}/{total}", flush=True)


if __name__ == "__main__":
    sys.exit(main())
