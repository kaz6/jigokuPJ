// シードを固定できる乱数（mulberry32）。DOM に触れない。
// 強制判決のランダム送りだけに使う。同じシードなら同じ並びになる。

export function normalizeSeed(seed) {
  const n = Number(seed);
  return Number.isFinite(n) ? (Math.trunc(n) >>> 0) : 0;
}

export function createRng(seed) {
  let a = normalizeSeed(seed);
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    // 0 以上 n 未満の整数
    int: (n) => Math.floor(next() * n),
    pick: (list) => list[Math.floor(next() * list.length)],
  };
}
