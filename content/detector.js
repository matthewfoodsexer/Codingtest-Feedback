/**
 * 백준 페이지에서 문제 정보와 제출 코드를 추출하는 Content Script
 */

const BaekjoonDetector = {
  /**
   * 현재 페이지 타입 판별
   */
  getPageType() {
    const url = window.location.href;
    if (/\/problem\/\d+/.test(url)) return 'problem';
    if (/\/submit\/\d+/.test(url)) return 'submit';
    if (/\/status/.test(url)) return 'status';
    if (/\/source\/\d+/.test(url)) return 'source';
    return 'other';
  },

  /**
   * URL에서 문제 번호 추출
   */
  getProblemNumber() {
    const match = window.location.href.match(/\/(?:problem|submit|source)\/(\d+)/);
    return match ? match[1] : null;
  },

  /**
   * 문제 페이지에서 문제 정보 추출
   */
  extractProblemInfo() {
    const info = {};

    info.number = this.getProblemNumber();
    info.title = document.getElementById('problem_title')?.textContent?.trim() || '';

    // 시간/메모리 제한
    const infoTable = document.getElementById('problem-info');
    if (infoTable) {
      const tds = infoTable.querySelectorAll('td');
      info.timeLimit = tds[0]?.textContent?.trim() || '';
      info.memoryLimit = tds[1]?.textContent?.trim() || '';
    }

    // 문제 본문 섹션들
    info.description = document.getElementById('problem_description')?.innerText?.trim() || '';
    info.input = document.getElementById('problem_input')?.innerText?.trim() || '';
    info.output = document.getElementById('problem_output')?.innerText?.trim() || '';

    // 예제 입출력 (여러 개 가능)
    info.examples = [];
    let i = 1;
    while (true) {
      const sampleInput = document.getElementById(`sample-input-${i}`);
      const sampleOutput = document.getElementById(`sample-output-${i}`);
      if (!sampleInput && !sampleOutput) break;
      info.examples.push({
        input: sampleInput?.textContent?.trim() || '',
        output: sampleOutput?.textContent?.trim() || ''
      });
      i++;
    }

    // 힌트
    info.hint = document.getElementById('problem_hint')?.innerText?.trim() || '';

    return info;
  },

  /**
   * 제출 페이지에서 코드 에디터의 코드 추출
   */
  extractSubmitCode() {
    // CodeMirror 에디터에서 코드 추출
    const cmElement = document.querySelector('.CodeMirror');
    if (cmElement && cmElement.CodeMirror) {
      return cmElement.CodeMirror.getValue();
    }

    // Ace 에디터 fallback
    const aceEditor = document.querySelector('.ace_editor');
    if (aceEditor && window.ace) {
      const editor = ace.edit(aceEditor);
      return editor.getValue();
    }

    // textarea fallback
    const textarea = document.querySelector('#source');
    if (textarea) return textarea.value;

    return '';
  },

  /**
   * 제출 현황 페이지에서 "맞았습니다!!" 결과 감지
   */
  detectAccepted() {
    const resultCells = document.querySelectorAll('.result-ac');
    return resultCells.length > 0;
  },

  /**
   * 로그인된 사용자 이름 추출
   */
  getUsername() {
    // 상단 네비게이션에서 사용자 이름 추출
    const userLink = document.querySelector('a.username');
    if (userLink) return userLink.textContent.trim();

    // fallback: 상단 메뉴에서 찾기
    const navLinks = document.querySelectorAll('.navbar-nav a');
    for (const link of navLinks) {
      if (link.href?.includes('/user/')) {
        return link.textContent.trim();
      }
    }
    return null;
  },

  /**
   * 가장 최근 제출한 코드 가져오기 (same-origin fetch)
   */
  async fetchLatestSubmission(problemNumber) {
    const username = this.getUsername();
    if (!username) throw new Error('로그인 정보를 찾을 수 없습니다.');
    if (!problemNumber) throw new Error('문제 번호를 찾을 수 없습니다.');

    // 1) 제출 목록 페이지에서 가장 최근 제출 ID 찾기
    const statusUrl = `/status?problem_id=${problemNumber}&user_id=${username}`;
    const statusResp = await fetch(statusUrl);
    if (!statusResp.ok) throw new Error('제출 목록을 불러올 수 없습니다.');

    const statusHtml = await statusResp.text();
    const parser = new DOMParser();
    const statusDoc = parser.parseFromString(statusHtml, 'text/html');

    // 첫 번째 제출 행의 제출 번호
    const firstRow = statusDoc.querySelector('#status-table tbody tr');
    if (!firstRow) throw new Error('제출 기록이 없습니다.');

    const submissionId = firstRow.querySelector('td:first-child')?.textContent?.trim();
    if (!submissionId) throw new Error('제출 번호를 찾을 수 없습니다.');

    // 2) 소스 코드 페이지에서 코드 추출
    const sourceUrl = `/source/${submissionId}`;
    const sourceResp = await fetch(sourceUrl);
    if (!sourceResp.ok) throw new Error('소스 코드를 불러올 수 없습니다. (비공개일 수 있습니다)');

    const sourceHtml = await sourceResp.text();
    const sourceDoc = parser.parseFromString(sourceHtml, 'text/html');

    const codeEl = sourceDoc.querySelector('.source-code-text')
      || sourceDoc.querySelector('pre')
      || sourceDoc.querySelector('textarea');

    if (!codeEl) throw new Error('코드를 파싱할 수 없습니다.');

    return {
      code: codeEl.textContent,
      submissionId
    };
  },

  /**
   * 전체 데이터 수집 (문제 정보 + 코드)
   */
  async collectData() {
    const pageType = this.getPageType();
    const data = { pageType };

    if (pageType === 'problem') {
      data.problemInfo = this.extractProblemInfo();
    } else if (pageType === 'submit') {
      data.problemNumber = this.getProblemNumber();
      data.code = this.extractSubmitCode();
    }

    return data;
  }
};

// 메시지 리스너 - Background/Side Panel에서 데이터 요청 시 응답
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getProblemInfo') {
    sendResponse(BaekjoonDetector.extractProblemInfo());
  } else if (request.action === 'getCode') {
    sendResponse({ code: BaekjoonDetector.extractSubmitCode() });
  } else if (request.action === 'getPageType') {
    sendResponse({ pageType: BaekjoonDetector.getPageType() });
  } else if (request.action === 'fetchLatestCode') {
    BaekjoonDetector.fetchLatestSubmission(request.problemNumber)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true; // async response
  } else if (request.action === 'collectAll') {
    BaekjoonDetector.collectData().then(sendResponse);
    return true; // async response
  }
});
