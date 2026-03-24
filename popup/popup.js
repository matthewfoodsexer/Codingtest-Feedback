const apiKeyInput = document.getElementById('apiKey');
const toggleKeyBtn = document.getElementById('toggleKey');
const modelSelect = document.getElementById('model');
const languageSelect = document.getElementById('language');
const saveBtn = document.getElementById('saveBtn');
const statusEl = document.getElementById('status');

// 저장된 설정 로드
chrome.storage.local.get(['apiKey', 'model', 'language'], (data) => {
  if (data.apiKey) apiKeyInput.value = data.apiKey;
  if (data.model) modelSelect.value = data.model;
  if (data.language) languageSelect.value = data.language;
});

// API Key 보기/숨기기 토글
toggleKeyBtn.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  toggleKeyBtn.textContent = isPassword ? '🙈' : '👁';
});

// 저장
saveBtn.addEventListener('click', () => {
  const apiKey = apiKeyInput.value.trim();
  const model = modelSelect.value;
  const language = languageSelect.value;

  if (!apiKey) {
    showStatus('API Key를 입력해주세요.', 'error');
    return;
  }

  chrome.storage.local.set({ apiKey, model, language }, () => {
    showStatus('저장되었습니다!', 'success');
    setTimeout(() => { statusEl.textContent = ''; }, 2000);
  });
});

function showStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = 'status ' + type;
}
