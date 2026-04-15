// Core type definitions for the backgammon game
// Board convention: index 0 = white bar, 25 = black bar, 1-24 = points
// WHITE moves from 24 -> 1 (bears off at < 1, i.e., off the board)
// BLACK moves from 1 -> 24 (bears off at > 24, i.e., off the board)

export type Player = 'white' | 'black';
export type GamePhase = 'waitingForRoll' | 'playerActing' | 'aiThinking' | 'gameOver';

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
  lastSaveTime: number | null;
  errorMessage: string | null;
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
}
