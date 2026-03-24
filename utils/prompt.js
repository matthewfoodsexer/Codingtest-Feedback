/**
 * Gemini API에 보낼 프롬프트 구성
 */

const PromptBuilder = {
  /**
   * 시스템 프롬프트
   */
  getSystemPrompt(language) {
    return `당신은 알고리즘 및 자료구조 전문가입니다. 백준 온라인 저지 문제에 대해 코드 리뷰를 수행합니다.

반드시 아래 형식의 Markdown으로 응답하세요:

## 📊 복잡도 비교
| | 내 코드 | 최적 코드 |
|---|---|---|
| 시간 복잡도 | O(?) | O(?) |
| 공간 복잡도 | O(?) | O(?) |

## ✅ 최적 풀이
\`\`\`${language.toLowerCase()}
// 가장 효율적인 풀이 코드
\`\`\`

### 풀이 설명
- 사용한 알고리즘/자료구조
- 핵심 아이디어

## 🔍 코드 비교 분석
사용자의 코드와 최적 풀이를 비교하여 차이점을 분석합니다.
1. ...
2. ...

## 💡 개선점
구체적이고 실행 가능한 개선 제안:
1. ...
2. ...

## 📝 요약
한 줄 요약으로 가장 중요한 피드백

---
규칙:
- ${language} 코드만 사용
- 실제로 백준에서 통과 가능한 코드만 작성
- 불필요한 인사말 없이 바로 분석 시작
- 한국어로 작성`;
  },

  /**
   * 문제 + 코드 분석 프롬프트 (코드가 있는 경우)
   */
  buildAnalysisPrompt(problemInfo, code, language) {
    let prompt = `## 문제 정보
- 번호: ${problemInfo.number}
- 제목: ${problemInfo.title}
- 시간 제한: ${problemInfo.timeLimit}
- 메모리 제한: ${problemInfo.memoryLimit}

## 문제 설명
${problemInfo.description}

## 입력
${problemInfo.input}

## 출력
${problemInfo.output}`;

    if (problemInfo.examples && problemInfo.examples.length > 0) {
      prompt += '\n\n## 예제';
      problemInfo.examples.forEach((ex, i) => {
        prompt += `\n### 입력 ${i + 1}\n\`\`\`\n${ex.input}\n\`\`\`\n### 출력 ${i + 1}\n\`\`\`\n${ex.output}\n\`\`\``;
      });
    }

    if (problemInfo.hint) {
      prompt += `\n\n## 힌트\n${problemInfo.hint}`;
    }

    if (code) {
      prompt += `\n\n## 내 코드 (${language})
\`\`\`${language.toLowerCase()}
${code}
\`\`\`

위 문제에 대해 가장 효율적인 ${language} 풀이를 작성하고, 내 코드와 비교 분석해주세요.`;
    } else {
      prompt += `\n\n이 문제에 대해 가장 효율적인 ${language} 풀이를 작성하고, 풀이 접근법을 설명해주세요.`;
    }

    return prompt;
  },

  /**
   * Gemini API 요청 body 구성
   */
  buildRequestBody(problemInfo, code, language) {
    const systemPrompt = this.getSystemPrompt(language);
    const userPrompt = this.buildAnalysisPrompt(problemInfo, code, language);

    return {
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 8192
      }
    };
  }
};
