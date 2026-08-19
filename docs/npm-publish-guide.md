# @inblog/cli npm 배포 가이드

## 사전 준비

### 1. npm 계정

```bash
# npm 계정 없으면 생성
npm adduser

# 이미 있으면 로그인
npm login

# 로그인 확인
npm whoami
```

### 2. npm 조직 (Scoped Package)

`@inblog/cli`는 scoped package이므로 npm 조직이 필요하다.

```bash
# npm 웹사이트에서 "inblog" 조직 생성
# https://www.npmjs.com/org/create

# 또는 CLI로:
npm org create inblog
```

### 3. 패키지 접근 설정

scoped package는 기본적으로 private이다. public으로 배포하려면:

```json
// package.json에 추가
{
  "publishConfig": {
    "access": "public"
  }
}
```

---

## 배포 절차

### Step 1: 빌드 & 테스트

```bash
# 클린 빌드
rm -rf dist
npm run build

# 테스트
npm run test

# 타입 체크
npm run lint
```

### Step 2: 로컬 패키지 검증

```bash
# 패키지에 포함될 파일 확인
npm pack --dry-run

# 실제 .tgz 생성하여 로컬 테스트
npm pack

# 다른 디렉토리에서 로컬 설치 테스트
cd /tmp
npm install /path/to/inblog-cli/inblog-cli-0.1.0.tgz
npx inblog --help
npx inblog auth whoami --json
```

### Step 3: 버전 업데이트

```bash
# 패치 (0.1.0 → 0.1.1)
npm version patch

# 마이너 (0.1.0 → 0.2.0)
npm version minor

# 메이저 (0.1.0 → 1.0.0)
npm version major

# 프리릴리즈
npm version prerelease --preid=beta  # 0.1.0 → 0.1.1-beta.0
```

`npm version`은 자동으로:
- `package.json`의 version 업데이트
- git commit + tag 생성

### Step 4: npm 배포

```bash
# 첫 배포 (public access 필수)
npm publish --access public

# 이후 배포
npm publish
```

### Step 5: 배포 확인

```bash
# npm에서 확인
npm info @inblog/cli

# 글로벌 설치 테스트
npm install -g @inblog/cli
inblog --version

# npx로 테스트
npx @inblog/cli --help
```

---

## GitHub Actions 자동 배포

`.github/workflows/publish.yml`:

```yaml
name: Publish to npm

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - run: npm ci
      - run: npm run test
      - run: npm run build
      - run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### npm 토큰 설정

1. https://www.npmjs.com → Access Tokens → Generate New Token
2. **Automation** 타입 선택 (2FA 우회)
3. GitHub 레포 → Settings → Secrets → `NPM_TOKEN`으로 추가

### 릴리즈 워크플로우

```bash
# 1. 버전 업데이트
npm version minor

# 2. 푸시 (태그 포함)
git push origin main --tags

# 3. GitHub에서 Release 생성
gh release create v0.2.0 --generate-notes
# → 자동으로 npm publish 트리거
```

---

## CI 테스트 워크플로우

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build
```

---

## package.json 최종 체크리스트

```jsonc
{
  "name": "@inblog/cli",
  "version": "0.1.0",
  "description": "CLI tool for managing inblog.ai content",
  "bin": { "inblog": "./dist/bin/inblog.mjs" },
  "main": "./dist/sdk/index.js",       // SDK 프로그래매틱 사용
  "types": "./dist/sdk/index.d.ts",     // TypeScript 타입
  "files": ["dist", "README.md"],       // npm에 포함할 파일
  "engines": { "node": ">=18" },        // Node.js 최소 버전
  "publishConfig": {
    "access": "public"                  // scoped package public 배포
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "lint": "tsc --noEmit",
    "prepublishOnly": "npm run build"   // publish 전 자동 빌드
  }
}
```

## 배포 전 확인사항

- [ ] `npm run build` 성공
- [ ] `npm run test` 통과
- [ ] `npm run lint` 통과
- [ ] `npm pack --dry-run`으로 포함 파일 확인 (dist/, README.md만)
- [ ] `.npmignore` 또는 `files` 필드로 불필요 파일 제외 (src/, node_modules/, tsconfig 등)
- [ ] `README.md` 작성 (설치, 인증, 주요 커맨드 예시)
- [ ] `LICENSE` 파일 존재
- [ ] `repository` URL 정확
- [ ] 버전 번호 업데이트 (`npm version`)
- [ ] `CHANGELOG.md` 업데이트 (선택)

## 문제 해결

| 문제 | 해결 |
|------|------|
| `npm ERR! 402 Payment Required` | `--access public` 추가 (scoped package) |
| `npm ERR! 403 Forbidden` | npm 조직 권한 확인, `npm login` 재시도 |
| `npm ERR! 409 Conflict` | 이미 같은 버전 존재 → `npm version` 실행 |
| `bin` 실행 안됨 | `dist/bin/inblog.mjs` 첫 줄에 `#!/usr/bin/env node` 확인 |
| TypeScript import 에러 | `tsup.config.ts`에서 `dts: true` 확인 |
