import { REGISTER_SIZE, DEFAULT_TAPS } from "./constants.js";

// Оставляет во входной строке только символы 0 и 1.
export function sanitizeBitString(value) {
  return (value || "").replace(/[^01]/g, "");
}

// Приводит seed к длине регистра: обрезает лишнее и дополняет нулями справа.
export function normalizeSeed(rawSeed) {
  const filtered = sanitizeBitString(rawSeed).slice(0, REGISTER_SIZE);
  if (filtered.length === REGISTER_SIZE) return filtered;
  return filtered.padEnd(REGISTER_SIZE, "0");
}

// Парсит список степеней многочлена; при некорректном вводе возвращает вариант по умолчанию.
export function parseTaps(tapsText) {
  const numbers = String(tapsText)
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= REGISTER_SIZE);

  if (numbers.length < 2 || !numbers.includes(REGISTER_SIZE) || !numbers.includes(0)) {
    return [...DEFAULT_TAPS];
  }

  return [...new Set(numbers)].sort((a, b) => b - a);
}

// Создает LFSR-генератор, который выдает по одному биту ключевого потока.
export function createLfsr(seedBits, tapsDegrees) {
  const seed = normalizeSeed(seedBits);
  let reg = seed.split("").map((ch) => Number(ch));
  const tapIndices = tapsDegrees
    .filter((d) => d !== REGISTER_SIZE)
    .map((d) => REGISTER_SIZE - 1 - d);

  if (reg.every((bit) => bit === 0)) {
    throw new Error("Начальное состояние из одних нулей недопустимо для LFSR.");
  }

  return {
    nextBit() {
      const outBit = reg[REGISTER_SIZE - 1];
      let feedback = 0;

      for (const idx of tapIndices) {
        feedback ^= reg[idx];
      }

      for (let i = REGISTER_SIZE - 1; i > 0; i -= 1) {
        reg[i] = reg[i - 1];
      }
      reg[0] = feedback;

      return outBit;
    },
  };
}

// Генерирует ключевой поток заданной длины в битах.
export function buildKeyStreamBits(seedBits, tapsDegrees, bitLength) {
  const lfsr = createLfsr(seedBits, tapsDegrees);
  const bits = new Uint8Array(bitLength);
  for (let i = 0; i < bitLength; i += 1) {
    bits[i] = lfsr.nextBit();
  }
  return bits;
}
