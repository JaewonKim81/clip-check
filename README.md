# ClipCheck — 영상 아카이브 & 금칙 검수 시스템

영상을 올리면 자동으로 분석·저장하고, 자연어로 검색하며, 방영 전 금칙 검수까지 처리하는 웹 서비스.

## 요구 사항

- Node.js 20+
- ffmpeg / ffprobe (PATH에 등록)
- Python 3.10+ 와 whisper 라이브러리 (`pip install openai-whisper`) — 음성 인식(자막 생성)용
- OpenAI API 키 (장면 분석 · 금칙 판정 · 자막 교정 · 검색 임베딩)

## 설치 및 실행

```bash
npm install
copy .env.example .env   # OPENAI_API_KEY 입력 (텔레그램 알림은 선택)
npm run build            # 프론트엔드 빌드
npm run server           # → http://localhost:3001
```

개발 모드 (프론트 HMR): 터미널 2개로 `npm run server` + `npm run dev` → http://localhost:5173

## 구조

```
server/          Express API + 처리 파이프라인 (병렬 DAG)
  stages.js      8단계: 자막추출 → 교정 / 장면분석·기술검토 → 색인 / 샘플링 → 금칙판정 → 종합판정
  ffmpeg.js      프레임 샘플링(1초 간격), 무음·블랙·프리즈·클리핑 감지, 자막 추출
  openai.js      GPT vision 판정 · 자막 교정 · 임베딩
  whisper.js     로컬 python whisper 음성 인식 (scripts/whisper_stt.py)
  search.js      hybrid / keyword(FTS5) / vector(임베딩) / filter
rules/금칙기준.md  판정 기준 — 이 파일만 수정하면 다음 영상부터 즉시 반영
src/             React 프론트엔드 (대시보드 · 업로드 · 아카이브검색 · 검수 리포트)
data/            업로드 원본 · 프레임 이미지 · SQLite DB (재시작 후에도 유지)
```

## 금칙 판정 방식 (PRD v1.1)

- 약 **1초 간격** 프레임 샘플링 → 짧은 장면도 누락 없음
- **연속 3장 묶음** 판정 → 동작의 흐름(때리기·밀치기 등) 판단
- 해당 구간 **대사·소리도 판단 근거**로 사용
- 카테고리 8종 (방송심의 규정) · 심각도 0–5 · 경계 사례는 검토필요로 분류
- 출력물: report.json · violations.csv · 운영절차서.md (리포트 화면에서 다운로드)
