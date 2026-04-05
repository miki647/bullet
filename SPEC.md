# Particle Swarm Shooter — Architecture & Development Spec

> **목적**: 사내 공모전 출품용 웹 게임. WebGPU Compute Shader를 활용한 대규모 파티클 시스템이 핵심 차별점.
> **개발 기간**: 2주 (1인 개발)
> **핵심 원칙**: 조작은 단순하게, 비주얼은 WebGPU로 압도적으로.

---

## 1. 게임 개요

### 1.1 컨셉
탑다운 2D 우주 슈팅 서바이벌. 플레이어가 우주선을 조작해 밀려오는 적을 격파하며, 적 격파 시 GPU Compute Shader로 수만 개의 파티클이 폭발하는 비주얼이 핵심.

### 1.2 핵심 게임 루프
1. 적이 웨이브 단위로 화면 가장자리에서 스폰
2. 플레이어가 이동 + 발사로 적을 격파
3. 적 격파 시 GPU 파티클 폭발 이펙트 발생
4. 연속 킬(Chain Kill) 시 파티클 규모가 기하급수적 증가
5. 웨이브가 진행될수록 적 수/종류 증가
6. 플레이어 HP가 0이 되면 게임 오버 → 최종 스코어 표시

### 1.3 조작
- **PC**: WASD 이동, 마우스 조준, 좌클릭 발사
- **모바일**: 왼쪽 가상 조이스틱 이동, 오른쪽 가상 조이스틱 조준+자동발사 (듀얼 스틱)

---

## 2. 기술 스택

### 2.1 핵심 라이브러리
| 항목 | 선택 | 이유 |
|------|------|------|
| 렌더링 엔진 | **Three.js (r171+)** + WebGPURenderer | WebGPU 기본, WebGL2 자동 폴백 |
| 빌드 도구 | **Vite** | HMR 빠름, 설정 최소 |
| 언어 | **TypeScript** | 타입 안전성, 자동완성 |
| 배포 | **Vercel** 또는 **GitHub Pages** | 무료, HTTPS 기본 지원 (WebGPU 필수) |

### 2.2 Progressive Enhancement 전략
```
기기 접속 시:
├─ navigator.gpu 존재? 
│   ├─ YES → WebGPURenderer + GPU Compute Particles (50,000개)
│   └─ NO  → WebGLRenderer + CPU Particles (3,000~5,000개)
└─ 동일한 게임 로직, 파티클 규모만 스케일링
```

### 2.3 사용하지 않는 것
- 물리 엔진 (직접 간단한 AABB 충돌 처리)
- 외부 게임 프레임워크
- 3D 모델, 텍스처, 외부 이미지 에셋 (전부 코드로 생성하는 네온 와이어프레임 기하 셰이프)

---

## 3. 프로젝트 구조

```
particle-swarm-shooter/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── public/
│   ├── fonts/
│   └── sounds/                    # 효과음 (폭발, 발사, 체인킬)
├── src/
│   ├── main.ts                    # 엔트리 포인트
│   ├── game/
│   │   ├── Game.ts                 # 메인 게임 클래스 (초기화, 게임루프, 배경+후처리)
│   │   ├── GameState.ts            # 게임 상태 관리 (MENU, PLAYING, GAMEOVER)
│   │   └── WaveManager.ts          # 웨이브 시스템 (적 스폰 패턴, 난이도 곡선)
│   ├── entities/
│   │   ├── Player.ts               # 네온 chevron 플레이어 (이동, 회전, 스러스터)
│   │   ├── Bullet.ts               # 총알 (오브젝트 풀링)
│   │   ├── Enemy.ts                # 적 기본 클래스
│   │   └── EnemyTypes.ts           # 적 종류 정의 (Chaser, Swarm, Tank)
│   ├── rendering/                  # ★ Neon Geometry 렌더링 시스템
│   │   ├── NeonShapes.ts           # 네온 와이어프레임 셰이프 팩토리 (다중 레이어)
│   │   ├── NeonGrid.ts             # 동적 격자 배경 (스크롤 + 왜곡)
│   │   ├── StarField.ts            # 반짝이는 별 파티클 (3가지 크기)
│   │   ├── AmbientDust.ts          # 앰비언트 더스트 (패럴랙스)
│   │   └── PostProcessing.ts       # UnrealBloomPass 후처리 파이프라인
│   ├── systems/
│   │   ├── InputSystem.ts          # PC 키보드+마우스 입력 (모바일 추후)
│   │   ├── CollisionSystem.ts      # AABB 충돌 감지
│   │   ├── ScoreSystem.ts          # 점수, 체인킬 배율, 콤보
│   │   └── CameraSystem.ts         # 화면 흔들림(Screen Shake) 처리
│   ├── particles/
│   │   ├── ParticleManager.ts      # 파티클 매니저 (GPU/CPU 분기)
│   │   ├── GPUParticleSystem.ts    # WebGPU Compute Shader 파티클
│   │   ├── CPUParticleSystem.ts    # WebGL2 폴백용 CPU 파티클
│   │   └── shaders/
│   │       ├── particle.compute.wgsl
│   │       └── particle.vert.wgsl
│   ├── effects/
│   │   ├── EngineTrail.ts          # 플레이어 엔진 트레일 (Points + Line)
│   │   ├── HitFlash.ts             # 피격 플래시 (Group traverse 지원)
│   │   ├── ScreenShake.ts          # 화면 흔들림
│   │   └── SlowMotion.ts           # 슬로우 모션 (체인킬 시)
│   ├── ui/
│   │   ├── HUD.ts
│   │   ├── StartScreen.ts
│   │   ├── GameOverScreen.ts
│   │   └── MobileControls.ts
│   └── utils/
│       ├── ObjectPool.ts
│       ├── MathUtils.ts
│       └── DeviceDetect.ts         # WebGPU/WebGL2 감지, 성능 티어
└── README.md
```

---

## 4. 핵심 시스템 상세 설계

### 4.1 Game.ts — 메인 게임 루프

```
초기화 흐름:
1. DeviceDetect로 WebGPU 지원 여부 확인
2. WebGPURenderer 또는 WebGLRenderer 생성
3. Scene, Camera(OrthographicCamera) 설정
4. ParticleManager 초기화 (GPU or CPU 자동 분기)
5. InputSystem 초기화 (PC/모바일 자동 감지)
6. 게임 루프 시작 (requestAnimationFrame)
```

```
매 프레임 업데이트 순서:
1. InputSystem.update()          — 입력 수집
2. Player.update(dt)             — 이동, 발사 쿨다운
3. Bullet.updateAll(dt)          — 총알 이동
4. WaveManager.update(dt)        — 적 스폰 체크
5. Enemy.updateAll(dt)           — 적 이동 AI
6. CollisionSystem.check()       — 충돌 감지
7. → 충돌 발생 시 ParticleManager.emit() — 파티클 방출
8. ParticleManager.update(dt)    — 파티클 업데이트 (GPU dispatch)
9. ScoreSystem.update(dt)        — 콤보 타이머, 배율 감소
10. CameraSystem.update(dt)      — 화면 흔들림 감쇠
11. renderer.render(scene, camera)
```

### 4.2 GPU 파티클 시스템 (핵심!)

이 게임의 핵심 차별점. Compute Shader에서 파티클 물리를 전부 처리.

#### 파티클 데이터 구조 (Storage Buffer)
```
각 파티클 = 48 bytes:
- position:  vec3<f32>  (12 bytes)  — 현재 위치
- velocity:  vec3<f32>  (12 bytes)  — 속도
- color:     vec4<f32>  (16 bytes)  — RGBA 색상 (시간에 따라 변화)
- life:      f32        (4 bytes)   — 남은 수명 (0이면 비활성)
- size:      f32        (4 bytes)   — 파티클 크기
```

#### Compute Shader 로직 (particle.compute.wgsl)
```
@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: SimParams;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let i = id.x;
    if (i >= params.particleCount) { return; }
    
    var p = particles[i];
    if (p.life <= 0.0) { return; }  // 비활성 파티클 스킵
    
    // 물리 업데이트
    p.velocity *= params.damping;                    // 감속
    p.velocity.y -= params.gravity * params.dt;      // 중력 (미약)
    p.position += p.velocity * params.dt;            // 위치 이동
    
    // 수명 감소
    p.life -= params.dt;
    
    // 색상 변화: 밝은 노란색 → 주황 → 빨강 → 어두운 빨강 (수명에 비례)
    let t = p.life / params.maxLife;
    p.color = mix(vec4(0.3, 0.0, 0.0, 0.0), vec4(1.0, 0.9, 0.3, 1.0), t);
    
    // 크기 변화: 점점 작아짐
    p.size = params.baseSize * t;
    
    particles[i] = p;
}
```

#### 파티클 방출 로직
```
emit(position, count, options):
  - 파티클 버퍼에서 life <= 0인 비활성 파티클을 찾아 재활용
  - 초기 속도: 방사형 랜덤 방향 × (baseSpeed + random variance)
  - 초기 색상: 폭발 색상 (적 종류에 따라 다름)
  - 초기 수명: 0.5 ~ 2.0초 랜덤
  - Chain Kill 배율에 따라 count를 곱함 (1x, 2x, 4x, 8x...)
```

#### 렌더링
- **InstancedMesh** 사용 (단일 draw call로 전체 파티클 렌더링)
- 파티클 셰이프: 작은 원형 또는 사각형 (Additive Blending으로 빛나는 느낌)
- Additive Blending: `THREE.AdditiveBlending` → 겹치면 더 밝아져서 폭발 느낌 극대화

#### CPU 폴백 (CPUParticleSystem.ts)
- 동일한 로직을 JavaScript에서 실행
- 파티클 수를 3,000~5,000개로 제한
- InstancedMesh는 동일하게 사용 (렌더링 효율)

### 4.3 적(Enemy) 시스템

#### 적 종류 (3가지)
| 종류 | 행동 | HP | 스폰 시작 | 파티클 색상 |
|------|------|-----|----------|------------|
| **Chaser** | 플레이어를 직선으로 추적 | 1 | Wave 1 | 주황/빨강 |
| **Swarm** | 군집 행동 (Boid-like), 무리 지어 이동 | 1 | Wave 3 | 초록/시안 |
| **Tank** | 느리지만 HP 높음, 격파 시 대형 폭발 | 5 | Wave 5 | 보라/마젠타 |

#### 적 이동 AI
```
Chaser:
  direction = normalize(player.position - this.position)
  this.position += direction * speed * dt

Swarm (간소화된 Boid):
  separation = 가까운 동료와 거리 유지
  alignment  = 무리 평균 방향 정렬
  cohesion   = 무리 중심으로 이동
  chase      = 플레이어 방향으로 가중치
  velocity   = (separation * 1.5 + alignment * 1.0 + cohesion * 1.0 + chase * 2.0)

Tank:
  direction = normalize(player.position - this.position)
  this.position += direction * (speed * 0.3) * dt  // 매우 느림
```

### 4.4 웨이브 시스템 (WaveManager.ts)

```
Wave 구성:
  wave 1:  Chaser × 5
  wave 2:  Chaser × 8
  wave 3:  Chaser × 6, Swarm × 8
  wave 4:  Chaser × 8, Swarm × 12
  wave 5:  Chaser × 5, Swarm × 10, Tank × 1
  wave 6+: 공식 기반 자동 생성
    - chaserCount = 5 + wave * 2
    - swarmCount  = max(0, (wave - 2) * 4)
    - tankCount   = max(0, floor((wave - 4) / 2))

스폰 위치: 화면 가장자리 4면에서 랜덤
웨이브 간 쉬는 시간: 3초 (카운트다운 UI 표시)
```

### 4.5 점수 & 체인킬 시스템 (ScoreSystem.ts)

```
기본 점수:
  Chaser 격파: 100점
  Swarm 격파:  150점
  Tank 격파:   500점

체인킬 시스템:
  - 적 격파 시 chainTimer = 2.0초로 리셋
  - chainTimer가 0이 되기 전에 다음 적 격파 시 chainMultiplier += 1
  - chainTimer가 0이 되면 chainMultiplier = 1로 리셋
  - 획득 점수 = 기본점수 × chainMultiplier
  - 파티클 방출량 = baseParticles × min(chainMultiplier, 8)
  
  chainMultiplier 임계값 이펙트:
    × 3: "NICE!" 텍스트 표시
    × 5: "AWESOME!" + 약한 슬로모션 (0.5초간 timeScale 0.5)
    × 8: "INCREDIBLE!" + 강한 슬로모션 + 화면 전체 흰색 플래시
    ×10+: "UNSTOPPABLE!" + 화면 전체가 파티클로 뒤덮임
```

### 4.6 입력 시스템 (InputSystem.ts)

```
PC 입력:
  - KeyboardEvent로 WASD/Arrow 감지
  - MouseEvent로 마우스 위치 → 조준 방향 계산
  - mousedown/mouseup으로 발사 토글
  - 키 상태를 Map<string, boolean>으로 관리

모바일 입력:
  - TouchEvent 기반 가상 듀얼 조이스틱
  - 왼쪽 절반 터치: 이동 조이스틱 (터치 시작점 중심으로 드래그)
  - 오른쪽 절반 터치: 조준 조이스틱 (드래그 방향으로 조준, 터치 중 자동 발사)
  - 조이스틱 비주얼: 반투명 원형 UI (CSS overlay)

자동 감지:
  - 'ontouchstart' in window → 모바일 모드
  - else → PC 모드
```

### 4.7 게임 필(Game Feel) 이펙트

```
Screen Shake (화면 흔들림):
  - 적 격파 시 camera.position에 랜덤 오프셋 추가
  - intensity = 기본 3px, 체인킬 시 최대 15px
  - duration = 0.15초, 감쇠함수로 0으로 수렴
  - 구현: camera.position.x += (Math.random() - 0.5) * intensity * decay

Slow Motion (슬로모션):
  - 체인킬 ×5 이상일 때 0.3~0.5초간 gameSpeed를 0.3으로
  - 모든 update(dt)의 dt에 gameSpeed를 곱함
  - 부드럽게 복귀: lerp(gameSpeed, 1.0, 0.05)

Hit Flash (피격 플래시):
  - 적 피격 시 머티리얼을 0.05초간 흰색으로 변경 후 복원
```

---

## 5. 렌더링 설정

### 5.1 카메라
```
OrthographicCamera 사용 (2D 탑다운)
- 게임 영역: 1920 × 1080 유닛 (16:9 기준)
- 반응형: window.resize 시 aspect ratio 재계산
- 모바일에서는 게임 영역을 약간 좁혀서 보이는 범위 조정
```

### 5.2 렌더러 초기화
```typescript
// 의사 코드
async function initRenderer(canvas: HTMLCanvasElement) {
  if (navigator.gpu) {
    try {
      const renderer = new WebGPURenderer({ canvas, antialias: true });
      await renderer.init();
      return { renderer, tier: 'webgpu' };
    } catch (e) {
      console.warn('WebGPU init failed, fallback to WebGL2');
    }
  }
  return { 
    renderer: new WebGLRenderer({ canvas, antialias: true }), 
    tier: 'webgl2' 
  };
}
```

### 5.3 비주얼 스타일 — "Neon Geometry" (Geometry Wars 영감)

> **핵심 원칙**: 모든 엔티티는 코드로 생성하는 다중 레이어 와이어프레임. 텍스처/3D모델/외부 에셋 없음.
> UnrealBloomPass 후처리로 네온 글로우 효과. Additive Blending으로 겹칠수록 밝아짐.

#### 렌더링 전략
- `THREE.LineLoop` (1px 라인) + bloom → 두꺼운 네온 스트로크 효과
- 같은 셰이프를 3~4겹으로 렌더링: **코어 점 → 내부 프레임 → 외부 실루엣 → 글로우 셸**
- 모든 엔티티에 고유 미세 애니메이션 (회전, 맥동, 떨림) — 정적인 것 없음

#### 배경 (3 레이어)
```
Layer 1 — 동적 그리드 (z=-10):
  major: 200unit 간격, 시안 계열 (opacity 0.25)
  minor: 50unit 간격, 어두운 블루 (opacity 0.12)
  y축 스크롤 (20 units/s) + 플레이어 근접 시 고무판 왜곡 (반경 200, 최대 30px 밀림)
  폭발 시 충격파 왜곡 (추후 구현)

Layer 2 — 별 파티클 (z=-9):
  83개 (3가지 크기: 1.5/3/5px), 차가운 흰색~블루 계열
  사인파 twinkle (개별 phase + speed), 느린 대각선 드리프트

Layer 3 — 앰비언트 더스트 (z=-8):
  25개 희미한 큰 원형 (반지름 30~80, alpha 0.02~0.06)
  시안/보라, 플레이어 위치 기반 패럴랙스

배경색: #060a12 (짙은 네이비)
```

#### 엔티티 비주얼 (다중 레이어 네온 와이어프레임)
```
플레이어 — 시안 (#00ffff) 화살촉/쉐브론:
  10-vertex chevron, 코어(white dot) + 내부 프레임 + 외부(1.15x) + 글로우(1.3x)
  스러스터 화염: 꼬리 뒤 삼각형 (주황, 속도 비례 크기 + sin 깜빡임)
  엔진 트레일: 15포인트 Points + Line 연결선, quadratic 페이드아웃
  미세 떨림: 내부 프레임 꼭짓점 ±0.3px sin 오프셋
  부드러운 회전: lerpAngle (즉시 할당 아닌 보간)

총알 — 밝은 화이트옐로우 (#ffffcc) 타원:
  가로 긴 타원 (12×4px), 모션 트레일 5~8프레임
  글로우 (반지름 8px, alpha 0.2)
  발사 시 크기 2배→0.1초간 정상 수축 (팝)

적 Chaser — 레드 (#ff4444) 다이아몬드:
  4-vertex diamond, 상시 자체 회전 (초당 2~3 rad)
  플레이어 가까우면 회전 가속, 앞쪽 꼭짓점 1.1x stretch
  스폰 시 크기 0→목표 0.3초 팝업

적 Swarm — 그린 (#33ff88) 삼각형:
  3-vertex, 거리 60 이내 동료간 연결선 (alpha 0.08)
  개체별 sin 흔들림, 밀도 비례 글로우 증가
  이동 방향으로 rotation 정렬

적 Tank — 퍼플 (#bb55ff) 육각형:
  6-vertex, 내부 헥사(55%), 맥동 링 2개 (위상차 π)
  HP 비례 시각 상태 (100%→밝은 보라, 50%→붉은 시프트, 20%→떨림)
  격파 시 6방향 삼각형 파편 (보라→빨강 색상 변화 소멸)
```

#### 후처리 (PostProcessing)
```
EffectComposer → RenderPass → UnrealBloomPass → OutputPass
bloom: strength=1.5, radius=0.6, threshold=0.3
OutputPass 필수 (Three.js 0.150+에서 linear→sRGB 색공간 변환)
```

#### 킬 이펙트
```
1. 파티클 폭발 (GPU 파티클 시스템)
2. 원형 충격파 링 (0→100px, 0.3초, alpha 1→0)
3. 배경 그리드 왜곡 (충격파)
4. 근처 적/총알 시각적 밀림 (물리 아닌 오프셋)
5. 화면 밝기 0.02초간 5% 상승 후 복귀
```

---

## 6. UI 구조 (HTML Overlay)

UI는 Three.js 캔버스 위에 HTML/CSS로 오버레이. 게임 렌더링 성능에 영향 없음.

```html
<div id="game-container">
  <canvas id="game-canvas"></canvas>
  
  <!-- HUD (게임 중 항상 표시) -->
  <div id="hud">
    <div id="score">SCORE: 0</div>
    <div id="wave">WAVE 1</div>
    <div id="chain-display"><!-- 체인킬 배율 표시 --></div>
    <div id="hp-bar"><!-- 플레이어 HP 바 --></div>
    <div id="webgpu-badge">WebGPU ✓ | 50K particles</div>
  </div>

  <!-- 체인킬 텍스트 (팝업) -->
  <div id="chain-text" class="hidden">AWESOME!</div>
  
  <!-- 시작 화면 -->
  <div id="start-screen">
    <h1>PARTICLE SWARM</h1>
    <p>WebGPU Powered Shooting Game</p>
    <button id="start-btn">START</button>
    <p class="controls-hint">WASD + Mouse / Dual Stick</p>
  </div>

  <!-- 게임 오버 화면 -->
  <div id="gameover-screen" class="hidden">
    <h2>GAME OVER</h2>
    <div id="final-score"></div>
    <div id="final-wave"></div>
    <div id="max-chain"></div>
    <button id="retry-btn">RETRY</button>
  </div>

  <!-- 모바일 가상 조이스틱 (모바일에서만 표시) -->
  <div id="mobile-controls" class="hidden">
    <div id="joystick-left"></div>
    <div id="joystick-right"></div>
  </div>
</div>
```

---

## 7. 개발 계획

### Part 1 — Core

| Step | 작업 | 완료 기준 | 상태 |
|------|------|----------|------|
| **Step 1** | 프로젝트 셋업 (Vite + TS + Three.js), WebGPU/WebGL 분기 렌더러, 빈 씬 + OrthographicCamera | 검은 캔버스에 별 배경 렌더링 | ✅ 완료 |
| **Step 2** | Player 구현 (이동, 회전), InputSystem (PC 키보드+마우스) | WASD로 우주선 이동 가능 | ✅ 완료 |
| **Step 2.5** | **Neon Geometry 비주얼 전환** — 배경(그리드+별+더스트), 네온 와이어프레임 셰이프, UnrealBloomPass 후처리 | 네온 글로우 와이어프레임 렌더링, bloom 적용 | ✅ 완료 |
| **Step 3** | Bullet 시스템 (오브젝트 풀링), 기본 발사. 네온 타원 셰이프 + 모션 트레일 | 클릭으로 총알 발사, 화면 밖 나가면 풀에 반환 | ✅ 완료 |
| **Step 4** | Enemy 구현 (Chaser), WaveManager 기본, CollisionSystem | 적이 스폰되고, 총알에 맞으면 사라짐 | ✅ 완료 |
| **Step 5** | **파티클 시스템 구현** — CPU 물리 + Points ShaderMaterial + ParticleManager | 적 격파 시 파티클 폭발 작동 확인 | ✅ 완료 |
| **Step 6** | CPU 파티클 최적화 (Swap-and-Pop compaction + Adaptive scaling) | activeCount 감소 확인, emitScale 자동 조절 확인 | ✅ 완료 |
| **Step 7** | ScoreSystem, 체인킬 로직, 파티클 규모 스케일링 | 연속 킬 시 파티클 양 증가 확인 | ✅ 완료 |

### Part 2 — Polish & Mobile

| Step | 작업 | 완료 기준 | 상태 |
|------|------|----------|------|
| **Step 8** | Enemy 추가 종류 (Swarm, Tank), 웨이브 밸런스 | Wave 5까지 플레이 가능 | ✅ 완료 |
| **Step 9** | Game Feel — Screen Shake, SlowMotion, Hit Flash | 체인킬 ×5에서 슬로모션 + 화면 흔들림 작동 | ✅ 완료 |
| **Step 10** | 모바일 입력 (듀얼 조이스틱), 반응형 레이아웃 | 폰에서 조이스틱으로 플레이 가능 | ✅ 완료 |
| **Step 11** | UI 구현 — HUD, StartScreen, GameOverScreen | 완전한 게임 흐름 (시작→플레이→게임오버→재시작) | ✅ 완료 |
| **Step 12** | 사운드 효과, WebGPU 뱃지 표시, 파티클 카운터 UI | 폭발음, 발사음, 체인킬 사운드 | ✅ 완료 |
| **Step 13** | 밸런싱, 버그 픽스, 성능 최적화 (프로파일링) | 모바일에서 안정적 30fps 이상 | ⬜ |
| **Step 14** | 배포 (Vercel/GitHub Pages), README, 최종 테스트 | 공유 가능한 URL 완성 | ⬜ |

### 완료된 작업 상세 (새 세션 참고용)

<details>
<summary>Step 1 — 프로젝트 셋업 (완료)</summary>

- Vite + TypeScript + Three.js 0.183.2 프로젝트 초기화
- `DeviceDetect.ts`: WebGPU/WebGL2 자동 감지, 모바일 판별, 파티클 수 스케일링
- `Game.ts`: WebGLRenderer, OrthographicCamera (1920×1080 유닛)
- `main.ts`: 비동기 초기화 엔트리 포인트
- 생성 파일: `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.ts`, `src/game/Game.ts`, `src/utils/DeviceDetect.ts`
</details>

<details>
<summary>Step 2 — Player + InputSystem (완료)</summary>

- `InputSystem.ts`: WASD/Arrow 키보드 + 마우스 위치→월드좌표 변환, 좌클릭 발사 상태
- `Player.ts`: 이동 400 units/s, 월드 경계 클램핑, 마우스 방향 회전
- Game.ts에 통합: 매 프레임 `InputSystem.update()` → `Player.update(dt)`
- 생성 파일: `src/systems/InputSystem.ts`, `src/entities/Player.ts`
</details>

<details>
<summary>Step 2.5 — Neon Geometry 비주얼 전환 (완료)</summary>

**배경 (Phase 1)**:
- `NeonGrid.ts`: 동적 격자 (major 200u / minor 50u), y축 스크롤 20u/s, 플레이어 근접 고무판 왜곡
- `StarField.ts`: 83개 별 (3가지 크기 1.5/3/5px), 사인파 twinkle, 대각선 드리프트, vertexColors
- `AmbientDust.ts`: 25개 희미한 큰 원형, 시안/보라, 플레이어 패럴랙스
- 배경색 `#060a12`

**네온 엔티티 (Phase 2)**:
- `NeonShapes.ts`: 다중 레이어 팩토리 — `createNeonShape(vertices, color)` → Group (코어 Points + LineLoop×3)
  - `PLAYER_VERTICES`: 10-vertex chevron
  - `CHASER_VERTICES`, `SWARM_VERTICES`, `TANK_VERTICES` 상수 정의됨
  - `applyMicroVibration()`: 내부 프레임 sin 기반 ±0.3px 떨림
  - `createThrusterFlame()`: 꼬리 삼각형 화염 (LineLoop + ShapeGeometry, 주황)
- `Player.ts`: mesh 타입 THREE.Group, 스러스터(속도 비례+깜빡임), lerpAngle 부드러운 회전
- `EngineTrail.ts`: 15포인트 Points + Line 연결선, quadratic 페이드, AdditiveBlending
- `HitFlash.ts`: traverse로 Group 내 모든 Line/Mesh/Points 플래시 지원

**블룸 후처리 (Phase 3)**:
- `PostProcessing.ts`: EffectComposer → RenderPass → UnrealBloomPass(1.5, 0.6, 0.3) → OutputPass
- Game.ts에서 `renderer.render()` → `postProcessing.render()`로 교체

**비활성 파일** (삭제 안 함, 추후 정리):
- `src/utils/AssetLoader.ts`, `src/utils/SpriteFactory.ts`, `src/utils/sprites/*.ts` — 프로시저럴 스프라이트 방식 (Neon Geometry로 대체됨)
</details>

<details>
<summary>Step 3 — Bullet 시스템 (완료)</summary>

- `ObjectPool.ts`: 제네릭 오브젝트 풀 (`acquire()`/`release()`, 동적 확장)
- `NeonShapes.ts`에 `createBulletShape()` 추가: 16-segment 타원 (4×12 units), 채워진 glow body + 코어 dot + 와이어프레임 + 외부 glow shell, AdditiveBlending
- `Bullet.ts`: `BulletManager` 클래스 — 100개 풀링, 발사 쿨다운 0.12초, 속도 800 units/s
  - 발사 시 스폰 "pop" 효과 (scale 2→1, 0.1초)
  - 6프레임 모션 트레일 (Points + Line, quadratic alpha 페이드, white-yellow 색상)
  - 화면 밖 이탈 시 풀 반환
- Game.ts 통합: `inputSystem.state.firing` → `bulletManager.tryFire()` → `bulletManager.update(dt)`
- 생성 파일: `src/utils/ObjectPool.ts`, `src/entities/Bullet.ts`
</details>

<details>
<summary>Step 4 — Enemy (Chaser) + WaveManager + CollisionSystem (완료)</summary>

- `Enemy.ts`: `EnemyManager` 클래스 — 40개 풀링, Chaser AI (플레이어 직선 추적, 160 units/s)
  - 네온 다이아몬드 셰이프 (CHASER_VERTICES, 빨강 #ff4444)
  - 스폰 pop (scale 0→1, 0.3초, overshoot ease-out)
  - 상시 자체 회전 (2~3 rad/s), 근접 시 회전 가속 + 전방 꼭짓점 stretch
  - applyMicroVibration 적용
  - `spawnChaser(x, y)`, `kill(enemy)`, `activeEnemies` getter
- `WaveManager.ts`: Wave 1~5 사전 정의, Wave 6+ 공식 기반 자동 생성
  - 웨이브 간 3초 휴식 (첫 웨이브 1.5초 딜레이)
  - 적 stagger 스폰 (~2초에 걸쳐 순차 스폰)
  - 화면 가장자리 4면에서 랜덤 스폰 (60unit 마진)
  - 모든 적 스폰 완료 + 모든 적 사망 → 다음 웨이브 전환
- `CollisionSystem.ts`: 원-원 충돌 감지
  - Bullet↔Enemy: 총알 반지름 8 + 적 반지름, 히트 시 HP 감소, HP 0이면 kill
  - Enemy↔Player: 플레이어 반지름 16 (비주얼보다 작게 — 관대한 판정)
  - `CollisionEvent` 배열 반환 (type, position, enemyType)
- Game.ts 통합: WaveManager → EnemyManager → CollisionSystem 순서로 매 프레임 업데이트
- 생성 파일: `src/entities/Enemy.ts`, `src/game/WaveManager.ts`, `src/systems/CollisionSystem.ts`
</details>

<details>
<summary>Step 5 — 파티클 시스템 구현 (완료)</summary>

- `CPUParticleSystem.ts`: 고성능 CPU 파티클 시스템
  - SoA(Structure of Arrays) 레이아웃 — 캐시 친화적 Float32Array 10개 (posX/Y, velX/Y, life, maxLife, baseR/G/B, baseSize)
  - Custom ShaderMaterial — 정점 셰이더에서 per-particle size(`aSize`), 프래그먼트 셰이더에서 soft circle + life discard
  - THREE.Points 단일 draw call로 최대 50,000개 파티클 렌더링
  - 물리: 프레임독립 damping(0.97^60dt), 미약 중력(30u/s²), 수명 감소
  - 색상 전이: baseColor → 어두운 빨강, green/blue 빠르게 페이드, alpha 이차함수 감쇠
  - ring-buffer emit cursor로 죽은 파티클 효율적 재활용
  - AdditiveBlending + depthWrite:false → bloom과 결합 시 빛나는 폭발 효과
- `ParticleManager.ts`: 적 종류별 색상 프리셋 + 체인킬 스케일링 준비
  - Chaser: 주황-빨강, 150개 / Swarm: 초록-시안, 120개 / Tank: 보라-마젠타, 400개
  - `emitExplosion(x, y, enemyType, chainMultiplier)`: 종류별 색상/속도/크기 자동 적용
  - chainMultiplier로 파티클 수 최대 8배 스케일 (2000개 캡)
- Game.ts 통합: CollisionSystem 이벤트 → `emitExplosion()` (bullet_enemy) / `emit()` (enemy_player)
- 생성 파일: `src/particles/CPUParticleSystem.ts`, `src/particles/ParticleManager.ts`
</details>

<details>
<summary>Step 6 — CPU 파티클 최적화 (완료)</summary>

**Swap-and-Pop Compaction** (`CPUParticleSystem.ts` 리팩토링):
- 활성 파티클을 `[0..activeCount)` 구간에 연속 압축 (기존 ring-buffer 대체)
- `emit()`: activeCount 뒤에 O(1) 추가
- `update()`: 죽은 파티클을 마지막 활성과 swap → O(active) 처리 (O(max) 아님)
- `setDrawRange(0, activeCount)`: GPU가 활성 파티클만 렌더링
- `updateRange` 설정으로 GPU 버퍼 업로드도 활성 구간만 전송
- `swapParticles()`: SoA 10개 배열 전체 swap

**Adaptive Performance Scaling** (`ParticleManager.ts`):
- 30-프레임 샘플 윈도우에서 90th percentile 프레임 시간 측정
- `BUDGET_TARGET_MS=16` (60fps), `BUDGET_CRITICAL_MS=28` (~35fps)
- `emitScale` 범위 0.25~1.0:
  - p90 > 28ms → -0.03 (빠른 감소)
  - p90 > 16ms → -0.005 (완만한 감소)
  - p90 < 12.8ms → +0.01 (점진적 회복)
- `emitExplosion()`과 `emit()` 모두 emitScale 적용

**검증 결과**:
- Compaction: 1760 → 1625 → 954 → 263 → 0 (2초간 정상 감소)
- Slow frames (35ms): emitScale 1.0 → 0.25 (최소치까지 감소)
- Fast frames (10ms): emitScale 0.25 → 0.58+ (점진적 회복)
- 수정 파일: `src/particles/CPUParticleSystem.ts`, `src/particles/ParticleManager.ts`
</details>

<details>
<summary>Step 7 — ScoreSystem + 체인킬 + HUD (완료)</summary>

- `ScoreSystem.ts`: 점수 추적 + 체인킬 로직
  - 적 종류별 기본 점수: Chaser 100, Swarm 150, Tank 500
  - `registerKill(enemyType)`: chainTimer > 0이면 chainMultiplier++, 아니면 1로 리셋
  - chainTimer = 2초 윈도우, `update(dt)`에서 감소
  - 체인 임계값 이벤트: ×3 NICE!, ×5 AWESOME!, ×8 INCREDIBLE!, ×10+ UNSTOPPABLE!
  - `consumeChainEvent()`: HUD에서 1회 소비하는 이벤트 패턴
  - `chainProgress` (0–1): HUD 콤보 바 표시용
  - `reset()`: 게임 재시작용
- `HUD.ts`: HTML 오버레이 (pointer-events: none)
  - 좌상단: SCORE (28px, 시안 글로우) + WAVE 번호
  - 우상단: 체인 배율 (×N, 임계값별 색상 변화) + 체인 타이머 바
  - 중앙: 체인 임계값 텍스트 팝업 (1.2초 표시, scale + fade 애니메이션)
  - CSS transition으로 부드러운 색상/크기 전환
- `Game.ts` 통합:
  - 충돌 시 `scoreSystem.registerKill()` → `chainMultiplier`를 `emitExplosion()`에 전달
  - 매 프레임 `scoreSystem.update(dt)` + `hud.update(dt, scoreSystem)`
  - debugInfo에 score, chain, maxChain 추가
- 생성 파일: `src/systems/ScoreSystem.ts`, `src/ui/HUD.ts`
- 수정 파일: `src/game/Game.ts`
</details>

<details>
<summary>Step 8 — Enemy 추가 종류 (Swarm, Tank) + 웨이브 밸런스 (완료)</summary>

**EnemyManager 리팩토링** (`Enemy.ts` 전면 재작성):
- 타입별 분리 풀: `chaserPool`(40), `swarmPool`(40), `tankPool`(10) — 각각 고유 네온 셰이프
- `EnemyData`에 `maxHp` 필드 추가 (Tank HP 비율 계산용)
- `spawnEnemy()` 통합 스폰 + `spawnChaser/spawnSwarm/spawnTank` 퍼사드

**Chaser AI** (기존 유지):
- 플레이어 직선 추적 160u/s, 근접 시 회전 가속 + 전방 stretch

**Swarm AI** (새로 추가 — 간소화된 Boid):
- 4가지 힘: separation(1.5) + alignment(1.0) + cohesion(1.0) + chase(2.0)
- 이웃 판정 60u 이내, 부드러운 velocity 보간 (lerp 3.0×dt)
- 이동 방향으로 `lerpAngle` 회전 정렬
- **연결선**: 근접 Swarm 간 LineSegments (alpha 0.08, AdditiveBlending), 최대 200쌍
- 속도 130u/s, HP 1, 반지름 12

**Tank AI** (새로 추가):
- 느린 추적 48u/s, HP 5, 반지름 28
- **장식**: 내부 헥사곤(55%) + 2개 펄싱 링 (위상차 π, sin 기반 scale)
- **HP 비례 시각**: 100%→보라, 50%→붉은 시프트, 20%→빨강+떨림
- `updateTankVisuals()`: inner frame 색상 lerp

**WaveManager 업데이트** (`WaveManager.ts` 재작성):
- `WaveDefinition`에 `swarmCount`, `tankCount` 추가
- Wave 1~5 사전 정의 (Wave 3: Swarm 도입, Wave 5: Tank 도입)
- Wave 6+: `chaserCount=5+wave*2`, `swarmCount=max(0,(wave-2)*4)`, `tankCount=max(0,floor((wave-4)/2))`
- 스폰 큐: 모든 적을 Fisher-Yates 셔플 후 순차 스폰 (타입 혼합)

- 수정 파일: `src/entities/Enemy.ts`, `src/game/WaveManager.ts`
</details>

<details>
<summary>Step 9 — Game Feel: Screen Shake, SlowMotion, Hit Flash (완료)</summary>

**ScreenShake** (`src/effects/ScreenShake.ts` 신규):
- 카메라 오프셋 기반 화면 흔들림
- `trigger(intensity, duration)`: 강도+지속시간 지정, 스태킹 지원 (더 큰 값 우선)
- 지수 감쇠 (exponential decay)로 자연스러운 감쇄
- 적 킬: baseShake 4 (Tank: 12) + chain×1.5 스케일링
- 플레이어 피격: 강한 흔들림 (intensity 20, 0.4초)

**SlowMotion** (`src/effects/SlowMotion.ts` 신규):
- `trigger(timeScale, duration)`: 시간 스케일 0~1, 실시간 기준 지속시간
- smoothstep 보간으로 자연스럽게 원래 속도로 복귀
- 체인킬 단계별 슬로모션:
  - ×3: 50% 속도, 0.4초
  - ×5: 30% 속도, 0.6초
  - ×8: 20% 속도, 0.7초
  - ×10+: 15% 속도, 0.8초
- 플레이어 피격: 20% 속도, 0.5초

**HitFlash** (기존 — Step 2.5에서 구현 완료):
- Group traverse 기반 머티리얼 교체 플래시

**Game.ts 통합**:
- `rawDt` → `slowMotion.apply(rawDt)` → `dt`로 전체 게임 로직에 슬로모션 적용
- `screenShake.update(rawDt)`: 렌더 직전 카메라 오프셋 (rawDt 사용 — 흔들림은 실시간)
- 충돌 반응에서 체인 배율에 따라 자동 트리거

- 신규 파일: `src/effects/ScreenShake.ts`, `src/effects/SlowMotion.ts`
- 수정 파일: `src/game/Game.ts`
</details>

<details>
<summary>Step 10 — 모바일 입력 (듀얼 조이스틱) + 반응형 레이아웃 (완료)</summary>

**MobileControls** (`src/ui/MobileControls.ts` 신규):
- 터치 오버레이: canvas 위에 절대 위치 div, `touch-action: none`
- 듀얼 조이스틱: 왼쪽 절반=이동, 오른쪽 절반=조준+자동발사
- 터치 시작 위치에 조이스틱 출현, 릴리스 시 사라짐
- 비주얼: 반투명 원형 base (60px) + 컬러 knob (24px, 시안/빨강)
- 최대 드래그 50px, 넘어가면 클램핑 + 정규화
- 멀티터치 식별자 기반 독립 추적

**InputSystem 업데이트** (`src/systems/InputSystem.ts` 재작성):
- `isMobile()` 감지 → PC/모바일 분기
- PC: 기존 키보드+마우스 그대로
- 모바일: `MobileControls`에서 `moveStick`/`aimStick` 읽어 `InputState`로 변환
  - 에임 조이스틱 방향 → 플레이어 위치 기준 400u 앞 월드 좌표로 변환
  - 에임 스틱 활성 시 자동 발사 (`firing = aimStick.active`)
  - 마지막 에임 방향 유지 (릴리스 후에도 기존 방향 유지)
- `update(playerX, playerY)`: 모바일 에임 변환용 플레이어 위치 전달

**Game.ts 수정**:
- `inputSystem.update()` → `inputSystem.update(player.position.x, player.position.y)`

- 신규 파일: `src/ui/MobileControls.ts`
- 수정 파일: `src/systems/InputSystem.ts`, `src/game/Game.ts`
</details>

<details>
<summary>Step 11 — UI 구현: HUD, StartScreen, GameOverScreen + 게임 흐름 (완료)</summary>

**GameState** (`src/game/GameState.ts` 신규):
- `State` = `'MENU' | 'PLAYING' | 'GAMEOVER'`
- `transition(to)` + `onTransition` 콜백
- 편의 getter: `isMenu`, `isPlaying`, `isGameOver`

**Player HP** (`src/entities/Player.ts` 수정):
- `MAX_HP = 5`, `takeDamage(amount)` → 피격 시 1초 무적
- 무적 중 10Hz 깜빡임 (mesh.visible 토글)
- `reset()`: HP/위치/회전 초기화

**StartScreen** (`src/ui/StartScreen.ts` 신규):
- 반투명 오버레이 + "PARTICLE SWARM / SHOOTER" 네온 타이틀
- "CLICK OR TAP TO START" 펄스 애니메이션
- 조작법 안내 (모바일에서 숨김)
- 클릭/터치 → `onStart` 콜백 → fade out

**GameOverScreen** (`src/ui/GameOverScreen.ts` 신규):
- 빨간 "GAME OVER" 타이틀 + 최종 점수/웨이브/최고 체인 표시
- "CLICK OR TAP TO RESTART" → `onRestart` 콜백

**HUD 업데이트** (`src/ui/HUD.ts` 수정):
- HP 바 추가 (160px, 색상 그라데이션: 초록→노랑→빨강)
- `show()/hide()` 메서드 (상태 전환 시 사용)
- `updateHP(hp, maxHp)` 메서드

**Game.ts 리팩토링** (`src/game/Game.ts` 수정):
- `startPlaying()`: 모든 시스템 reset → PLAYING 전환
- `onGameOver()`: 1.2초 딜레이 후 게임오버 화면 표시 (죽음 이펙트 보여줌)
- 루프 분리: 배경/파티클/이펙트는 항상 업데이트, 게임 로직은 PLAYING에서만
- 플레이어 HP 0 → 대형 시안 파티클 폭발 + 강한 흔들림 + 극한 슬로모

**reset 메서드 추가**:
- `BulletManager.reset()`, `EnemyManager.reset()`, `WaveManager.reset()`

- 신규 파일: `src/game/GameState.ts`, `src/ui/StartScreen.ts`, `src/ui/GameOverScreen.ts`
- 수정 파일: `src/entities/Player.ts`, `src/ui/HUD.ts`, `src/game/Game.ts`, `src/entities/Bullet.ts`, `src/entities/Enemy.ts`, `src/game/WaveManager.ts`
</details>

<details>
<summary>Step 12 — 사운드 효과, WebGPU 뱃지, 파티클 카운터 (완료)</summary>

**SoundManager** (`src/systems/SoundManager.ts` 신규):
- Web Audio API 기반 프로시저럴 사운드 (외부 오디오 파일 불필요)
- 싱글톤 패턴, lazy AudioContext 생성 (유저 제스처 후 resume)
- 사운드 목록:
  - `fire()`: 총알 발사 — square wave 880→220Hz 피치 다운 (0.08초)
  - `explosion(intensity)`: 적 폭발 — 노이즈 버스트 + 저음 thud, 체인에 비례 강도
  - `tankExplosion()`: 탱크 폭발 — 강화 폭발 + 서브베이스 럼블 (0.5초)
  - `hit()`: 비치명 피격 — triangle wave 핑 (0.06초)
  - `chainMilestone(level)`: 체인 마일스톤 — 상승 코드 아르페지오 (nice: 2음, awesome: 3음, incredible: 4음, unstoppable: 4음 고음)
  - `playerHit()`: 플레이어 피격 — sawtooth 디스토션 버즈 (0.25초)
  - `playerDeath()`: 플레이어 사망 — 하강 sawtooth + 노이즈 스윕 (1.0초)
  - `waveBurst()`: 웨이브 전환 버스트 — sine sweep 200→1200→100Hz
  - `waveAnnounce()`: 웨이브 알림 — 3음 square wave 팡파레
- 마스터 볼륨 0.35, 뮤트 토글 지원

**HUD 업데이트** (`src/ui/HUD.ts` 수정):
- 좌하단: WebGPU 뱃지 ("WebGPU ✓ | 50K particles" 또는 "WebGL2 ⚠ | 5K particles")
  - WebGPU: 시안 (#00ffcc), WebGL2: 주황 (#ffaa44)
- 좌하단: 실시간 파티클 카운터 ("Particles: 1234")
- 우하단: 뮤트 토글 버튼 (♪)
- `setBadge(tier, maxParticles)`, `updateParticleCount(active)` 메서드

**Game.ts 통합** (`src/game/Game.ts` 수정):
- `startPlaying()`: `SoundManager.resume()` 호출
- 총알 발사 시 `SoundManager.fire()`
- 적 킬 시 `SoundManager.explosion()` / `SoundManager.tankExplosion()`
- 비치명 피격 시 `SoundManager.hit()`
- 플레이어 피격/사망 시 `SoundManager.playerHit()` / `SoundManager.playerDeath()`
- 웨이브 전환 시 `SoundManager.waveBurst()` / `SoundManager.waveAnnounce()`
- 매 프레임 `hud.updateParticleCount()` 호출

**Bullet.ts 수정**: `tryFire()` 반환 타입 `void` → `boolean` (발사 성공 여부)

- 신규 파일: `src/systems/SoundManager.ts`
- 수정 파일: `src/ui/HUD.ts`, `src/game/Game.ts`, `src/entities/Bullet.ts`
</details>

---

## 8. 성능 목표

| 환경 | 파티클 수 | 목표 FPS | 렌더러 |
|------|----------|----------|--------|
| PC (WebGPU) | 50,000 | 60fps | WebGPURenderer |
| PC (WebGL2 폴백) | 5,000 | 60fps | WebGLRenderer |
| 최신 모바일 (WebGPU) | 30,000 | 30fps+ | WebGPURenderer |
| 구형 모바일 (WebGL2) | 3,000 | 30fps+ | WebGLRenderer |

### 성능 최적화 원칙
- 오브젝트 풀링: Bullet, Enemy, Particle 전부 풀링 (GC 방지)
- InstancedMesh: 동종 오브젝트는 단일 draw call로 렌더링
- Compute Shader dispatch: workgroup_size(256), 파티클 50,000개 → 196 workgroups
- 프레임 budget 모니터링: `performance.now()` 기반 dt 체크, 과부하 시 파티클 수 자동 감소

---

## 9. 핵심 구현 가이드

### 9.1 Three.js WebGPU 셋업 패턴
```typescript
// Three.js WebGPU import 패턴 (r171+)
import * as THREE from 'three/webgpu';
// 이 import만으로 WebGPURenderer, TSL 등이 포함됨
// WebGL 폴백 시에는 'three'에서 WebGLRenderer를 import

// Compute Shader는 TSL(Three Shader Language)로 작성하거나
// 직접 WGSL 문자열을 사용할 수 있음
```

### 9.2 파티클 Compute Shader 핵심 패턴
```typescript
// StorageBufferAttribute로 파티클 데이터를 GPU에 올림
// compute() 함수를 매 프레임 dispatch하여 업데이트
// InstancedMesh의 instanceMatrix를 compute 결과로 갱신
```

### 9.3 모바일 조이스틱 핵심
```
터치 시작 → 시작 좌표 저장 (조이스틱 중심)
터치 이동 → (현재좌표 - 시작좌표) / maxRadius → 정규화된 방향벡터
터치 종료 → 방향벡터 (0, 0)으로 리셋
시각적 피드백: CSS로 조이스틱 원 표시 (position: absolute)
```

---

## 10. 배포 체크리스트

- [ ] HTTPS 필수 (WebGPU는 Secure Context에서만 작동)
- [ ] `<meta name="viewport">` 설정 (모바일 줌 방지)
- [ ] touch-action: none (캔버스에서 브라우저 기본 터치 동작 차단)
- [ ] WebGPU 미지원 시 안내 메시지 표시 (게임은 WebGL2로 계속 실행)
- [ ] OG 태그 설정 (공유 시 미리보기)
- [ ] favicon 설정

---

## 11. 공모전 발표 포인트

> **한 줄 어필**: "같은 게임을 PC에서 열면 파티클 5만 개, 폰에서 열면 자동으로 스케일 다운. WebGPU Progressive Enhancement를 적용했습니다."

**시연 순서 추천**:
1. PC 브라우저에서 게임 실행 → 체인킬로 대규모 파티클 폭발 시연
2. HUD의 "WebGPU ✓ | 50K particles" 뱃지 보여주기
3. 같은 URL을 폰에서 열기 → 자동 폴백으로 정상 작동 확인
4. 기술 설명: "WebGPU Compute Shader가 50,000개 파티클의 위치/속도/수명을 매 프레임 GPU에서 병렬 계산합니다. WebGL에서는 불가능한 규모입니다."
