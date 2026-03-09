---
name: inblog-create-post
description: "inblog 드래프트 포스트 생성. 트리거: '글 초안 만들어', '포스트 생성', '드래프트 작성'"
---

# inblog 드래프트 포스트 생성

> **HTML 작성 전** 반드시 `inblog-content-html` 스킬을 참조하세요.

## 사전 조건

```bash
# 인증 확인
inblog auth whoami --json
```

유료 플랜 블로그만 API 접근 가능 (`SUBSCRIPTION_REQUIRED` 403 에러 시 업그레이드 필요).

## 단계별 워크플로우

### 1. 태그·저자 확인

```bash
# 기존 태그 확인 (priority 순 정렬, 페이지네이션 없음)
inblog tags list --json

# 필요 시 태그 생성
inblog tags create --name "React" --slug "react" --priority 0 --json

# 저자 목록 (블로그에 포스트가 있는 프로필만 반환)
inblog authors list --json
```

**주의**: 태그 ID는 정수(string 반환), 저자 ID는 UUID.

### 2. HTML 콘텐츠 작성

`inblog-content-html` 스킬의 규칙을 따라 HTML 생성 후 임시 파일에 저장:

```bash
cat > /tmp/draft-content.html << 'HTMLEOF'
<h2>소개</h2>
<p>본문 내용을 작성합니다.</p>

<h2>주요 내용</h2>
<p>상세 설명과 예시를 포함합니다.</p>
<pre><code class="language-typescript">const example = 'hello';
console.log(example);</code></pre>

<div data-type="callOut" data-emoji="💡" data-color="#EFF6FF">
  <p>중요한 정보를 강조합니다.</p>
</div>

<h2>마무리</h2>
<p>요약과 다음 단계를 안내합니다.</p>
HTMLEOF
```

**핵심 규칙:**
- `<h1>` 사용 금지 (title이 h1 역할)
- 모든 텍스트는 `<p>` 태그로 감싸기
- `<a>` 태그에 `rel` 속성 추가 금지
- 코드 블록: `<pre><code class="language-*">` (HTML 엔티티 이스케이프 필수)
- `<script>` 태그는 자동 제거됨

### 3. 포스트 생성

```bash
inblog posts create \
  --title "포스트 제목" \
  --slug "post-slug" \
  --description "포스트 요약 (리스트에 표시)" \
  --content-file /tmp/draft-content.html \
  --tag-ids 1,2 \
  --author-ids "uuid-here" \
  --meta-title "SEO 제목 (60자 이내)" \
  --meta-description "SEO 설명 (150-160자)" \
  --json
```

**필수 필드**: `title`, `slug` (소문자+숫자+하이픈만)

**slug 규칙**: 소문자, 숫자, 하이픈만 허용. 중복 시 `SLUG_CONFLICT` (409) 에러.

### 4. 결과 확인

```bash
# 생성된 포스트 확인
inblog posts get <post-id> --include tags,authors --json
```

### 5. 이후 작업 (선택)

```bash
# 태그 추가/제거
inblog posts add-tags <post-id> --tag-ids 3,4 --json
inblog posts remove-tag <post-id> <tag-id> --json

# 저자 추가/제거
inblog posts add-authors <post-id> --author-ids uuid1,uuid2 --json
inblog posts remove-author <post-id> <author-id> --json

# 발행
inblog posts publish <post-id> --json

# 예약 발행
inblog posts schedule <post-id> --at "2025-06-01T09:00:00+09:00" --json
```

## 이미지 처리

포스트 OG 이미지 (`image` 필드):
- 외부 URL → 자동으로 inblog R2 CDN에 업로드
- `source.inblog.dev`, `image.inblog.dev` URL → 그대로 유지
- `--preserve-images` → 외부 URL 원본 유지

`content_html` 내 이미지도 동일 규칙 적용.

## Notion 연동

```bash
inblog posts create \
  --title "Notion에서 가져온 글" \
  --slug "notion-post" \
  --notion-url "https://www.notion.so/page-id" \
  --json
```

- `content_type`이 자동으로 `"notion"`으로 설정
- 서버가 Notion API로 recordMap 가져옴 (최대 60초 소요)
- `content_html`과 `notion_url`은 동시 사용 불가

## 에러 대응

| 에러 | 원인 | 대응 |
|------|------|------|
| `SLUG_CONFLICT` (409) | slug 중복 | 다른 slug 사용 |
| `INVALID_SLUG` (400) | slug 형식 오류 | 소문자+숫자+하이픈만 |
| `INVALID_TAG_IDS` (400) | 존재하지 않는 태그 | `inblog tags list`로 확인 |
| `INVALID_AUTHOR_IDS` (400) | 블로그 멤버 아닌 저자 | `inblog authors list`로 확인 |
| `SUBSCRIPTION_REQUIRED` (403) | 무료 플랜 | 유료 플랜 업그레이드 |
| `VALIDATION_ERROR` (400) | 필수 필드 누락 | title, slug 확인 |
