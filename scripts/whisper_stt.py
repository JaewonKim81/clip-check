# ============================================================
# 로컬 Whisper 음성 인식 — 오디오 파일을 받아 자막 세그먼트 JSON 출력
# 사용: python scripts/whisper_stt.py <audio_path> [--model base] [--language ko]
# stdout: {"segments": [{"t": 시작초, "text": "..."}]}
# ============================================================
import argparse
import json
import sys

import torch
import whisper


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("audio")
    parser.add_argument("--model", default="base")
    parser.add_argument("--language", default="ko")
    args = parser.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = whisper.load_model(args.model, device=device)

    result = model.transcribe(
        args.audio,
        language=args.language or None,
        fp16=(device == "cuda"),
        verbose=False,
    )

    segments = [
        {"t": float(seg["start"]), "text": seg["text"].strip()}
        for seg in result.get("segments", [])
        if seg.get("text", "").strip()
    ]
    # stdout 은 JSON 전용 (진행 로그는 whisper 가 stderr 로 출력)
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps({"segments": segments}, ensure_ascii=False))


if __name__ == "__main__":
    main()
