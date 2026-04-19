# Backgammon

A fully playable single-player backgammon game (Human vs AI) built with TypeScript, HTML5 Canvas, and IndexedDB. No external libraries or frameworks used.

## Features

- Complete backgammon rules: hit/bar/re-entry, bearing off, doubles (4 moves), higher-die rule
- AI opponent with heuristic scoring
- IndexedDB-based save/restore (auto-save after each move)
- Responsive layout: landscape for wide screens, portrait for narrow screens (Galaxy Fold 7 support)
- Touch support for mobile/tablet
- Robust error handling and recovery

## Architecture Diagrams

### Module Architecture
![Module Architecture](docs/uml/architecture.png)

### Core Type Diagram
![Core Type Diagram](docs/uml/classes.png)

### Game Phase State Machine
![Game Phase State Machine](docs/uml/state.png)

### Player Turn Sequence
![Player Turn Sequence](docs/uml/sequence.png)

---

## Project Structure

```
backgammon/
├── index.html              # Entry HTML
├── style.css               # Minimal CSS (no framework)
├── tsconfig.json           # TypeScript config
├── README.md               # This file
└── src/
    ├── main.ts             # App entry point
    ├── game/
    │   ├── Types.ts        # Core type definitions
    │   ├── GameState.ts    # Initial state, cloning utilities
    │   ├── Rules.ts        # Move validity, bear-off rules
    │   ├── MoveGenerator.ts # Complete legal sequence generation
    │   └── Reducer.ts      # Pure state transformation functions
    ├── ai/
    │   └── BackgammonAI.ts # Heuristic AI opponent
    ├── render/
    │   └── CanvasRenderer.ts # Canvas 2D rendering (responsive)
    ├── input/
    │   └── InputController.ts # Mouse + touch input handling
    ├── persistence/
    │   ├── IndexedDbStore.ts  # IndexedDB save/load/delete
    │   └── SaveValidation.ts  # Save data schema validation
    ├── ui/
    │   └── HUD.ts          # On-canvas buttons and overlays
    └── utils/
        └── random.ts       # Dice rolling utilities
```

## Building

### Requirements

- Node.js with TypeScript (`npm install -g typescript`)

### Compile

```bash
cd /path/to/backgammon
tsc
```

This compiles all TypeScript files in `src/` to JavaScript in `dist/`.

### Run

Serve the project root with any static server:

```bash
# Using Python
python3 -m http.server 8080

# Using Node.js http-server
npx http-server . -p 8080

# Using VS Code Live Server extension
# Right-click index.html → "Open with Live Server"
```

Then open `http://localhost:8080` in your browser.

## How to Play

1. The game starts with White's (your) turn
2. Click **ROLL** to roll dice
3. Click a white checker to select it (valid moves will highlight)
4. Click a highlighted destination to move
5. If you have a checker on the bar, you must re-enter it first
6. Bear off your checkers when all 15 are in your home board (points 1-6)
7. First player to bear off all 15 checkers wins

## Controls

- **ROLL** button: Roll dice (your turn)
- **New Game**: Start a fresh game (discards current progress)
- **Clear Save**: Delete saved game from IndexedDB

## Rules Implemented

- Standard 24-point board
- Both dice must be used if possible
- Higher die must be used when only one die can be played
- Doubles = 4 moves with the same value
- Blot hitting (opponent's single checker goes to bar)
- Bar re-entry: must re-enter before any other move
- Bearing off: all checkers must be in home board; exact die or higher allowed when no checkers above
- Pass turn when no legal moves exist

## Responsive Layout

- **Width ≥ 600px**: Standard landscape backgammon board layout
  - Points 13-24 on top, 1-12 on bottom
  - White bears off on the left, Black on the right
- **Width < 600px**: Portrait mode for Galaxy Fold 7 folded screen
  - Points 13-24 on top half, 1-12 on bottom half
  - Layout scales to fit narrow screens

The canvas automatically resizes when the Galaxy Fold 7 is folded/unfolded using `ResizeObserver`.

## Save/Restore

- Game state is automatically saved to **IndexedDB** after each action
- On next page load, you'll be prompted to continue or start a new game
- Save data includes schema version for forward compatibility
- Corrupt or invalid save data is safely discarded (app falls back to new game)

## AI 전략 (한국어)

AI는 **모든 합법적 이동 시퀀스를 열거한 뒤 휴리스틱 점수로 최선의 수를 선택**하는 방식으로 동작합니다.  
완벽한 수읽기(Monte Carlo / 신경망)가 아닌, 빠르고 이해하기 쉬운 **가중 평가 함수** 기반입니다.

### 의사결정 흐름

![AI 전략 다이어그램](docs/uml/ai_strategy.png)

### 평가 함수 항목

| 항목 | 가중치 | 설명 |
|------|--------|------|
| **Bear-off 진척도** | +10 (내) / -10 (상대) | 말을 많이 꺼낼수록 우세 |
| **Pip count 차이** | ×0.3 | 이동 총거리가 짧을수록 유리 |
| **내 Blot (단독 말)** | -2 | 잡힐 위험이 있는 내 말은 감점 |
| **상대 Blot** | +1.5 | 상대 취약 말이 많을수록 가산 |
| **내 안전 포인트** | +1.5 | 2개 이상 쌓인 내 포인트는 안전 |
| **홈보드 말 수** | +0.5 | 홈보드(1-6번)에 말이 많을수록 유리 |
| **내 Bar 말** | -8 | 잡혀서 Bar에 있는 말은 크게 감점 |
| **상대 Bar 말** | +5 | 상대가 Bar에 있으면 가산 |
| **프라임 블로킹** | +2 | 홈보드에 2개 이상 쌓인 포인트마다 추가 가산 |
| **랜덤 노이즈** | ±0.01 | 동점 시 동일 수 반복 방지 |

### 세부 전략 원칙

1. **Bar 재진입 우선** — Bar에 말이 있으면 반드시 먼저 재진입합니다.
2. **Blot 히트 선호** — 상대 단독 말(Blot)을 잡을 수 있으면 적극 노립니다.
3. **Blot 노출 최소화** — 자신의 말이 단독으로 남지 않도록 안전한 이동을 선호합니다.
4. **프라임 형성** — 홈보드에 연속으로 포인트(블록)를 만들어 상대 이동을 방해합니다.
5. **Bear-off 우선** — 후반에는 말을 최대한 빠르게 꺼내는 방향으로 점수를 높게 부여합니다.
6. **합법 수 보장** — MoveGenerator가 생성한 시퀀스만 사용하므로 규칙 위반이 원천 차단됩니다.

### AI 턴 실행 흐름

```
주사위 굴리기 (400ms 딜레이)
  └→ 합법 시퀀스 전체 열거 (MoveGenerator)
       └→ 각 시퀀스 시뮬레이션 → 점수 계산
            └→ 최고 점수 시퀀스 선택
                 └→ 이동마다 500ms 딜레이로 순차 실행
```

---

## Known Limitations

- No doubling cube
- No match scoring (gammon/backgammon)
- No undo feature
- AI uses heuristic scoring (not Monte Carlo or neural network)
- No sound effects or animations (checkers move instantly)
