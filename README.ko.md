# Flowbit

[English](README.md) | **한국어**

Flowbit은 Trello 스타일의 오픈소스 업무 관리 도구입니다. 보드, 리스트, 카드와
실시간 협업 기능을 제공하며, 직접 설치해서 쓰거나(셀프 호스팅) 서비스 형태로
운영할 수 있습니다.

> **현재 상태: 초기 개발 단계.** [1단계](docs/ROADMAP.md#phase-1-foundation)를
> 마쳤습니다. 계정(이메일·비밀번호, GitHub, Google), 워크스페이스, 영어·한국어
> UI, 명령 한 줄로 실행되는 Docker 구성이 갖춰져 있습니다. 보드, 리스트, 카드는
> 다음 [2단계](docs/ROADMAP.md#phase-2-boards-lists-cards)에서 추가됩니다.

## 목표

- **Trello 수준의 핵심 기능:** 드래그 앤 드롭이 되는 보드·리스트·카드와 멤버,
  라벨, 마감일, 체크리스트, 댓글, 첨부파일, 검색
- **실시간 협업:** 같은 보드를 보는 모든 사람에게 변경 사항과 접속자가 즉시
  보입니다.
- **쉬운 셀프 호스팅:** `docker compose up` 한 번으로 앱, PostgreSQL, Valkey가
  함께 실행됩니다.
- **팀과 기업 지원:** 조직, SSO(OIDC/SAML), 감사 로그
- **Trello 이상의 기능:** 테이블·캘린더·타임라인 뷰, 자동화 규칙, Webhook과
  외부 연동, Trello 가져오기, 플러그형 AI 기능
- **처음부터 다국어 지원:** 영어·한국어 UI, 반응형 웹, PWA 설치 지원

## 기술 스택

| 영역         | 선택                                                                 |
| ------------ | -------------------------------------------------------------------- |
| 언어         | 전 구간 TypeScript                                                   |
| 웹 앱        | React, Vite, TanStack Router·Query, Tailwind CSS, shadcn/ui, dnd-kit |
| API 서버     | NestJS(Fastify), REST + OpenAPI                                      |
| 실시간       | Socket.IO + Valkey                                                   |
| 데이터베이스 | PostgreSQL + Prisma                                                  |
| 모노레포     | pnpm + Turborepo                                                     |
| 테스트       | Vitest, Playwright                                                   |

## 빠른 시작

Docker Compose로 실행합니다.

```sh
git clone https://github.com/hyunsoo3787/flowbit.git && cd flowbit
cp .env.example .env    # AUTH_SECRET 설정 (openssl rand -base64 32)
docker compose up -d
```

그다음 <http://localhost:3000>을 엽니다. 이메일, OAuth, HTTPS, 백업 설정은
[셀프 호스팅 가이드](docs/SELF_HOSTING.md)를 참고하세요.

Flowbit 개발에 참여하려면 [CONTRIBUTING.md](CONTRIBUTING.md)를 보세요.

## 문서

문서는 영어로 작성되어 있습니다.

- [로드맵](docs/ROADMAP.md): 기반 구축부터 확장 기능까지의 단계별 계획
- [아키텍처](docs/ARCHITECTURE.md): 시스템 설계, 데이터 모델, 권한, 실시간
  동기화, 배포
- [결정 기록](docs/DECISIONS.md): 무엇을, 왜 결정했는지와 함께 검토한 대안
- [셀프 호스팅](docs/SELF_HOSTING.md): 설정, 업그레이드, 백업
- [기여 가이드](CONTRIBUTING.md): 개발 환경 구성과 규칙

## 라이선스

Flowbit은 **오픈 코어** 모델을 따릅니다
([D-011](docs/DECISIONS.md#d-011-open-core-licensing-agpl-30--commercial-ee)).

- `ee/` 디렉터리를 제외한 모든 코드는 [**GNU AGPL-3.0**](LICENSE) 라이선스입니다.
- `ee/`의 엔터프라이즈 기능은 별도의 [**상용 라이선스**](ee/LICENSE)를 따릅니다.

## 기여하기

기여를 환영합니다. [CONTRIBUTING.md](CONTRIBUTING.md)부터 읽어 주세요. 외부
기여자는 처음 한 번 [기여자 라이선스 동의(CLA)](CLA.md)에 서명합니다
([D-012](docs/DECISIONS.md#d-012-cla-for-external-contributions)).
[행동 강령](CODE_OF_CONDUCT.md)을 지켜 주시고, 보안 문제는
[SECURITY.md](SECURITY.md)에 안내된 방법으로 비공개 제보해 주세요.
