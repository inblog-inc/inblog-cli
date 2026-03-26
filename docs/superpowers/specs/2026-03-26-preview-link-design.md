# Preview Link Feature Design

발행 전 시각적 확인을 위한 프리뷰 링크 기능. Claude Code가 `claude-in-chrome`으로 실제 렌더링을 스크린샷하여 가독성, 이미지 깨짐, 레이아웃 이상, 누락 요소를 체크한 후 발행할 수 있도록 한다.

## 목적

- 발행 전 실제 블로그에서의 렌더링 결과를 시각적으로 확인
- 이미지 깨짐/누락, 레이아웃 문제, 가독성 이슈를 사전 차단
- Claude Code 워크플로우에 프리뷰 확인 단계를 자연스럽게 통합

## 변경 범위

3개 레포에 걸친 변경:

1. **inblog** (서버) — `/api/preview-tokens` 엔드포인트에 Bearer 토큰 인증 추가
2. **inblog-cli** — 프리뷰 토큰 SDK 엔드포인트 + `posts preview` 커맨드 + 자동 프리뷰 링크 출력
3. **inblog-ai-skills** — 5개 스킬에 프리뷰 확인 워크플로우 통합

---

## 1. 인블로그 서버 변경

### 파일: `/app/api/preview-tokens/route.ts`

기존 엔드포인트에 Bearer 토큰 인증을 추가한다. 대시보드의 세션 쿠키 인증도 그대로 유지.

### 인증 로직

```
1. Authorization 헤더에서 Bearer 토큰 추출
2. Supabase getUser(token)으로 유저 확인
3. post의 blog_id를 기준으로 profiles_blogs 멤버십 검증 (X-Blog-Id 헤더가 아닌 포스트 자체의 blog_id 사용)
4. 인증 실패 시 401 반환
5. 검증된 유저 ID를 createdBy에 사용 (기존 x-user-id 헤더 대체)
```

### 인증 우선순위

```
Bearer 토큰 있음 → Supabase getUser()로 검증
Bearer 토큰 없음 → 기존 세션/x-user-id 방식 유지 (대시보드 호환)
```

### 엔드포인트 동작 (기존과 동일)

| 메서드 | 경로 | Body/Query | 응답 |
|--------|------|------------|------|
| POST | `/api/preview-tokens` | `{ post_id, ttl_hours?, one_time?, name? }` | `{ ok, token, share_url, expires_at, site, name }` |
| GET | `/api/preview-tokens?post_id={id}` | — | `[{ token, share_url, expires_at, one_time, consumed, name }]` |
| DELETE | `/api/preview-tokens?token={token}` | — | `{ ok, revoked }` |

> **참고:** DELETE는 query parameter로 토큰을 받도록 변경한다. 기존 body 기반 방식은 CLI의 `rawDelete`가 body를 지원하지 않기 때문.

---

## 2. inblog-cli 변경

### 2-1. SDK 엔드포인트

**새 파일: `src/sdk/endpoints/preview-tokens.ts`**

```typescript
export class PreviewTokensEndpoint {
  constructor(private client: InblogClient) {}

  /** 프리뷰 토큰 생성 */
  async create(postId: string, options?: {
    ttlHours?: number;    // CLI 기본값 24, 항상 명시적으로 전송
    oneTime?: boolean;    // 기본 false
    name?: string;
  }): Promise<PreviewToken>

  /** 포스트의 활성 토큰 목록 */
  async list(postId: string): Promise<PreviewToken[]>

  /** 토큰 삭제 */
  async revoke(token: string): Promise<void>
}
```

- 일반 JSON 요청/응답 사용 (`client.rawPost`, `client.rawGet`).
- 경로: `/preview-tokens` → `buildUrl`에 의해 `/api/preview-tokens`로 변환됨.
- `postId`는 CLI 관례에 따라 `string`으로 받고, 서버 전송 시 `parseInt()`로 변환.
- `revoke`는 `client.rawDelete('/preview-tokens?token=xxx')`로 query parameter 사용.
- **TTL 주의:** 서버 기본값은 48시간이지만, CLI는 항상 `ttl_hours: 24`를 명시적으로 전송.

**타입 정의 추가: `src/sdk/types.ts`**

```typescript
export interface PreviewToken {
  token: string;
  share_url: string;
  expires_at: number | null;  // Unix timestamp (ms), SDK에서 표시 시 ISO 문자열로 변환
  one_time: boolean;
  consumed: boolean;
  name?: string;
  site?: string;
  ttl_sec_left?: number;
  created_at?: number;
}
```

**`src/sdk/index.ts`에 export 추가.**

**`src/utils/client-factory.ts`에 `previewTokens` 인스턴스 추가.**

### 2-2. 커맨드

**`src/commands/posts.ts`에 추가:**

#### `posts preview <id>`
- 프리뷰 토큰 생성 (기본 24시간 TTL)
- 옵션: `--ttl <hours>` (1, 24, 72, 168, 720, 0=무제한), `--one-time`, `--name <name>`
- 출력: 프리뷰 링크 (`https://inblog.io/p/{token}`), 만료 시간

#### `posts preview list <id>`
- 해당 포스트의 활성 토큰 목록 출력
- 테이블: 토큰(truncated), 이름, 만료시간, 일회용 여부, 사용 여부

#### `posts preview revoke <token>`
- 토큰 삭제
- 성공 메시지 출력

#### `posts create` / `posts update` 자동 프리뷰

포스트 생성/수정 완료 후:
1. 프리뷰 토큰 자동 생성 (24시간 TTL, name: "cli-auto")
2. 기존 출력 하단에 프리뷰 링크 추가 출력
3. `--no-preview` 플래그로 비활성화 가능 (배치 작업, CI/CD 용)
4. 프리뷰 토큰 생성 실패 시 exit code는 0 유지 (메인 동작 성공)

```
✓ Post created (id: 456)

  Title:   프리뷰 기능 소개
  Slug:    preview-feature-intro
  Status:  draft

  Preview: https://inblog.io/p/abc123xyz  (expires in 24h)
```

`--json` 모드에서는 응답 객체에 `preview` 필드 추가:
```json
{
  "id": "456",
  "title": "프리뷰 기능 소개",
  "preview": {
    "url": "https://inblog.io/p/abc123xyz",
    "token": "abc123xyz",
    "expires_at": "2026-03-27T12:00:00Z"
  }
}
```

---

## 3. inblog-ai-skills 변경

### 3-1. `write-seo-post.md`

발행 직전에 프리뷰 확인 단계 삽입:

```
기존: 생성 → 발행
변경: 생성 → 프리뷰 확인 → 발행
```

추가할 단계:
1. `posts create` 출력에서 프리뷰 링크 확인
2. `claude-in-chrome`으로 프리뷰 페이지 열기 및 스크린샷
3. 시각적 점검:
   - 가독성 (제목, 본문 텍스트, 단락 간격)
   - 이미지 로드 여부 및 깨짐 체크
   - 레이아웃 이상 여부
   - 누락된 요소 (커버 이미지, 태그 등)
4. 문제 발견 시 `posts update`로 수정 후 재확인
5. 이상 없으면 사용자에게 확인 후 발행

### 3-2. `manage-posts.md`

- `posts preview` 커맨드 사용법 안내 추가
- 포스트 수정 후 프리뷰로 변경사항 확인하는 워크플로우 추가

### 3-3. `content-quality-checklist.md`

시각적 확인 항목 추가:
- 프리뷰 링크로 실제 렌더링 확인
- 이미지 전체 로드 여부
- 커버 이미지 표시 확인
- 코드 블록/테이블 등 특수 요소 렌더링 확인

### 3-4. `autopilot.md`

발행 전 프리뷰 확인을 필수 단계로 인식:
- 포스트 발행 액션 수행 시 프리뷰 확인을 선행 단계로 포함

### 3-5. `api-reference.md`

`posts preview` 커맨드 문서 추가:
```
posts preview <id> [--ttl <hours>] [--one-time] [--name <name>]
posts preview list <id>
posts preview revoke <token>
```

---

## 데이터 흐름

```
[Claude Code / User]
       │
       ▼
  inblog posts create --title "..." --content-file ./post.html
       │
       ▼
  [inblog-cli]
   1. POST /api/v1/posts → 포스트 생성
   2. POST /api/preview-tokens → 프리뷰 토큰 생성 (자동, 24h TTL)
   3. 출력: Preview: https://inblog.io/p/{token}
       │
       ▼
  [AI Skill: write-seo-post]
   4. claude-in-chrome으로 프리뷰 URL 열기
   5. 스크린샷 → 시각적 점검 (가독성, 이미지, 레이아웃)
   6. 문제 있으면 → posts update → 재확인
   7. 이상 없으면 → posts publish
```

---

## 에러 처리

- 인증 실패 (401): "로그인이 필요합니다" 메시지
- 블로그 멤버 아님 (403): "이 블로그에 접근 권한이 없습니다"
- 포스트 없음 (404): "포스트를 찾을 수 없습니다"
- 프리뷰 토큰 생성 실패: 포스트 생성/수정은 성공으로 처리, 프리뷰 링크 없이 경고 출력 (프리뷰는 부가 기능이므로 메인 동작을 막지 않음)

---

## 설계 결정 사항

1. **프리뷰 토큰 기본 TTL: 24시간** — CLI에서 빠르게 확인 후 자동 만료
2. **자동 프리뷰: 항상** — create/update 시 무조건 프리뷰 링크 출력
3. **커맨드 구조: `posts preview` 서브커맨드** — 기존 posts 그룹 하위
4. **인증: 기존 엔드포인트에 Bearer 추가** — 새 v1 엔드포인트 불필요
5. **프리뷰 토큰 생성 실패는 비차단** — 메인 동작(생성/수정)에 영향 없음
6. **AI 스킬에서 브라우저 확인 권장** — CLI는 링크만 출력, 시각적 확인은 스킬이 가이드
7. **DELETE는 query parameter** — `rawDelete`가 body를 지원하지 않으므로 `?token=xxx` 방식
8. **서버 DELETE 엔드포인트도 query parameter 지원 추가** — 기존 body 방식과 양립
9. **`--no-preview` 플래그** — 배치/CI 환경에서 자동 프리뷰 비활성화 옵션
