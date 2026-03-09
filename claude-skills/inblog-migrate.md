---
name: inblog-migrate
description: "마크다운 파일을 inblog 포스트로 마이그레이션. 트리거: '마크다운 변환', '블로그 이전', 'MD 임포트'"
---

# 마크다운 → inblog 마이그레이션

기존 마크다운 파일(.md, .mdx)을 inblog 포스트로 변환하여 임포트합니다.

## 사전 조건

```bash
# 인증 확인
inblog auth whoami --json

# 태그 목록 확인 (프론트매터 태그와 매칭에 필요)
inblog tags list --json
```

## 프론트매터 형식

```yaml
---
title: "포스트 제목"        # 필수 (없으면 파일명에서 생성)
slug: "post-slug"           # 선택 (없으면 title에서 slugify)
description: "포스트 요약"   # 선택
date: 2025-01-15            # 선택 (published_at으로 사용)
tags:                       # 선택 (이름으로 매칭 → 없는 태그는 자동 생성)
  - tutorial
  - react
image: "https://example.com/og.jpg"  # 선택 (OG 이미지)
published: true             # 선택 (기본: false → 드래프트)
canonical_url: "https://original.com/post"  # 선택 (원본 URL)
meta_title: "SEO 제목"      # 선택
meta_description: "SEO 설명" # 선택
---
```

## 워크플로우

### 1. 미리보기 (Dry Run)

```bash
# 단일 파일
inblog migrate markdown ./post.md --dry-run --json

# 디렉토리 (모든 .md/.mdx 파일)
inblog migrate markdown ./content/ --dry-run --json
```

출력 예시:
```json
{
  "data": [
    {
      "file": "getting-started.md",
      "title": "Getting Started Guide",
      "slug": "getting-started-guide",
      "tags": ["tutorial", "guide"],
      "status": "ready"
    }
  ],
  "meta": { "total": 5, "ready": 4, "errors": 1 }
}
```

### 2. 태그 준비

프론트매터의 태그 이름과 inblog 태그를 매칭합니다:

```bash
# 기존 태그 확인
inblog tags list --json

# 필요한 태그 생성
inblog tags create --name "tutorial" --slug "tutorial" --json
inblog tags create --name "React" --slug "react" --json
```

마이그레이션 시 프론트매터의 `tags` 배열은:
1. 이름으로 기존 태그 검색 (대소문자 무시)
2. 매칭되는 태그가 있으면 자동 연결
3. 없는 태그는 경고 메시지 출력

### 3. 마이그레이션 실행

```bash
# 드래프트로 임포트 (기본)
inblog migrate markdown ./content/ --json

# 즉시 발행
inblog migrate markdown ./content/ --publish --json

# 외부 이미지 URL 유지 (R2 업로드 방지)
inblog migrate markdown ./content/ --preserve-images --json

# 모든 옵션 조합
inblog migrate markdown ./content/ \
  --publish \
  --preserve-images \
  --json
```

### 4. 결과 확인

```bash
# 임포트된 포스트 확인
inblog posts list --limit 20 --sort created_at --order desc --json
```

## 마크다운 → HTML 변환 규칙

`marked` 라이브러리로 변환 후 inblog content_html 형식에 맞게 조정:

| 마크다운 | 변환 결과 |
|---------|----------|
| `# H1` | `<h2>` (h1은 title이 담당) |
| `## H2` | `<h2>` |
| `### H3` | `<h3>` |
| `#### H4` | `<h4>` |
| `` ```js `` | `<pre><code class="language-javascript">` |
| `> 인용` | `<blockquote><p>인용</p></blockquote>` |
| `![alt](url)` | `<img data-type="imageBlock" src="url" alt="alt">` |
| `[text](url)` | `<a href="url">text</a>` (rel 속성 없음) |

**주의사항:**
- h5, h6 → h4로 변환 (inblog는 h2~h4만 지원)
- 코드 블록 내 `<`, `>`, `&`는 자동 이스케이프
- `<script>` 태그는 자동 제거

## 옵션 상세

| 옵션 | 설명 |
|------|------|
| `--dry-run` | 실제 생성 없이 변환 결과 미리보기 |
| `--publish` | 임포트 후 즉시 발행 (기본: 드래프트) |
| `--preserve-images` | 외부 이미지 URL을 R2에 업로드하지 않고 원본 유지 |

## 디렉토리 구조 예시

```
content/
├── getting-started.md      # 개별 포스트
├── advanced-guide.md
├── images/                  # 이미지 (content_html에서 참조)
│   ├── screenshot.png
│   └── diagram.svg
└── drafts/                  # 하위 디렉토리는 무시 (최상위만 처리)
    └── work-in-progress.md
```

## 에러 대응

| 상황 | 대응 |
|------|------|
| `SLUG_CONFLICT` (409) | 이미 같은 slug의 포스트 존재 → 다른 slug 사용 또는 기존 포스트 업데이트 |
| 프론트매터 없음 | 파일명에서 title 추출, slug 자동 생성 |
| 태그 매칭 실패 | 경고 출력 후 태그 없이 생성, 수동으로 태그 추가 필요 |
| 이미지 업로드 실패 | 경고 출력, 원본 URL 유지하고 계속 진행 |
| 대용량 파일 (>10MB) | 이미지는 10MB 제한, 텍스트는 제한 없음 |

## 벌크 마이그레이션 팁

1. **먼저 `--dry-run`으로 전체 미리보기** — 에러 있는 파일 사전 확인
2. **태그를 먼저 생성** — 프론트매터 태그와 이름이 일치해야 자동 매칭
3. **드래프트로 먼저 임포트** — 내용 확인 후 발행
4. **`--preserve-images`** — 대량 이미지가 있으면 R2 업로드에 시간 소요, 나중에 개별 처리
