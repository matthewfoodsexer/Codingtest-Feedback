/**
 * 백준 페이지에 "AI 피드백" 버튼을 삽입하는 Content Script
 */

(function () {
  const pageType = BaekjoonDetector.getPageType();

  if (pageType === 'problem') {
    injectProblemPageButton();
    injectProblemTags();
  } else if (pageType === 'submit') {
    injectSubmitPageButton();
  }

  /**
   * 문제 페이지에 피드백 버튼 삽입
   */
  function injectProblemPageButton() {
    // 문제 페이지 상단 버튼 영역 (채점, 게시판, 숏코딩 등) 찾기
    const btnGroup = document.querySelector('.margin-bottom-30.text-right')
      || document.querySelector('.problem-button');

    if (btnGroup) {
      // 기존 버튼 그룹에 자연스럽게 추가
      const btn = createFeedbackButton('AI 피드백');
      btn.classList.add('btn', 'btn-default');
      btn.style.marginLeft = '5px';
      btn.addEventListener('click', () => openFeedbackPanel('problem'));
      btnGroup.appendChild(btn);
      return;
    }

    // fallback: 제목 옆에 삽입
    const titleEl = document.getElementById('problem_title');
    if (!titleEl) return;

    const btn = createFeedbackButton('AI 피드백');
    btn.addEventListener('click', () => openFeedbackPanel('problem'));

    titleEl.parentElement.style.display = 'flex';
    titleEl.parentElement.style.alignItems = 'center';
    titleEl.parentElement.style.gap = '12px';
    titleEl.parentElement.appendChild(btn);
  }

  /**
   * 제출 페이지에 피드백 버튼 삽입
   */
  function injectSubmitPageButton() {
    const submitBtn = document.getElementById('submit_button');
    if (!submitBtn) return;

    const btn = createFeedbackButton('AI 피드백');
    btn.classList.add('boj-feedback-btn-submit');
    btn.addEventListener('click', () => openFeedbackPanel('submit'));

    // submit 버튼 바로 옆에 삽입
    submitBtn.parentNode.insertBefore(btn, submitBtn.nextSibling);
  }

  /**
   * 문제 제목 옆에 알고리즘 태그 표시
   */
  async function injectProblemTags() {
    const problemNumber = BaekjoonDetector.getProblemNumber();
    if (!problemNumber) return;

    const titleEl = document.getElementById('problem_title');
    if (!titleEl) return;

    chrome.runtime.sendMessage({ action: 'fetchTags', problemNumber }, (tags) => {
      if (!tags || tags.length === 0) return;

      const tagSpan = document.createElement('span');
      tagSpan.className = 'boj-feedback-tags';
      tagSpan.textContent = tags.join(', ');
      titleEl.parentElement.appendChild(tagSpan);
    });
  }

  /**
   * 피드백 버튼 생성
   */
  function createFeedbackButton(text) {
    const btn = document.createElement('button');
    btn.className = 'boj-feedback-btn';
    btn.textContent = text;
    return btn;
  }

  /**
   * 사이드 패널 열기 + 분석 요청
   */
  function openFeedbackPanel(source) {
    // 문제 정보 수집
    const problemInfo = BaekjoonDetector.extractProblemInfo();

    // 코드 수집 (제출 페이지인 경우)
    let code = '';
    if (source === 'submit') {
      code = BaekjoonDetector.extractSubmitCode();
    }

    // Background로 메시지 전송 → Side Panel 열기 + 분석 시작
    chrome.runtime.sendMessage({
      action: 'startAnalysis',
      data: {
        problemInfo,
        code,
        source
      }
    });
  }
})();
