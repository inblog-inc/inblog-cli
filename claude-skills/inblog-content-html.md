---
name: inblog-content-html
description: "inblog content_html 완벽 레퍼런스. 포스트 HTML 생성 전 반드시 참조."
---

# inblog content_html 완벽 가이드

inblog는 TipTap 기반 에디터를 사용합니다. `content_html` 필드는 `editor.getHTML()`로 생성되는 HTML과 동일한 구조를 따라야 합니다.

## 허용 태그 & 규칙

### 헤딩
- `<h2>`, `<h3>`, `<h4>` **만 지원**
- **h1, h5, h6은 지원하지 않음** — h1은 포스트 title이 담당
- 헤딩 계층을 반드시 지켜야 함: h2 → h3 → h4

### 텍스트
```html
<p>문단 텍스트</p>
<strong>굵게</strong>
<em>기울임</em>
<u>밑줄</u>
<s>취소선</s>
<code>인라인 코드</code>
<a href="https://...">링크</a>     <!-- rel 속성 절대 추가 금지 -->
<br>                                 <!-- 줄바꿈 -->
```

### 블록 요소
```html
<blockquote><p>인용문</p></blockquote>
<hr>
<ul><li>순서 없는 목록</li></ul>
<ol><li>순서 있는 목록</li></ol>
<!-- 중첩 가능 -->
<ul>
  <li>항목 1
    <ul><li>하위 항목</li></ul>
  </li>
</ul>
```

### 텍스트 스타일링
```html
<!-- 하이라이트 -->
<mark data-color="#FBBF24" style="background-color: #FBBF24;">하이라이트</mark>

<!-- 텍스트 색상 -->
<span style="color: #EF4444;">빨간 텍스트</span>

<!-- 정렬 -->
<p style="text-align: center;">가운데 정렬</p>
<p style="text-align: right;">오른쪽 정렬</p>
```

## 코드 블록

```html
<pre><code class="language-typescript">const hello: string = 'world';
console.log(hello);</code></pre>
```

**지원 언어 클래스**: `language-javascript`, `language-typescript`, `language-python`, `language-bash`, `language-html`, `language-css`, `language-json`, `language-sql`, `language-go`, `language-rust`, `language-java`, `language-cpp`, `language-ruby`, `language-php`, `language-swift`, `language-kotlin`, `language-yaml`, `language-plaintext` 등

**주의**: code 태그 안의 내용은 HTML 엔티티로 이스케이프 필요 (`<` → `&lt;`, `>` → `&gt;`, `&` → `&amp;`)

## 테이블

```html
<table>
  <thead>
    <tr><th>헤더 1</th><th>헤더 2</th><th>헤더 3</th></tr>
  </thead>
  <tbody>
    <tr><td>셀 1</td><td>셀 2</td><td>셀 3</td></tr>
    <tr><td>셀 4</td><td>셀 5</td><td>셀 6</td></tr>
  </tbody>
</table>
```

colwidth 속성으로 열 너비 지정 가능. 자동 수평 스크롤 지원.

## 커스텀 블록 (data-type 속성)

### Callout (강조 박스)
```html
<div data-type="callOut" data-emoji="💡" data-color="#EFF6FF">
  <p>정보성 메시지</p>
</div>
```

| data-color | 용도 |
|-----------|------|
| `#EFF6FF` | 정보 (파란색) |
| `#FEF3C7` | 경고 (노란색) |
| `#FEE2E2` | 위험 (빨간색) |
| `#ECFDF5` | 성공 (초록색) |
| `#F3F4F6` | 참고 (회색) |

data-emoji는 자유롭게 선택: 💡, ⚠️, ❌, ✅, 📌, 🔥, 💬 등

### 이미지
```html
<img data-type="imageBlock" src="https://source.inblog.dev/..." alt="설명" width="800">
```

**중요**: 이미지 src는 반드시 inblog CDN(`source.inblog.dev` 또는 `image.inblog.dev`) 사용.
외부 URL은 서버가 자동으로 R2에 업로드함. `preserve_external_images=true` 쿼리로 원본 유지 가능.

### 이미지 그리드
```html
<div data-type="imageGrid" data-images='[{"src":"url1","alt":"설명1"},{"src":"url2","alt":"설명2"}]'></div>
```

### 이미지 캐러셀
```html
<div data-type="imageCarousel" data-images='[{"src":"url1","alt":""},{"src":"url2","alt":""}]'></div>
```

### 링크 버튼 (CTA)
```html
<div data-type="linkButton" data-url="https://example.com" data-text="클릭하세요"></div>
```

### 북마크 (링크 프리뷰)
```html
<div data-type="bookmark" data-url="https://example.com"></div>
```

### YouTube 임베드
```html
<div data-type="youtube" data-youtube-video-id="dQw4w9WgXcQ"></div>
```

### 폼 임베드
```html
<div data-type="googleForm" data-form-id="FORM_ID"></div>
<div data-type="hubspot" data-form-id="FORM_ID"></div>
<div data-type="tally" data-form-id="FORM_ID"></div>
<div data-type="typeform" data-form-id="FORM_ID"></div>
```

### 커스텀 HTML
```html
<div data-type="htmlCodeBlock"><p>임의의 HTML 콘텐츠</p></div>
```

## 보안 규칙
- `<script>` 태그는 **자동 제거됨** (XSS 방지)
- `<iframe>`은 허용된 임베드 서비스만 가능
- 외부 스타일시트 차단
- `<a>` 태그에 `rel` 속성 추가 금지 (nofollow 자동 제거됨)

## AI 콘텐츠 생성 베스트 프랙티스

### 구조
1. 모든 텍스트는 반드시 `<p>` 태그로 감싸기 — bare text 금지
2. `<h2>`로 주요 섹션, `<h3>`로 하위 섹션 구분
3. 코드는 반드시 `<pre><code class="language-*">` 사용
4. 블록 요소는 flat하게 배치 — 커스텀 블록 안에 커스텀 블록 중첩 금지
5. 콘텐츠는 블록 요소의 나열: `<h2>`, `<p>`, `<pre>`, `<ul>`, `<blockquote>`, `<div data-type="...">` 등

### SEO
- H2/H3에 주요 키워드 포함
- 짧은 문단 (3-4문장)
- 목록/불릿 적극 활용
- 내부 링크 포함
- 이미지에 alt 텍스트 필수

### CTA 삽입 패턴

**패턴 1: 결론에만** (정보 제공형)
```html
<h2>마무리</h2>
<p>요약 내용...</p>
<div data-type="callOut" data-emoji="🚀" data-color="#EFF6FF">
  <p><strong>제품명</strong>으로 이 과정을 자동화해보세요.</p>
</div>
<div data-type="linkButton" data-url="https://..." data-text="무료로 시작하기"></div>
```

**패턴 2: 본문 중간 + 결론** (홍보형)
```html
<!-- 관련 섹션 뒤에 소프트 CTA -->
<div data-type="callOut" data-emoji="💡" data-color="#ECFDF5">
  <p>💡 <strong>제품명</strong>을 사용하면 이 과정을 자동화할 수 있습니다.</p>
</div>

<!-- 결론에 강한 CTA -->
<div data-type="linkButton" data-url="https://..." data-text="14일 무료 체험 시작하기"></div>
```

**패턴 3: 네이티브 CTA** (자연스러운 언급)
```html
<p>저희 팀에서는 이 문제를 해결하기 위해
  <a href="https://product.com">제품명</a>을 만들었습니다.
  제품에 대한 간략한 설명.
</p>
```

## 완전한 포스트 HTML 예시

```html
<h2>소개</h2>
<p>REST API를 <strong>Node.js</strong>로 구축하는 방법을 알아봅니다.</p>

<h2>환경 설정</h2>
<p>먼저 의존성을 설치합니다:</p>
<pre><code class="language-bash">npm install express typescript</code></pre>

<h3>프로젝트 구조</h3>
<ul>
  <li><code>src/index.ts</code> — 엔트리 포인트</li>
  <li><code>src/routes/</code> — 라우트 핸들러</li>
  <li><code>src/middleware/</code> — 미들웨어</li>
</ul>

<div data-type="callOut" data-emoji="💡" data-color="#EFF6FF">
  <p>Node.js 18 이상이 필요합니다. <code>node -v</code>로 버전을 확인하세요.</p>
</div>

<h2>엔드포인트 작성</h2>
<pre><code class="language-typescript">import express from 'express';

const app = express();
app.use(express.json());

app.get('/api/users', async (req, res) =&gt; {
  const users = await db.users.findMany();
  res.json({ data: users });
});

app.listen(3000, () =&gt; {
  console.log('Server running on port 3000');
});</code></pre>

<h3>에러 핸들링</h3>
<p>프로덕션에서는 중앙 에러 핸들러가 필수입니다:</p>

<table>
  <thead>
    <tr><th>상태 코드</th><th>의미</th><th>처리</th></tr>
  </thead>
  <tbody>
    <tr><td>400</td><td>잘못된 요청</td><td>입력 검증 에러 반환</td></tr>
    <tr><td>401</td><td>인증 실패</td><td>토큰 재발급 안내</td></tr>
    <tr><td>500</td><td>서버 에러</td><td>에러 로깅 후 일반 메시지</td></tr>
  </tbody>
</table>

<blockquote><p>REST API는 일관된 에러 형식을 사용해야 합니다.</p></blockquote>

<h2>마무리</h2>
<p>이제 기본적인 REST API가 동작합니다. Express <a href="https://expressjs.com">공식 문서</a>에서 더 자세한 내용을 확인하세요.</p>

<div data-type="callOut" data-emoji="🚀" data-color="#EFF6FF">
  <p><strong>InblogCLI</strong>로 이 포스트를 터미널에서 바로 발행할 수 있습니다.</p>
</div>
```
