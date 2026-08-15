---
description: Check flight-dashboard code/diff against this project's known bug patterns and gotchas (KST timezone handling, single /api/search entry point, no hardcoded data that should be live, dead code, UI text drift). Use before considering a change to this project done, or when the user asks for a code check/review here.
when_to_use: After making changes to flight-dashboard, or when asked to check/review/refactor this project's code
---

이 스킬은 flight-dashboard 프로젝트에서 반복됐던 실수들을 다시 체크하기 위한 것입니다.
`/code-review`가 diff의 일반적인 정확성/중복/효율성을 본다면, 이 스킬은 **이 프로젝트에서
실제로 났던 버그 패턴**을 명시적으로 하나씩 대조합니다. CLAUDE.md의 내용이 기준이므로,
먼저 최신 CLAUDE.md를 다시 읽고(내용이 바뀌었을 수 있음) 아래 체크리스트로 확인하세요.

## 절차

1. `CLAUDE.md`를 읽는다 (이 스킬의 체크리스트는 요약이며, CLAUDE.md가 항상 최신 기준).
2. `git diff` (또는 review 대상으로 지정된 범위)로 이번에 바뀐 코드를 확인한다.
3. 아래 체크리스트를 하나씩 대조한다 — diff에 해당 사항이 없으면 건너뛰되, **날짜/시간을
   다루는 코드, API 호출 경로, Redis 저장 스키마를 건드렸다면 반드시 전체를 확인**한다.
4. 발견한 문제를 요약해서 보고한다. 사소한 스타일 문제보다 아래 패턴 위반을 우선순위로 삼는다.

## 체크리스트

### 아키텍처
- [ ] 검색 로직이 여전히 `/api/search` 하나로만 통일되어 있는가? 버튼/루틴/다른 어떤 경로도
      별도로 검색 API를 호출하거나 새 검색 로직을 만들지 않았는가?
- [ ] 루틴(클라우드 샌드박스)에서 실행되는 코드가 myrealtrip.com이나 이 대시보드 도메인에
      raw fetch/curl을 시도하지 않는가? (네트워크 정책으로 막힘 — MCP 커넥터 경유해야 함)

### 타임존 (KST)
- [ ] 사용자에게 보여주는 `toLocaleDateString`/`toLocaleString` 호출에 전부
      `timeZone: 'Asia/Seoul'`이 명시되어 있는가?
- [ ] 날짜 문자열(`YYYY-MM-DD`) 파싱/연산에 `+09:00`을 직접 섞어 파싱하지 않았는가?
      (자정 부근에서 요일이 하루 밀리는 버그의 원인) 항상 `T00:00:00Z`로 자정 UTC 파싱 +
      UTC getter(`getUTCDay`, `setUTCDate` 등) 사용하는지 확인.

### 데이터 / Redis
- [ ] `flight_history`를 쓰는 코드가 여전히 "도착지 코드 하나"로만 키를 잡는가?
      (출발공항이나 날짜를 키에 섞으면 같은 노선이 여러 탭으로 쪼개지는 버그 재발)
- [ ] 저장 스키마(키 형식, 필드 구조)를 바꿨다면 — 기존 Redis 데이터가 새 코드와
      호환되는지, 아니면 마이그레이션/초기화가 필요한지 사용자에게 확인했는가?
- [ ] 이미 정규화된 형태로만 저장되는 필드에 대해, 불필요한 "혹시 모를 이상한 형식"
      방어 코드를 새로 추가하고 있지 않은가?

### 하드코딩
- [ ] 공휴일, 환율, 요금표처럼 시간이 지나면 바뀌는 데이터를 하드코딩하지 않았는가?
      (하드코딩된 2027년 설날 날짜가 실제와 달랐던 전례 있음 — 가능하면 라이브 소스 사용)

### UI / 코드 정리
- [ ] 검색 로직/범위/기준을 바꿨다면, 화면 문구나 툴팁 설명도 같이 업데이트했는가?
- [ ] 새 섹션/라벨이 기존 섹션들과 네이밍 패턴이 맞는가? (예: "🇯🇵 일본 최저가" 스타일)
- [ ] 존재 이유가 불분명한 UI 요소(설명 없는 문구, 죽은 변수/import)를 남기지 않았는가?
- [ ] "직항/경유"처럼 양자택일인 상태값을, 한쪽 조건일 때만 표시하고 반대는 빈칸으로
      두지 않았는가? (항상 둘 다 명시적으로 표시)

### 배포/커밋
- [ ] 디버그용 임시 라우트나 스크래치 파일을 커밋에 포함하지 않았는가? (`git status` 확인)
- [ ] 임시로 추가한 디버그/초기화용 API 라우트가 있다면 확인 후 제거했는가?
