/**
 * Side Panel - 피드백 UI 로직
 */

// DOM 요소
const elements = {
  problemBadge: document.getElementById('problemBadge'),
  problemLabel: document.getElementById('problemLabel'),
  codeInput: document.getElementById('codeInput'),
  analyzeBtn: document.getElementById('analyzeBtn'),
  loading: document.getElementById('loading'),
  errorBox: document.getElementById('errorBox'),
  errorMsg: document.getElementById('errorMsg'),
  retryBtn: document.getElementById('retryBtn'),
  resultBox: document.getElementById('resultBox'),
  mainView: document.getElementById('mainView'),
  historyView: document.getElementById('historyView'),
  historyBtn: document.getElementById('historyBtn'),
  backBtn: document.getElementById('backBtn'),
  historyList: document.getElementById('historyList'),
  clearAllBtn: document.getElementById('clearAllBtn')
};

// 현재 문제 정보
let currentProblemInfo = null;

/**
 * 초기화
 */
async function init() {
  // Side Panel이 열릴 때 pending 데이터 확인
  chrome.runtime.sendMessage({ action: 'getPendingAnalysis' }, (response) => {
    if (response && response.problemInfo) {
      currentProblemInfo = response.problemInfo;
      showProblemBadge(currentProblemInfo);

      if (response.code) {
        elements.codeInput.value = response.code;
      }
    }
  });

  // 현재 탭에서 문제 정보 가져오기 + 최근 제출 코드 자동 불러오기
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url?.includes('acmicpc.net')) {
      chrome.tabs.sendMessage(tab.id, { action: 'getProblemInfo' }, (info) => {
        if (chrome.runtime.lastError) return;
        if (info && info.number) {
          currentProblemInfo = info;
          showProblemBadge(info);

          // 코드가 아직 없으면 최근 제출 코드 자동 불러오기
          if (!elements.codeInput.value) {
            autoFetchCode(tab.id, info.number);
          }
        }
      });

      // 제출 페이지의 에디터에서 코드 가져오기 시도
      chrome.tabs.sendMessage(tab.id, { action: 'getCode' }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response?.code && !elements.codeInput.value) {
          elements.codeInput.value = response.code;
        }
      });
    }
  } catch {
    // 탭 접근 실패 시 무시
  }

  // marked.js 설정
  if (typeof marked !== 'undefined') {
    marked.setOptions({
      breaks: true,
      gfm: true
    });
  }
}

/**
 * 문제 뱃지 표시
 */
function showProblemBadge(info) {
  elements.problemBadge.classList.remove('hidden');
  elements.problemLabel.textContent = `#${info.number} - ${info.title}`;
}

/**
 * UI 상태 전환
 */
function showState(state) {
  elements.loading.classList.add('hidden');
  elements.errorBox.classList.add('hidden');
  elements.resultBox.classList.add('hidden');

  switch (state) {
    case 'loading':
      elements.loading.classList.remove('hidden');
      elements.analyzeBtn.disabled = true;
      break;
    case 'error':
      elements.errorBox.classList.remove('hidden');
      elements.analyzeBtn.disabled = false;
      break;
    case 'result':
      elements.resultBox.classList.remove('hidden');
      elements.analyzeBtn.disabled = false;
      break;
    default:
      elements.analyzeBtn.disabled = false;
  }
}

/**
 * 분석 시작
 */
async function startAnalysis() {
  if (!currentProblemInfo || !currentProblemInfo.number) {
    // 문제 정보 없으면 현재 탭에서 다시 시도
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url?.includes('acmicpc.net/problem/')) {
        const info = await new Promise((resolve) => {
          chrome.tabs.sendMessage(tab.id, { action: 'getProblemInfo' }, resolve);
        });
        if (info?.number) {
          currentProblemInfo = info;
          showProblemBadge(info);
        }
      }
    } catch {}

    if (!currentProblemInfo?.number) {
      showState('error');
      elements.errorMsg.textContent = '백준 문제 페이지를 먼저 열어주세요.';
      return;
    }
  }

  const code = elements.codeInput.value.trim();

  showState('loading');

  chrome.runtime.sendMessage(
    {
      action: 'requestAnalysis',
      data: {
        problemInfo: currentProblemInfo,
        code
      }
    },
    (response) => {
      if (chrome.runtime.lastError) {
        showState('error');
        elements.errorMsg.textContent = '통신 오류가 발생했습니다.';
        return;
      }

      if (response?.error) {
        showState('error');
        elements.errorMsg.textContent = response.error;
        return;
      }

      if (response?.result) {
        renderResult(response.result, response.cached);
      }
    }
  );
}

/**
 * Markdown 결과 렌더링
 */
function renderResult(markdown, cached) {
  showState('result');

  // Markdown → HTML
  let html = '';
  if (typeof marked !== 'undefined') {
    html = marked.parse(markdown);
  } else {
    // marked 로드 실패 시 기본 렌더링
    html = markdown
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  if (cached) {
    html = '<p style="color:#888;font-size:11px;">📦 캐시된 결과입니다</p>' + html;
  }

  elements.resultBox.innerHTML = html;

  // 코드 하이라이팅 적용
  elements.resultBox.querySelectorAll('pre code').forEach((block) => {
    if (typeof hljs !== 'undefined') {
      hljs.highlightElement(block);
    }
  });

  // 결과 영역으로 스크롤
  elements.resultBox.scrollIntoView({ behavior: 'smooth' });
}

/**
 * 히스토리 표시
 */
async function showHistory() {
  elements.mainView.classList.add('hidden');
  elements.historyView.classList.remove('hidden');

  const { history = [] } = await chrome.storage.local.get('history');

  if (history.length === 0) {
    elements.historyList.innerHTML = '<div class="history-empty">아직 분석 기록이 없습니다.</div>';
    return;
  }

  elements.historyList.innerHTML = history.map((item, index) => `
    <div class="history-item" data-index="${index}">
      <div class="history-item-content">
        <div class="history-item-title">#${item.problemNumber} - ${item.title || '제목 없음'}</div>
        <div class="history-item-date">${new Date(item.timestamp).toLocaleString('ko-KR')}</div>
      </div>
      <button class="history-delete-btn" data-index="${index}" title="삭제">✕</button>
    </div>
  `).join('');

  // 히스토리 항목 클릭 → 결과 보기
  elements.historyList.querySelectorAll('.history-item-content').forEach((el) => {
    el.addEventListener('click', async () => {
      const idx = parseInt(el.parentElement.dataset.index);
      const { history = [] } = await chrome.storage.local.get('history');
      if (history[idx]) {
        elements.mainView.classList.remove('hidden');
        elements.historyView.classList.add('hidden');
        renderResult(history[idx].result, true);
      }
    });
  });

  // 개별 삭제 버튼
  elements.historyList.querySelectorAll('.history-delete-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index);
      const { history = [] } = await chrome.storage.local.get('history');
      history.splice(idx, 1);
      await chrome.storage.local.set({ history });
      showHistory(); // 목록 새로고침
    });
  });
}

/**
 * 히스토리 전체 삭제
 */
async function clearAllHistory() {
  if (!confirm('모든 분석 기록을 삭제하시겠습니까?')) return;
  await chrome.storage.local.set({ history: [] });
  showHistory();
}

/**
 * 최근 제출 코드 자동 불러오기
 */
async function autoFetchCode(tabId, problemNumber) {
  try {
    elements.codeInput.placeholder = '최근 제출 코드를 불러오는 중...';

    const response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, {
        action: 'fetchLatestCode',
        problemNumber
      }, resolve);
    });

    if (response?.code && !elements.codeInput.value) {
      elements.codeInput.value = response.code;
      elements.codeInput.placeholder = '여기에 코드를 붙여넣으세요.';
    } else {
      elements.codeInput.placeholder = '코드를 불러올 수 없습니다. 직접 붙여넣으세요.';
    }
  } catch {
    elements.codeInput.placeholder = '코드를 불러올 수 없습니다. 직접 붙여넣으세요.';
  }
}

// 이벤트 리스너
elements.analyzeBtn.addEventListener('click', startAnalysis);
elements.retryBtn.addEventListener('click', startAnalysis);
elements.historyBtn.addEventListener('click', showHistory);
elements.backBtn.addEventListener('click', () => {
  elements.historyView.classList.add('hidden');
  elements.mainView.classList.remove('hidden');
});
elements.clearAllBtn.addEventListener('click', clearAllHistory);

// 초기화
init();
