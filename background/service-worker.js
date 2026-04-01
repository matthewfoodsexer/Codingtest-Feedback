/**
 * Background Service Worker
 * - Content Script ↔ Side Panel 메시지 브릿지
 * - Gemini API 호출
 * - 결과 캐싱
 */

try {
  importScripts('../utils/api.js', '../utils/prompt.js');
} catch (e) {
  console.error('importScripts failed, trying alternate path', e);
  importScripts('/utils/api.js', '/utils/prompt.js');
}

// Side Panel 설정
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });

// 분석 결과 캐시 (메모리)
const analysisCache = new Map();

/**
 * 메시지 리스너
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'startAnalysis':
      handleStartAnalysis(message.data, sender.tab);
      break;

    case 'requestAnalysis':
      handleAnalysisRequest(message.data, sendResponse);
      return true; // async

    case 'openSidePanel':
      chrome.sidePanel.open({ tabId: sender.tab?.id || message.tabId });
      break;

    case 'getPendingAnalysis':
      sendResponse(pendingAnalysisData);
      pendingAnalysisData = null;
      break;

  }
});

// Side Panel로 전달할 대기 데이터
let pendingAnalysisData = null;

/**
 * Content Script에서 분석 요청이 들어왔을 때
 */
async function handleStartAnalysis(data, tab) {
  // 코드가 없는 경우 (문제 페이지에서 요청) - 코드 입력 모드로 Side Panel 열기
  pendingAnalysisData = data;

  // Side Panel 열기
  if (tab?.id) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
}

/**
 * Side Panel에서 실제 분석 요청
 */
async function handleAnalysisRequest(data, sendResponse) {
  try {
    // 설정 로드
    const settings = await chrome.storage.local.get(['apiKey', 'model', 'language']);

    if (!settings.apiKey) {
      sendResponse({ error: 'API Key가 설정되지 않았습니다. 확장 프로그램 아이콘을 클릭하여 설정해주세요.' });
      return;
    }

    if (!settings.model) {
      sendResponse({ error: '모델이 설정되지 않았습니다. 확장 프로그램 아이콘을 클릭하여 설정해주세요.' });
      return;
    }

    const model = settings.model;
    const language = settings.language || 'C++';
    const { problemInfo, code } = data;

    // 캐시 확인 (프롬프트 버전 포함 — 프롬프트 변경 시 캐시 무효화)
    const PROMPT_VERSION = 'v8';
    const cacheKey = `${PROMPT_VERSION}_${problemInfo.number}_${hashCode(code || '')}`;
    if (analysisCache.has(cacheKey)) {
      sendResponse({ result: analysisCache.get(cacheKey), cached: true });
      return;
    }

    // 프롬프트 구성
    const requestBody = PromptBuilder.buildRequestBody(problemInfo, code, language);

    // API 호출
    const result = await GeminiAPI.generate(settings.apiKey, model, requestBody);

    // 캐시 저장
    analysisCache.set(cacheKey, result);

    // 영구 저장 (히스토리)
    saveToHistory(problemInfo.number, problemInfo.title, result);

    sendResponse({ result });
  } catch (error) {
    sendResponse({ error: error.message });
  }
}

/**
 * 분석 히스토리 저장
 */
async function saveToHistory(problemNumber, title, result) {
  const { history = [] } = await chrome.storage.local.get('history');

  history.unshift({
    problemNumber,
    title,
    result,
    timestamp: Date.now()
  });

  // 최대 50개만 유지
  if (history.length > 50) history.length = 50;

  await chrome.storage.local.set({ history });
}

/**
 * 간단한 해시 함수 (캐시 키 생성용)
 */
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

