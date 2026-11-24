# backend 요청 — 편의시설 DTO 선언 순서(실행하면 바로 죽음)

- 보낸 곳: deskless (2026-11-25)
- 받는 곳: [deskless-backend](https://github.com/HaSungJe/deskless-backend)
- 기준 커밋: `c0534f1` — 원인은 `7f9b498`(업체 편의시설 store_detail)
- 공개 API · 사용자 동작 변화: 없음(고치면 원래 계약대로 뜬다)

## 왜

deskless 로컬 클러스터에서 `c0534f1` 이미지가 **gateway · user-service · admin-service 모두 부팅하자마자 죽는다**(CrashLoopBackOff — scheduler 만 뜬다). `npm run build` 는 통과하고 실행 때만 난다.

```
file:///app/dist/apps/gateway/libs/contracts/src/store/dto/store-detail.dto.js:138
    __metadata("design:type", StoreDetailFacilityResultDto)
ReferenceError: Cannot access 'StoreDetailFacilityResultDto' before initialization
```

상세 DTO 의 필드 타입으로 쓰는 편의시설 클래스가 **같은 파일에서 더 아래에** 선언돼 있다. ESM(`"type": "module"`)에서 `class` 는 선언 전에 읽으면 TDZ 오류인데, `emitDecoratorMetadata` 가 클래스를 만드는 순간 필드 타입(`design:type`)을 값으로 읽어 선언 전 클래스를 건드린다.

## 1. 지우는 것

없음.

## 2. 더하는 것

없음.

## 3. 고치는 것

| 위치(기준 커밋) | 지금 | 고칠 것 |
|---|---|---|
| `libs/contracts/src/store/dto/store-detail.dto.ts:85` | `StoreDetailResultDto.store_detail: StoreDetailFacilityResultDto` — 편의시설 클래스가 아래 | `StoreDetailFacilityResultDto` 를 `StoreDetailResultDto` 보다 위로 |
| `libs/contracts/src/store/dto/store-mine.dto.ts:105` | `StoreMineResultDto.store_detail: StoreMineFacilityResultDto` — 아래 | `StoreMineFacilityResultDto` 를 위로 |
| `libs/contracts/src/discovery/dto/discovery-store-detail.dto.ts:118` | `DiscoveryStoreDetailResultDto.store_detail: DiscoveryStoreFacilityResultDto` — 아래 | `DiscoveryStoreFacilityResultDto` 를 위로 |

- deskless 가 `libs/contracts/src/**/*.ts` 를 훑은 결과(클래스 타입 필드가 같은 파일의 아래 클래스를 가리키는 곳)는 위 3곳뿐이다 — 받는 세션이 다시 확인한다.

## 4. 그대로 두는 것

- DTO 모양 · 필드 · Swagger · 검증 데코레이터.

## 5. 영향 전수 확인 · 정리 (이 요청에 포함)

- 찾는 법: contracts DTO 파일마다 "클래스 타입 필드(`: XxxDto`) → 같은 파일에서 그 클래스가 더 아래에 선언" 인 곳(위 표 + 앞으로 같은 모양을 막을 방법).
- 재발 막기(제안 — 방식은 백엔드가 정한다): 규약(`docs/conventions.md` DTO 절)에 "중첩 결과 DTO 는 그것을 쓰는 클래스보다 위에 선언(ESM + 데코레이터 메타데이터)" 한 줄, 그리고 `npm run build` 뒤 빌드 산출물을 실제로 불러오는 확인(예: 세 앱의 `dist/.../main.js` 를 import 만 하는 스크립트 · 또는 contracts DTO 를 전부 import 하는 검사)으로 "빌드는 되는데 실행 때 죽는" 경우를 잡는다 — Vitest 는 이 오류를 내지 않았다.

## 6. 끝난 상태

- [ ] 위 3곳(+ 다시 찾은 곳)의 선언 순서가 고쳐졌다
- [ ] 빌드 산출물로 세 앱이 뜨는 것(또는 DTO import)을 확인했다
- [ ] 재발 막기를 정했다(규약 한 줄 · 확인 방법) — 결과 요약을 deskless 에 전달
