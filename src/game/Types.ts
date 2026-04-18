// Core type definitions for the backgammon game
// Board convention: index 0 = white bar, 25 = black bar, 1-24 = points
// WHITE moves from 24 -> 1 (bears off at < 1, i.e., off the board)
// BLACK moves from 1 -> 24 (bears off at > 24, i.e., off the board)

export type Player = 'white' | 'black';
export type GamePhase =
  | 'rollingForFirst'
  | 'waitingForRoll'
  | 'playerActing'
  | 'aiThinking'
  | 'playerDecidingDouble'  // player responding to AI's double offer
  | 'gameOver';

// How decisive the win was
export type WinType = 'single' | 'gammon' | 'backgammon';

// The doubling cube; owner = null means centered (either player may double)
export interface DoublingCube {
  value: number;        // 1, 2, 4, 8, 16, 32, 64
  owner: Player | null; // who owns the cube (may double next)
}

// Persistent match score across individual games
export interface MatchState {
  targetScore: number;
  whiteScore: number;
  blackScore: number;
  isCrawford: boolean;    // current game is the Crawford game
  postCrawford: boolean;  // the Crawford game has already been played
  matchOver: boolean;
  matchWinner: Player | null;
}

export interface Point {
  owner: Player | null;
  count: number;
}

export interface DiceState {
  values: [number, number];  // original roll
  remaining: number[];       // dice values still available to use (4 entries for doubles)
}

// A single sub-move within a turn
// from: 0 = white bar, 25 = black bar, 1-24 = board point, -1 = unused
// to: 1-24 = board point, -1 = bear off (white bears off to <1, black to >24)
export interface Move {
  from: number;
  to: number;
  dieUsed: number;
  isHit: boolean;
}

// A complete turn sequence (may be 1, 2, or 4 sub-moves)
export type MoveSequence = Move[];

export interface GameState {
  board: Point[];            // indices 0-25; 0=white bar, 25=black bar, 1-24=points
  whiteBorneOff: number;
  blackBorneOff: number;
  currentPlayer: Player;
  dice: DiceState | null;
  phase: GamePhase;
  selectedPoint: number | null;  // currently selected source point (or bar index)
  validMoves: Move[];            // valid next sub-moves from selectedPoint
  // All legal move sequences for current state (used to enforce dice usage rules)
  legalSequences: MoveSequence[];
  winner: Player | null;
  winType: WinType | null;
  lastSaveTime: number | null;
  errorMessage: string | null;
  // Initial roll to determine first player (only set during rollingForFirst phase)
  initialRoll: { white: number; black: number } | null;
  // Doubling cube
  cube: DoublingCube;
  // Match state (persists across games in the same match)
  match: MatchState;
}

// Serialized save format
export interface SaveData {
  schemaVersion: number;
  appVersion: string;
  timestamp: number;
  gameState: SerializedGameState;
}

// Serialized game state (subset of GameState that can be stored)
export interface SerializedGameState {
  board: Array<{ owner: Player | null; count: number }>;
  whiteBorneOff: number;
  blackBorneOff: number;
  currentPlayer: Player;
  dice: {
    values: [number, number];
    remaining: number[];
  } | null;
  phase: GamePhase;
  winner: Player | null;
  winType: WinType | null;
  cube: DoublingCube;
  match: MatchState;
}
