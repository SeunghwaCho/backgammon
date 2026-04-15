// Random utilities for dice rolling
// Roll a single standard 6-sided die
export function rollDie() {
    return Math.floor(Math.random() * 6) + 1;
}
// Roll two dice
export function rollTwoDice() {
    return [rollDie(), rollDie()];
}
// Seeded random number generator (Mulberry32)
// Useful for reproducible testing
export function createSeededRandom(seed) {
    let s = seed >>> 0;
    return function () {
        s |= 0;
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
// Roll a single die using a seeded generator
export function rollDieSeeded(rng) {
    return Math.floor(rng() * 6) + 1;
}
//# sourceMappingURL=random.js.map