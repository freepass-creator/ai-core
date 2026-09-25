# -*- coding: utf-8 -*-
"""통화녹음·회의 전사 — **이 PC 안에서** 돌린다.

★바깥 API 를 안 쓴다. 통화녹음에는 고객 이름·전화번호·계약 이야기가 다 들어 있다.
  남의 서버에 올리지 않는다.

  python scripts/전사.py                              ★그냥 이것 — 카톡·다운로드에서 새 녹음을 걷어와 전부 전사
  python scripts/전사.py "녹음.m4a"                    파일 하나
  python scripts/전사.py "C:\\dev\\_받은자료\\녹음"        폴더 통째 (하위까지 · 이미 된 건 건너뜀)
  python scripts/전사.py "녹음.m4a" --model large-v3 --language ko

결과는 원본 옆에 `<이름>.txt` 로 떨어진다. 말한 시각이 같이 찍힌다.

■ 인자 없이 돌리면 (걷어오기 모드)
  폰에서 PC로 넘긴 녹음은 보통 **카카오톡 받은 파일**이나 **다운로드**에 떨어진다.
  그 둘을 훑어 새 녹음을 `C:\\dev\\_받은자료\\녹음\\` 으로 **복사**(원본은 그대로 둔다)한 뒤 전사한다.
  같은 이름이 이미 인박스에 있으면 건너뛴다 — 몇 번을 돌려도 같은 결과다.

■ 장치·모델은 알아서 고른다 (2026-08-30 추가)
  GPU(CUDA) 있으면   large-v3 · float16   ← 이 PC는 RTX 3060 이라 이쪽으로 간다
  없으면             small    · int8
  `--model` `--device` 를 주면 그 값이 이긴다.
"""
import argparse
import os
import shutil
import sys
import time

AUDIO_EXT = {".m4a", ".mp3", ".wav", ".mp4", ".aac", ".flac", ".ogg", ".wma", ".amr"}

# 폰에서 PC로 넘긴 녹음이 떨어지는 자리 · 걷어와서 인박스에 모은다
HOME = os.path.expanduser("~")
INBOX = r"C:\dev\_받은자료\녹음"
SOURCES = [
    os.path.join(HOME, "Documents", "카카오톡 받은 파일"),
    os.path.join(HOME, "Downloads"),
]


def hms(s):
    s = int(s)
    return f"{s // 3600:02d}:{s % 3600 // 60:02d}:{s % 60:02d}"


def pick_device(want):
    """--device 를 안 줬으면 GPU 가 있는지 보고 정한다."""
    if want in ("cuda", "cpu"):
        return want, ("float16" if want == "cuda" else "int8")
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda", "float16"
    except Exception:
        pass
    return "cpu", "int8"


def collect(target):
    """파일이면 그 하나, 폴더면 하위 소리파일 전부(이름순)."""
    if os.path.isfile(target):
        return [target]
    found = []
    for root, _, files in os.walk(target):
        for f in sorted(files):
            if os.path.splitext(f)[1].lower() in AUDIO_EXT:
                found.append(os.path.join(root, f))
    return found


def gather():
    """카톡 받은 파일·다운로드에서 새 녹음을 인박스로 복사한다. 원본은 그대로 둔다."""
    os.makedirs(INBOX, exist_ok=True)
    got, seen = [], 0
    for src in SOURCES:
        if not os.path.isdir(src):
            continue
        for root, _, files in os.walk(src):
            if os.path.abspath(root).startswith(os.path.abspath(INBOX)):
                continue
            for f in sorted(files):
                if os.path.splitext(f)[1].lower() not in AUDIO_EXT:
                    continue
                seen += 1
                dst = os.path.join(INBOX, f)
                if os.path.exists(dst):
                    continue
                shutil.copy2(os.path.join(root, f), dst)
                got.append(f)
    print(f"\n  걷어오기  {os.path.basename(SOURCES[0])} · 다운로드 에서 소리파일 {seen}개 확인")
    if got:
        print(f"            새로 가져옴 {len(got)}개 → {INBOX}")
        for f in got[:10]:
            print(f"              + {f}")
        if len(got) > 10:
            print(f"              … 외 {len(got) - 10}개")
    else:
        print("            새로 가져올 것 없음 (원본은 건드리지 않았다)")
    return INBOX


def transcribe_one(model, path, out_path, model_name, language, echo):
    t0 = time.time()
    segs, info = model.transcribe(path, language=language or None, vad_filter=True)
    lines = []
    for s in segs:
        line = f"[{hms(s.start)}] {s.text.strip()}"
        lines.append(line)
        if echo:
            print("  " + line)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(f"# {os.path.basename(path)}\n")
        f.write(f"# 길이 {hms(info.duration)} · 모델 {model_name} · 언어 {info.language}\n\n")
        f.write("\n".join(lines) + "\n")
    return time.time() - t0, info.duration, len(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audio", nargs="?", default="",
                    help="소리 파일 또는 폴더. 안 주면 카톡·다운로드에서 걷어와 인박스를 전사한다")
    ap.add_argument("--model", default="", help="tiny · base · small · medium · large-v3 (안 주면 장치에 맞춰 고름)")
    ap.add_argument("--language", default="ko", help="안 주면 알아서 맞히는데 짧은 녹음에서 틀린다")
    ap.add_argument("--out", default="", help="결과 파일. 파일 1개일 때만. 안 주면 원본 옆에 .txt")
    ap.add_argument("--device", default="", help="cuda · cpu (안 주면 GPU 있으면 cuda)")
    ap.add_argument("--redo", action="store_true", help="이미 .txt 가 있어도 다시 전사")
    a = ap.parse_args()

    target = a.audio or gather()

    if not os.path.exists(target):
        sys.exit(f"경로가 없습니다 — {target}")

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        sys.exit("faster-whisper 가 없습니다 —  pip install faster-whisper")

    device, compute = pick_device(a.device)
    model_name = a.model or ("large-v3" if device == "cuda" else "small")

    todo = collect(target)
    if not todo:
        sys.exit(f"소리 파일이 없습니다 — {target}")

    skipped = 0
    if not a.redo:
        keep = []
        for p in todo:
            if os.path.exists(os.path.splitext(p)[0] + ".txt"):
                skipped += 1
            else:
                keep.append(p)
        todo = keep

    print(f"\n  대상   {len(todo)}건" + (f"  (이미 전사됨 {skipped}건 건너뜀)" if skipped else ""))
    print(f"  장치   {device} · {compute}   모델 {model_name}")
    if not todo:
        print("  할 일이 없습니다. 다시 하려면 --redo\n")
        return
    print("         ★처음 쓰는 모델이면 내려받습니다\n")

    model = WhisperModel(model_name, device=device, compute_type=compute)
    echo = len(todo) == 1          # 한 건이면 화면에도 뿌린다(옛 동작 유지)

    t_all = time.time()
    ok = fail = 0
    for i, p in enumerate(todo, 1):
        out = a.out if (a.out and len(todo) == 1) else os.path.splitext(p)[0] + ".txt"
        print(f"  [{i}/{len(todo)}] {os.path.basename(p)}  ({os.path.getsize(p) / 1048576:.1f}MB)")
        try:
            took, dur, n = transcribe_one(model, p, out, model_name, a.language, echo)
            print(f"          → {out}")
            print(f"          {n}줄 · 녹음 {hms(dur)} · 걸린 시간 {hms(took)}")
            ok += 1
        except Exception as e:
            print(f"          실패: {e}")
            fail += 1

    print(f"\n  완료 {ok}건" + (f" · 실패 {fail}건" if fail else "") + f"  ·  전체 {hms(time.time() - t_all)}\n")


if __name__ == "__main__":
    main()
