# Flash Yard ϟ

친구들과 방 코드로 들어가는 오리지널 브라우저 FPS. 한국 항구 컨테이너 훈련장, 8명 자유 전투, 5분 매치. Three.js + Blender + PeerJS로 제작했습니다.

## 플레이

PC Chrome/Edge에서 `친구랑 방 만들기` → `친구 초대 링크 복사` → 친구에게 링크 공유. 방장을 포함해 최대 8명. 혼자서는 `혼자 몸풀기`로 봇 3명과 연습할 수 있습니다.

| 조작 | 기능 |
| --- | --- |
| WASD / Shift / Space | 이동 / 달리기 / 점프 |
| 마우스 / 좌클릭 | 조준 / 자동소총 발사 |
| R | 재장전 (예비 탄약 무제한) |
| G / F | 수류탄 / 섬광탄 |
| Tab / Esc | 점수표 / 메뉴 |

아이템 위를 지나가면 자동 획득, 9초 후 재생성, 투척물 각각 최대 5개. 사망 후 3초 뒤 부활하며 2초 보호. 수류탄은 본인에게도 피해를 줍니다. 섬광은 거리, 시선 방향, 엄폐 여부를 반영하고 기본값은 어두운 섬광 효과입니다. 브라우저가 마우스 고정을 거부하면 드래그 모드에서 우클릭 드래그로 조준할 수 있습니다.

## 개발

```sh
npm ci
npm run dev
npm test
npm run build
```

Blender 원본은 `art/yard.blend`, `art/operator.blend`, 게임용 파일은 `public/models/*.glb`. 생성 스크립트로 재현할 수 있습니다.

```sh
node scripts/export-map.mjs
blender --background --python art/build_assets.py
```

`src/map.js`가 맵 배치의 기준이며 Blender 출력과 게임 충돌 모두 같은 배치를 사용합니다. 변경 후에는 Blender 에셋도 다시 생성하세요.

## 멀티플레이 구조와 현재 범위

- GitHub Pages는 정적 게임 파일을 제공합니다. PeerJS Cloud가 연결 신호를 교환하며 실제 게임 데이터는 WebRTC를 통해 방장에게 전달됩니다.
- 방장 기준 60Hz 게임 판정, 20Hz 상태 전송, 클라이언트 이동 예측. 총격/아이템/폭발/킬 판정은 방장이 처리합니다.
- 방장은 게임 창을 열어 두어야 합니다. 방장 종료 시 방이 닫히며 방장 자동 이전은 없습니다. 브라우저가 백그라운드 탭이나 절전 중인 기기를 정지하면 게임도 지연됩니다.
- 무료 공개 연결 서비스의 가용성과 NAT/방화벽 환경에 영향을 받습니다. 전용 TURN 릴레이가 없어 일부 회사/학교/모바일 네트워크에서는 연결할 수 없습니다. 이 경우 다른 네트워크를 이용하세요.
- 친구끼리 즐기는 초기 버전입니다. 계정, 영구 전적, 경쟁전용 치트 방지, 전용 서버, 모바일 터치 조작은 구현하지 않았습니다. 방 코드를 아는 사람은 입장할 수 있습니다.
- Higgsfield는 연결 설치를 요청했지만 이 제작 세션에서 호출 가능한 생성 도구가 제공되지 않아 사용하지 못했습니다. 포함된 맵/캐릭터는 Blender에서 직접 생성한 원본입니다.

## 배포

GitHub Pages의 Source를 **GitHub Actions**로 설정하세요. `main` push 시 테스트와 빌드를 거쳐 `.github/workflows/deploy.yml`이 배포합니다. Vite 상대 경로를 사용하므로 저장소 하위 경로에서도 실행됩니다.

외부 서비스: PeerJS Cloud (멀티 연결), Google Fonts (글꼴, 로컬 fallback 제공). API 키나 사용자 계정은 필요하지 않습니다. 기존 FPS의 저작물이나 게임 파일은 포함하지 않습니다.

공식 문서: [Three.js](https://threejs.org/docs/) · [PeerJS](https://peerjs.com/client/api/peer)
