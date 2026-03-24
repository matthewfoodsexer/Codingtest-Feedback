# Baekjoon 코딩테스트 피드백 Chrome Extension 계획서

## 개요
백준(Baekjoon) 문제 풀이 후, AI가 최적 솔루션을 제시하고 내 코드와 비교 분석하여
Chrome 브라우저 내에서 피드백을 보여주는 Chrome Extension.

---

## 아키텍처

```
┌─────────────────────────────────────────────────┐
│              Chrome Extension                    │
│                                                  │
│  ┌──────────────┐   ┌────────────────────────┐  │
│  │ Content Script│   │    Side Panel UI        │  │
│  │              │   │                        │  │
│  │ - 문제 정보   │──▶│ - 피드백 리포트 렌더링   │  │
│  │   스크래핑    │   │ - 최적해 vs 내 코드     │  │
│  │ - 제출 코드   │   │ - 개선점 하이라이트     │  │
│  │   감지       │   │ - 시간/공간 복잡도 비교  │  │
│  └──────────────┘   └────────────────────────┘  │
│         │                      ▲                 │
│         ▼                      │                 │
│  ┌─────────────────────────────┐                 │
│  │    Background Service Worker │                 │
│  │                             │                 │
│  │  - Claude API 호출           │                 │
│  │  - API Key 관리 (storage)    │                 │
│  │  - 응답 파싱 및 전달         │                 │
│  └─────────────────────────────┘                 │
└─────────────────────────────────────────────────┘
                    │
                    ▼
         ┌──────────────────┐
         │  Anthropic Claude │
         │      API          │
         └──────────────────┘
```

---

## 프로젝트 구조

```
codingtest_feedback/
├── manifest.json              # Chrome Extension 매니페스트 (Manifest V3)
├── background/
│   └── service-worker.js      # Claude API 호출, 메시지 라우팅
├── content/
│   ├── detector.js            # 백준 페이지에서 문제/코드 스크래핑
│   └── injector.js            # 페이지에 피드백 버튼 삽입
├── sidepanel/
│   ├── sidepanel.html         # 사이드패널 UI
│   ├── sidepanel.css          # 스타일링
│   └── sidepanel.js           # 피드백 렌더링 로직
├── popup/
│   ├── popup.html             # 설정 팝업 (API Key 입력 등)
│   ├── popup.css
│   └── popup.js
├── utils/
│   ├── api.js                 # Claude API 통신 모듈
│   ├── parser.js              # 백준 페이지 파싱 유틸
│   └── prompt.js              # AI 프롬프트 템플릿
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── PLAN.md
```

---

## 구현 단계

### Phase 1: 기본 Extension 세팅
1. **manifest.json** 작성 (Manifest V3)
   - permissions: `activeTab`, `sidePanel`, `storage`
   - host_permissions: `https://www.acmicpc.net/*` (백준 도메인)
   - content_scripts: 백준 문제/제출 페이지에서 자동 실행
   - side_panel: 피드백 표시용

2. **Popup (설정 페이지)**
   - Anthropic API Key 입력 및 `chrome.storage.local`에 암호화 저장
   - 선호 언어 설정 (기본: C/C++)
   - 분석 레벨 선택 (간단/상세)

### Phase 2: 백준 페이지 스크래핑
3. **Content Script - 문제 정보 추출** (`detector.js`)
   - 대상 페이지: `acmicpc.net/problem/{번호}`
   - 추출 항목:
     - 문제 번호, 제목
     - 문제 설명 (입력/출력 조건 포함)
     - 시간/메모리 제한
     - 예제 입출력
   - CSS Selector 기반 파싱

4. **Content Script - 제출 코드 감지** (`detector.js`)
   - 대상 페이지: `acmicpc.net/status` (내 제출 목록)
   - 또는: `acmicpc.net/submit/{번호}` (제출 페이지의 코드 에디터)
   - "맞았습니다!!" 결과 감지 시 자동 트리거 (또는 수동 버튼)
   - 제출한 소스코드 텍스트 추출

5. **페이지에 분석 버튼 삽입** (`injector.js`)
   - 문제 페이지 또는 제출 결과 페이지에 "AI 피드백 받기" 버튼 삽입
   - 클릭 시 사이드패널 열기 + 분석 시작

### Phase 3: Claude API 연동
6. **프롬프트 설계** (`prompt.js`)
   ```
   시스템 프롬프트:
   "당신은 알고리즘 전문가입니다. 주어진 백준 문제에 대해:
    1. 가장 효율적인 C/C++ 풀이를 작성하세요
    2. 사용자의 코드와 비교 분석하세요
    3. 시간/공간 복잡도를 비교하세요
    4. 구체적인 개선점을 제시하세요"

   유저 프롬프트:
   "## 문제
    {문제 설명}

    ## 제약 조건
    시간 제한: {N}초 | 메모리 제한: {M}MB

    ## 내 코드
    ```cpp
    {사용자 코드}
    ```

    위 내용을 분석해주세요."
   ```

7. **API 호출 모듈** (`api.js`)
   - `claude-sonnet-4-6` 모델 사용 (빠른 응답 + 충분한 품질)
   - Streaming 응답으로 사이드패널에 실시간 표시
   - 에러 처리 (API Key 미설정, 요금 초과 등)

8. **Background Service Worker** (`service-worker.js`)
   - Content Script ↔ Side Panel 간 메시지 브릿지
   - API 호출은 Service Worker에서 수행 (CORS 우회)
   - 응답 캐싱 (같은 문제+코드 재분석 방지)

### Phase 4: 피드백 UI
9. **Side Panel 구현** (`sidepanel/`)
   - 구성 섹션:
     ```
     ┌─────────────────────────────────┐
     │ 📋 문제: #1234 - 문제 제목       │
     ├─────────────────────────────────┤
     │ ⏱ 복잡도 비교                    │
     │ ┌───────────┬───────────┐       │
     │ │  내 코드   │  최적 코드 │       │
     │ │ O(N²)     │ O(N log N)│       │
     │ └───────────┴───────────┘       │
     ├─────────────────────────────────┤
     │ ✅ 최적 풀이                     │
     │ ```cpp                          │
     │ #include <bits/stdc++.h>        │
     │ ...                             │
     │ ```                             │
     ├─────────────────────────────────┤
     │ 🔍 코드 비교 분석                │
     │ 1. 불필요한 반복문 제거 가능      │
     │ 2. STL 활용도 개선               │
     │ 3. ...                          │
     ├─────────────────────────────────┤
     │ 💡 핵심 개선점                   │
     │ - 이분탐색 적용으로 O(logN) 가능  │
     │ - ...                           │
     └─────────────────────────────────┘
     ```
   - 코드 블록에 Syntax Highlighting 적용 (highlight.js 번들)
   - Markdown → HTML 렌더링 (marked.js 번들)
   - 로딩 애니메이션 (스트리밍 중)

### Phase 5: 마무리
10. **에러 처리 및 엣지 케이스**
    - API Key 미설정 시 설정 페이지로 안내
    - 네트워크 오류 시 재시도 옵션
    - 지원하지 않는 페이지 접근 시 안내 메시지
    - 코드가 비어있을 때 처리

11. **캐싱 및 히스토리**
    - `chrome.storage.local`에 이전 분석 결과 저장
    - 문제번호 기준으로 피드백 히스토리 조회 가능

---

## 핵심 기술 스택

| 구성 요소 | 기술 |
|-----------|------|
| Extension | Chrome Manifest V3 |
| AI | Gemini API (`gemini-2.5-flash-lite`, 무료) |
| 코드 하이라이팅 | highlight.js |
| Markdown 렌더링 | marked.js |
| 스타일 | 순수 CSS (경량화) |
| 저장소 | chrome.storage.local |

---

## 구현 순서 (권장)

```
1단계: manifest.json + popup (API Key 설정)        ← 기본 뼈대
2단계: content script (문제/코드 스크래핑)           ← 데이터 수집
3단계: background worker + Claude API 연동          ← AI 분석
4단계: side panel UI (피드백 렌더링)                 ← 결과 표시
5단계: 스트리밍, 캐싱, 에러처리                      ← 완성도
```

---

## Gemini API 비용

- **완전 무료** (Google AI Studio 무료 티어)
- `gemini-2.5-flash-lite`: 15 RPM, 하루 1,000회 요청
- `gemini-2.5-flash`: 10 RPM, 하루 250회 요청
- 하루 10문제 분석: **무료**

---

## 보안 고려사항

- API Key는 `chrome.storage.local`에만 저장 (코드에 하드코딩 금지)
- Content Script에서 API 직접 호출하지 않음 (Service Worker 경유)
- 외부로 전송되는 데이터: 문제 텍스트 + 사용자 코드만 (개인정보 없음)
