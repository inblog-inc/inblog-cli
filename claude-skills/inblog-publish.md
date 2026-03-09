---
name: inblog-publish
description: "inblog 포스트 작성+게시 워크플로우. 트리거: '블로그 글 써줘', '포스트 발행', '글 게시'"
---

# inblog 포스트 작성 & 발행 워크플로우

> **HTML 생성 전** 반드시 `inblog-content-html` 스킬을 참조하세요.

## 사전 조건
- `inblog` CLI 인증 완료: `inblog auth whoami --json`
- 유료 플랜 블로그 (API는 유료 플랜만 지원)

## 멀티턴 워크플로우

### Phase 1: 정보 수집

**1단계 — 주제 확인**
```
어떤 주제로 글을 작성할까요?
예: "Next.js 15 새 기능 소개", "스타트업 MVP 개발 가이드"
```

**2단계 — 글 목적 확인**
```
이 글의 목적이 무엇인가요?
1. 정보 제공 (튜토리얼, 가이드)
2. 제품/서비스 홍보
3. 뉴스레터 구독 유도
4. 브랜드 인지도
```

**3단계 — 타겟 독자**
```
누가 이 글을 읽을까요?
예: "주니어 개발자", "스타트업 창업자", "마케터"
```

### Phase 2: 아웃라인 & 콘텐츠 생성

**4단계 — 아웃라인 제안**
```
다음 구조로 작성하려고 합니다:

## 제목: [SEO 최적화 제목, 60자 이내]
### 목차
1. 서론 — [훅/문제 제기]
2. 본론 1 — [핵심 내용]
3. 본론 2 — [상세 설명/예시]
4. 본론 3 — [실전 적용]
5. 결론 — [요약 + CTA]

이대로 진행할까요?
```

**5단계 — HTML 콘텐츠 작성**
- `inblog-content-html` 스킬의 규칙을 따라 HTML 생성
- 임시 파일에 저장 (shell arg 길이 제한 회피)

### Phase 3: API 호출

```bash
# 1. 태그 확인 & 필요 시 생성
inblog tags list --json
inblog tags create --name "React" --slug "react" --json

# 2. 저자 확인
inblog authors list --json

# 3. HTML 파일 생성
cat > /tmp/post-content.html << 'EOF'
<h2>서론</h2>
<p>본문 내용...</p>
EOF

# 4. 포스트 생성 (드래프트)
inblog posts create \
  --title "포스트 제목" \
  --slug "post-slug" \
  --description "포스트 요약" \
  --content-file /tmp/post-content.html \
  --tag-ids 1,2 \
  --author-ids uuid1 \
  --meta-title "SEO 제목 (60자 이내)" \
  --meta-description "SEO 설명 (150-160자)" \
  --json

# 5. 결과 확인
inblog posts get <post-id> --json

# 6. 발행
inblog posts publish <post-id> --json

# 또는 예약 발행
inblog posts schedule <post-id> --at "2025-03-15T09:00:00+09:00" --json
```

### Phase 4: 최종 확인

```
포스트가 준비되었습니다!

📝 제목: [제목]
🔗 URL: /[slug]
📋 요약: [meta_description]
🏷️ 태그: [태그 목록]
🎯 CTA: [cta_text] → [cta_link]

어떻게 할까요?
1. 바로 발행
2. 임시저장 (draft)
3. 예약 발행 (날짜/시간 지정)
4. 수정하기
```

## SEO 최적화 가이드

### 제목 최적화

| 필드 | 용도 | 규칙 |
|------|------|------|
| `title` | 포스트 메인 제목 (H1 역할) | 60자 이내, 주요 키워드 앞쪽 배치 |
| `meta_title` | 검색결과 `<title>`, OG/Twitter 카드 | title과 다르게 설정 가능. 미설정 시 title 사용 |

**예시:**
```
title: "Next.js 15의 새로운 기능들"
meta_title: "Next.js 15 완벽 가이드: 새 기능과 성능 개선 (2025)"
```

### 설명 최적화

| 필드 | 용도 | 규칙 |
|------|------|------|
| `description` | 포스트 요약/발췌 (리스트 표시) | 길이 제한 없음 |
| `meta_description` | 검색결과 스니펫 | 150-160자, 키워드 + 가치 제안 + CTA |

**좋은 meta_description 예시:**
```
"Next.js 15의 Turbopack, App Router 개선, React 19 지원 등 핵심 기능을 실전 예제와 함께 알아봅니다. 빌드 속도 50% 향상 팁 포함."
```

### URL 슬러그 최적화

| 나쁨 | 좋음 |
|------|------|
| `how-to-build-a-blog-with-nextjs` | `nextjs-blog-tutorial` |
| `the-complete-guide-to-react-hooks` | `react-hooks-guide` |
| `5-best-ways-to-improve-seo` | `seo-improvement-tips` |

규칙: 소문자 + 하이픈만, 불용어 제거 (a, the, how, to, of 등), 키워드 포함

### Canonical URL

- 다른 사이트에서 동일 콘텐츠 재발행 시 원본 URL 지정
- 원본 콘텐츠이면 설정 불필요 (null → 자동 생성)

### 태그 전략

- 포스트당 **3-5개** 태그
- 토픽 클러스터 구성 (관련 글을 태그로 그룹화)
- 너무 일반적 (e.g., "개발") 또는 너무 구체적 (e.g., "useCallback-optimization-2025") 태그 피하기

### 발행 타이밍

- 최적 시간: 평일 오전 9-10시 (화/수/목 추천)
- 타겟 오디언스 시간대 고려 (블로그 `timezone` 설정 확인)

### 발행 전 체크리스트

- [ ] title 60자 이내, 주요 키워드 앞쪽
- [ ] meta_title 설정 (title과 다르게 최적화)
- [ ] slug: 소문자+하이픈, 불용어 제거, 키워드 포함
- [ ] meta_description 150-160자, 가치 제안 + CTA
- [ ] H2/H3 계층 구조
- [ ] OG 이미지 설정 (1200x630 권장)
- [ ] 태그 3-5개
- [ ] 내부 링크 1개 이상
- [ ] 이미지 alt 텍스트
- [ ] canonical_url 적절히 설정 (재발행 시)

## 글 유형별 구조 템플릿

### 튜토리얼/가이드
```
서론 → 사전 요구사항 → Step 1 → Step 2 → Step 3 → 마무리 + CTA
```

### 리스트형 (Top N, 추천)
```
서론 + 선정 기준 → 항목 1 (특징, 장단점) → 항목 2 → ... → 비교 표 → 최종 추천 + CTA
```

### 문제 해결형
```
문제 공감 → 원인 분석 → 해결 방법 1, 2, 3 → 권장 접근법 + CTA
```

### 사례 연구
```
배경 → 도전 과제 → 접근 방식 → 결과 수치 → 핵심 교훈 + CTA
```

## 전환 유형별 콘텐츠 전략

### signup (회원가입/무료체험)
- 도입: 문제점 공감 → 솔루션 힌트
- 본문: 가치 제공 (How-to, 팁)
- CTA: 본문 중간 1회 + 결론 1회
- 톤: 친근하고 실용적
- 키워드: "무료", "쉽게", "지금 바로"

### demo (데모 신청)
- 도입: 업계 트렌드/문제 제기
- 본문: 심층 분석 + 사례 연구
- CTA: 결론에 강조
- 톤: 전문적이고 신뢰감

### newsletter (뉴스레터 구독)
- 도입: 흥미로운 인사이트
- 본문: 가치 있는 정보 제공
- CTA: 결론 + 사이드 언급
- 톤: 전문가 큐레이션 느낌

### purchase (구매 유도)
- 도입: 니즈/페인포인트 자극
- 본문: 기능 소개 + 비교 + 후기
- CTA: 기능 설명 후마다
- 톤: 설득력 있고 구체적

### contact (문의/상담)
- 도입: 전문성 어필
- 본문: 케이스 스터디, 성공 사례
- CTA: 결론에 집중
- 톤: 신뢰감, 전문성

## 이미지 소스 가이드

### Unsplash (무료 스톡 이미지)

OG 이미지 URL 형식:
```
https://images.unsplash.com/photo-[ID]?w=1200&h=630&fit=crop
```

**주제별 추천 검색어:**

| 블로그 주제 | Unsplash 검색어 |
|-------------|-----------------|
| 프로그래밍 | `coding`, `programming`, `developer` |
| 웹 개발 | `web-development`, `laptop`, `workspace` |
| AI/ML | `artificial-intelligence`, `robot`, `neural-network` |
| 스타트업 | `startup`, `teamwork`, `meeting` |
| 디자인 | `design`, `creative`, `minimal` |
| 마케팅 | `marketing`, `social-media`, `branding` |

## 포스트 전체 필드

```bash
inblog posts create \
  --title "제목"                        # 필수
  --slug "url-slug"                     # 필수 (자동 생성 가능)
  --description "요약"                  # 선택
  --content-file /tmp/content.html      # 선택 (--content로 직접 전달도 가능)
  --notion-url "https://notion.so/..."  # 선택 (Notion 동기화)
  --published                           # 선택 (즉시 발행)
  --tag-ids 1,2,3                       # 선택
  --author-ids uuid1,uuid2             # 선택
  --canonical-url "https://..."         # 선택 (원본 URL)
  --meta-title "SEO 제목"              # 선택
  --meta-description "SEO 설명"        # 선택
  --json                                # AI용 JSON 출력
```

## 이미지 처리

포스트 OG 이미지 (`image` 필드):
- **URL**: 외부 URL → 자동으로 inblog R2 업로드
- **Base64**: `data:image/png;base64,...` 지원 (최대 10MB)
- **inblog CDN**: `source.inblog.dev` / `image.inblog.dev` URL은 그대로 유지
- `--preserve-images` 옵션으로 외부 URL 원본 유지

```json
{
  "image": {
    "url": "https://images.unsplash.com/photo-xxx?w=1200&h=630&fit=crop"
  }
}
```

## 구조화 데이터 (JSON-LD)

`custom_scripts.json_ld_script`로 검색 리치 스니펫 표시. 글 유형에 맞는 스키마 사용:

### BlogPosting (기본)
```json
"custom_scripts": {
  "json_ld_script": {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "포스트 제목",
    "description": "포스트 설명",
    "author": { "@type": "Person", "name": "저자명" },
    "datePublished": "2025-03-15T10:00:00+09:00",
    "dateModified": "2025-03-16T15:00:00+09:00",
    "image": { "@type": "ImageObject", "url": "https://...", "width": 1200, "height": 630 },
    "publisher": {
      "@type": "Organization",
      "name": "블로그명",
      "logo": { "@type": "ImageObject", "url": "https://..." }
    }
  }
}
```

### HowTo (튜토리얼)
```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "React Hooks 사용법",
  "step": [
    { "@type": "HowToStep", "name": "useState 이해하기", "text": "useState는..." },
    { "@type": "HowToStep", "name": "useEffect 활용하기", "text": "useEffect로..." }
  ]
}
```

### FAQPage (FAQ)
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Next.js와 React의 차이점은?",
      "acceptedAnswer": { "@type": "Answer", "text": "Next.js는 React 기반 프레임워크로..." }
    }
  ]
}
```

## Notion 연동

`--notion-url`로 Notion 페이지 URL을 전달하면:
1. 서버가 Notion API로 recordMap을 가져옴
2. `content_type`이 `"notion"`으로 설정됨
3. Notion 페이지가 inblog에서 렌더링됨
4. **주의**: 가져오기에 최대 60초 소요 가능

```bash
inblog posts create \
  --title "Notion에서 가져온 글" \
  --slug "notion-imported-post" \
  --notion-url "https://www.notion.so/page-id" \
  --json
```

## CTA 자동 설정

포스트 레벨 CTA 버튼 (포스트 하단에 표시):
```bash
# 포스트 생성 시 API로 직접 설정 (현재 CLI 미지원, API 직접 호출)
inblog posts update <id> \
  --json
```

content_html 안에 CTA를 넣으려면 callOut + linkButton 조합 사용 (inblog-content-html 참조).

## 에러 처리

| 에러 코드 | 원인 | 대응 |
|----------|------|------|
| `SLUG_CONFLICT` (409) | slug 중복 | 다른 slug 사용 |
| `SUBSCRIPTION_REQUIRED` (403) | 무료/트라이얼 블로그 | 유료 플랜 업그레이드 |
| `PAST_SCHEDULED_DATE` (400) | 예약 날짜가 과거 | 미래 날짜 사용 |
| `INVALID_TAG_IDS` (400) | 존재하지 않는 태그 ID | `inblog tags list`로 확인 |
| `INVALID_AUTHOR_IDS` (400) | 블로그 멤버 아닌 저자 | `inblog authors list`로 확인 |
