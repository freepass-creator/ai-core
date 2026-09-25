# -*- coding: utf-8 -*-
"""PDF 에서 글자를 뽑는다 — **OCR 이 아니다.**

★대부분의 PDF 는 글자가 «들어 있다». 전자계약서·세금계산서·시트에서 만든 PDF 가 그렇다.
  그런 걸 OCR 에 넣으면 느리고 틀린다. 그냥 뽑으면 정확하다.
  글자가 안 나오면 그때가 «스캔본»이고, 그건 Vision API 가 필요하다.

  python scripts/pdf글자.py "문서.pdf"
  python scripts/pdf글자.py "문서.pdf" --pages 1-3
"""
import argparse
import os
import sys


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--pages", default="", help="1-3 처럼. 안 주면 전부")
    ap.add_argument("--out", default="", help="안 주면 화면에만")
    a = ap.parse_args()

    if not os.path.exists(a.pdf):
        sys.exit(f"파일이 없습니다 — {a.pdf}")
    try:
        import fitz
    except ImportError:
        sys.exit("PyMuPDF 가 없습니다 —  pip install pymupdf")

    doc = fitz.open(a.pdf)
    lo, hi = 1, doc.page_count
    if a.pages:
        p = a.pages.split("-")
        lo = int(p[0])
        hi = int(p[-1])

    out = []
    empty = 0
    for i in range(lo - 1, min(hi, doc.page_count)):
        t = doc[i].get_text().strip()
        if not t:
            empty += 1
        out.append(f"--- {i + 1}쪽 ---\n{t}")

    body = "\n\n".join(out)
    if a.out:
        with open(a.out, "w", encoding="utf-8") as f:
            f.write(body + "\n")
        print(f"\n  → {a.out}\n")
    else:
        print(body)

    # ★글자가 안 나오면 «스캔본»이다. 조용히 빈칸을 내놓지 않는다.
    if empty:
        print("")
        print(f"  ⚠ {empty}쪽에 글자가 없습니다 — **스캔본**일 수 있습니다.")
        print("     그림에서 글자를 읽으려면 Vision API 를 켜야 합니다.")
        print("     docs/노하우/OCR-글자읽기.md 를 보세요.")
        print("")


if __name__ == "__main__":
    main()
