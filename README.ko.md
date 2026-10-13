# Flowbit

[English](README.md) | **한국어**

Flowbit은 Trello 스타일의 오픈소스 업무 관리 도구입니다. 보드, 리스트, 카드와
실시간 협업 기능을 제공하며, 직접 설치해서 쓰거나(셀프 호스팅) 서비스 형태로
운영할 수 있습니다.

> **현재 상태: 기획 단계.** 아직 코드는 없습니다. 프로젝트의 핵심 결정 사항,
> 아키텍처, 로드맵을 문서로 정리해 두었고, 구현은
> [1단계](docs/ROADMAP.md#phase-1-foundation)부터 시작합니다.

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

| 영역 | 선택 |
|---|---|
| 언어 | 전 구간 TypeScript |
| 웹 앱 | React, Vite, TanStack Router·Query, Tailwind CSS, shadcn/ui, dnd-kit |
| API 서버 | NestJS(Fastify), REST + OpenAPI |
| 실시간 | Socket.IO + Valkey |
| 데이터베이스 | PostgreSQL + Prisma |
| 모노레포 | pnpm + Turborepo |
| 테스트 | Vitest, Playwright |

## 문서

문서는 영어로 작성되어 있습니다.

- [로드맵](docs/ROADMAP.md): 기반 구축부터 확장 기능까지의 단계별 계획
- [아키텍처](docs/ARCHITECTURE.md): 시스템 설계, 데이터 모델, 권한, 실시간
  동기화, 배포
- [결정 기록](docs/DECISIONS.md): 무엇을, 왜 결정했는지와 함께 검토한 대안

## 라이선스

Flowbit은 **오픈 코어** 모델을 따릅니다
([D-011](docs/DECISIONS.md#d-011-open-core-licensing-agpl-30--commercial-ee)).

- `ee/` 디렉터리를 제외한 모든 코드는 **GNU AGPL-3.0** 라이선스입니다.
- `ee/`의 엔터프라이즈 기능은 별도의 **상용 라이선스**를 따릅니다.

라이선스 파일은 1단계에서 추가합니다.

## 기여하기

1단계에서 레포지토리 도구 설정이 끝나면 기여를 받을 예정입니다. 외부
기여자에게는 기여자 라이선스 동의(CLA) 서명을 요청합니다
([D-012](docs/DECISIONS.md#d-012-cla-for-external-contributions)).
기여 가이드는 `CONTRIBUTING.md`로 공개할 예정입니다.
