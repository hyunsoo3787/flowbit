# 인수인계 문서 (2026-10)

이 문서는 지금까지의 작업을 다른 환경(개인 원격 서버 등)에서 이어가기 위한
안내입니다. 프로젝트의 공식 문서는 영어로 쓰여 있고, 이 문서는 그 문서들로 가는
지도 역할을 합니다. 자세한 설계와 이유는 아래 링크된 문서를 보세요.

## 1. 현재 상태 한눈에 보기

| 항목            | 상태                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 로드맵          | 1~4단계 완료, 다음은 5단계 (첨부파일·검색·보관) — [ROADMAP.md](ROADMAP.md)                                               |
| `main` 브랜치   | PR #3(Docker 수정)까지 반영됨                                                                                            |
| 작업 브랜치     | `claude/optimistic-pasteur-f8l13r` — PR #4로 열려 있음 (배경색 + 3단계 + 4단계 + 이 문서). CI 통과, 충돌 없음, 머지 대기 |
| 테스트 (로컬)   | API 통합 133, 웹 단위 34, shared 11, Playwright e2e 47 (데스크톱·모바일) 모두 통과                                       |
| Docker          | 이미지 빌드, Compose 실행, 헬스체크·스모크 테스트 통과                                                                   |
| 커밋 안 된 작업 | 없음                                                                                                                     |

**가장 먼저 할 일:** PR #4를 리뷰하고 `main`에 머지하세요. 그 다음부터는
`main`에서 새 브랜치를 따서 작업하면 됩니다.

## 2. 원격 서버에서 개발 환경 만들기

요구사항: Node.js 22.12 이상, pnpm 10 (`corepack enable`로 `package.json`에
고정된 버전이 설치됨), Docker (PostgreSQL·Valkey용). Linux 또는 macOS를
권장합니다. Windows라면 WSL2 안에서 작업하세요(네이티브 Windows는 pnpm 실행·줄바꿈
문제로 검증되지 않았습니다).

```sh
git clone https://github.com/hyunsoo3787/flowbit.git && cd flowbit
git checkout main            # PR #4 머지 전이라면: git checkout claude/optimistic-pasteur-f8l13r
corepack enable
pnpm install

# PostgreSQL(flowbit, flowbit_test DB 포함)과 Valkey
docker compose -f docker-compose.dev.yml up -d

# API 설정
cp apps/api/.env.example apps/api/.env
# apps/api/.env 의 AUTH_SECRET 을 바꾸기: openssl rand -base64 32

pnpm --filter @flowbit/api db:migrate     # DB 스키마 적용
pnpm build && pnpm --filter @flowbit/api db:seed   # 테스트 계정·샘플 보드 (선택)

pnpm dev    # API :3000, 웹 :5173 (웹이 /api 를 API로 프록시)
```

브라우저에서 <http://localhost:5173> 을 엽니다. 원격 서버라면 SSH 포트
포워딩(`ssh -L 5173:localhost:5173 -L 3000:localhost:3000 서버`)을 쓰거나,
`PUBLIC_URL`을 실제로 접속하는 주소로 바꾸세요. 인증 쿠키와 OAuth 콜백이
`PUBLIC_URL`을 기준으로 동작합니다.

시드 계정 (비밀번호는 모두 `flowbit-dev-password`):

| 이메일               | 역할                                  |
| -------------------- | ------------------------------------- |
| `admin@flowbit.dev`  | 워크스페이스 관리자 + 인스턴스 관리자 |
| `member@flowbit.dev` | 워크스페이스 멤버 (편집 가능)         |
| `viewer@flowbit.dev` | 워크스페이스 뷰어 (읽기 전용)         |

API 문서: <http://localhost:3000/api/docs>. SMTP가 없으면 이메일(인증·초대·알림)은
API 로그에 출력됩니다.

### 운영처럼 실행하기 (Docker)

```sh
cp .env.example .env         # AUTH_SECRET, PUBLIC_URL, POSTGRES_PASSWORD 설정
docker compose up -d --build
docker compose logs flowbit | grep setup     # 첫 관리자 설정 링크
docker compose exec flowbit flowbit admin list
```

자세한 내용은 [SELF_HOSTING.md](SELF_HOSTING.md).

## 3. 검증 명령 (CI와 같은 순서)

```sh
pnpm format:check
pnpm build
pnpm lint
pnpm typecheck
pnpm test                                   # Valkey 테스트까지: TEST_VALKEY_URL=redis://localhost:6379 pnpm test
pnpm license:check
pnpm --filter @flowbit/api gen:openapi && pnpm --filter @flowbit/web gen:api
git diff --exit-code -- apps/api/openapi.json apps/web/src/api/schema.d.ts apps/web/src/routeTree.gen.ts
pnpm --filter @flowbit/web test:e2e         # 먼저 pnpm build 필요. 처음엔 playwright install chromium
```

CI(`.github/workflows/ci.yml`)는 위 과정 + Docker 이미지 빌드·Compose 스모크
테스트를 돌립니다. CLA 워크플로(`cla.yml`)는 일부러 꺼 둔 상태입니다.

## 4. 코드 지도

```
apps/api/src
  auth/          Better Auth 연동, 세션 가드, 가입 차단·정지 훅 (D-020)
  workspaces/    워크스페이스 CRUD, 역할 정책
  boards/        보드·리스트·카드·라벨·체크리스트·댓글, 권한(board-policy.ts), 정렬(ordering.ts)
  members/       워크스페이스·보드 멤버, 초대
  admin/         인스턴스 관리자, 설정 링크, 서버 설정 (D-021)
  notifications/ 알림, 지켜보기, 활동 기록
  realtime/      Socket.IO 게이트웨이, 보드 룸·사용자 룸, 접속자 표시
  events/        커밋 후 발생하는 도메인 이벤트 (알림이 구독)
  jobs/          Valkey 작업 큐·주기 작업 (D-022)
  mail/          메일 발송, 언어별 템플릿
apps/api/scripts seed.ts(개발 데이터), cli.ts(`flowbit admin …`), generate-openapi.ts
apps/api/prisma  schema.prisma, migrations/
apps/web/src
  routes/        TanStack Router 파일 기반 라우트 (routeTree.gen.ts 는 자동 생성)
  features/      boards, cards, members, notifications, activity, admin, auth, workspaces …
  components/ui  shadcn 스타일 컴포넌트 (Radix 기반)
  i18n/locales   en.json, ko.json
packages/shared  Zod 스키마 = API 계약의 원본, 공용 타입·상수
```

데이터 흐름: Zod 스키마(`packages/shared`) → API 검증 → OpenAPI 문서
(`apps/api/openapi.json`) → 웹 타입(`apps/web/src/api/schema.d.ts`). 쓰기
요청은 트랜잭션 안에서 Activity 행을 함께 기록하고, 커밋 후 Socket.IO로
브로드캐스트합니다. 자세한 건 [ARCHITECTURE.md](ARCHITECTURE.md).

## 5. 꼭 알아야 할 규칙과 함정

이번 작업 중 실제로 부딪힌 것들입니다.

- **API 스키마를 바꾸면** `packages/shared` 빌드 → API 빌드 →
  `gen:openapi` → `gen:api` 순서로 재생성하고 결과를 커밋하세요. CI가 재생성
  결과와의 차이를 검사합니다(Prettier 없이).
- **Prettier는 항상 저장소 루트에서** 실행하세요. 하위 폴더에서 실행하면 설정이
  달리 적용돼 생성 파일이 바뀝니다.
- **웹 타입체크**는 `pnpm --filter @flowbit/web typecheck`(=`tsconfig.app.json`).
  `apps/web/tsconfig.json`은 참조만 있어서 `tsc -p .`은 아무것도 검사하지 않습니다.
- **번역 키는 타입으로 검사**됩니다(`en.json` 기준). `en`·`ko`의 키가 같아야
  하고(테스트), JSX 안의 문자열 리터럴은 린트 에러입니다.
- **Prisma 마이그레이션**은 `prisma migrate dev --name …`. 데이터 변환이
  필요하면 `--create-only`로 만든 뒤 SQL을 고칩니다. AI 에이전트가
  `migrate reset`을 실행하면 Prisma가 막습니다(사용자 동의 필요).
- **Docker 런타임 이미지에 OpenSSL을 설치하지 마세요.** Prisma가 엔진을 다른
  것으로 바꾸려다 시작에 실패합니다(PR #3에서 고친 문제, Dockerfile 주석 참고).
- **e2e 테스트**는 빌드된 API가 웹을 함께 서빙하는 운영 구성으로 돌고,
  `flowbit_test` DB를 API 통합 테스트와 공유합니다. 데이터가 쌓이므로 테스트는
  고유한 이메일·이름을 쓰고, 공유 목록(예: 관리자 활동 기록)은 `.first()`로 봅니다.
- **알림은 비동기**입니다. API 테스트에서 알림을 확인하기 전에
  `app.get(DomainEvents).settled()`를 기다리세요. 테스트 환경(`NODE_ENV=test`)에서는
  작업 큐가 즉시 실행되고, 첫 관리자 설정 링크 출력은 생략됩니다.
- **실시간 에코 억제:** 클라이언트는 자기가 보낸 변경(`x-client-mutation-id`)의
  이벤트를 무시합니다. 낙관적으로 반영하지 않는 값(배지 카운트 등)을 다시 보낼
  때는 mutation id를 `null`로 보내야 본인 탭에도 반영됩니다.
- **다이얼로그 안의 입력칸에서 Esc를 직접 처리**하려면 `ESCAPE_HANDLED`
  속성(`components/ui/dialog.tsx`)을 붙이세요. Radix가 Esc를 먼저 가로챕니다.
- **dnd-kit:** 드래그가 꺼져 있을 때는 sortable 속성을 붙이지 마세요. 스크린
  리더가 링크를 "비활성"으로 읽습니다(`card-tile.tsx` 참고).
- **라이선스 정책:** 런타임 의존성은 허용형 라이선스만 (D-013, 예외는 검토 후).
  `pnpm license:check`가 검사합니다.

## 6. 남은 일

**바로 다음**

1. PR #4 머지.
2. 5단계: 첨부파일 저장소(로컬·S3 호환, D-019), 파일 첨부와 이미지 커버, 카드·리스트·보드
   보관과 복원, PostgreSQL 전문 검색, 보드 템플릿·복사, PWA, 운영 가이드와 버전 태그
   Docker 이미지 — [ROADMAP.md](ROADMAP.md#phase-5-attachments-search-archive).

**우선순위 낮음 (1단계에서 미뤄 둔 것, 외부 PR을 받기 전·`ee/` 코드 전까지)**

- 라이선스 주체 결정, `CLA.md`·`ee/LICENSE` 법률 검토, `CODE_OF_CONDUCT.md` 연락처,
  CLA 워크플로 재활성화 — [ROADMAP.md](ROADMAP.md#open-items-from-phase-1).

**알고 있는 한계 (필요해지면 개선)**

- 다른 보드로 옮긴 카드의 활동 기록은 현재 보드에서 일어난 것만 보입니다.
- 마감 임박 이메일의 시각은 UTC로 표시합니다(사용자 시간대를 아직 저장하지 않음).
- 알림 이메일은 묶지 않고 건마다 보냅니다.
- 체크리스트 항목은 같은 체크리스트 안에서만 드래그할 수 있습니다(API는 다른
  체크리스트로 옮기기도 지원).
- 댓글은 삭제하면 바로 지워집니다(소프트 삭제 아님).
- Valkey 없이 단일 프로세스로 돌 때, 실행 전에 프로세스가 멈추면 대기 중인 작업
  (알림 이메일)은 사라집니다(D-022).

## 7. 주요 결정 (자세한 이유는 [DECISIONS.md](DECISIONS.md))

- D-001 전체 범위를 단계별로 구현 / D-002 셀프 호스팅과 SaaS 모두 지원
- D-006 REST + OpenAPI, 웹 클라이언트 타입 자동 생성
- D-007 PostgreSQL + Prisma / D-008 조직 > 워크스페이스 > 보드 (조직은 UI에 숨김)
- D-010 실시간은 WebSocket(Socket.IO) / D-011 오픈 코어(AGPL + `ee/` 상용) / D-012 CLA
- D-013 허용형 라이선스 의존성만 / D-015 분수 인덱스 정렬 / D-016·D-017 다국어·반응형+PWA
- D-019 첨부파일 저장소(로컬·S3 호환) / D-020 Better Auth를 자체 모듈 뒤에 둠
- D-021 인스턴스 관리자는 계정만 관리, 콘텐츠는 못 봄 / D-022 Valkey 리스트 기반 작업 큐

## 8. Claude Code로 이어서 작업할 때

저장소 루트의 `CLAUDE.md`에 에이전트가 지켜야 할 규칙이 요약돼 있어서 Claude
Code가 자동으로 읽습니다. 새 세션에서는 이렇게 시작하면 됩니다.

> docs/HANDOFF.md 와 docs/ROADMAP.md 를 읽고, 5단계를 계획해 줘.
