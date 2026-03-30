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

//   idx = REGISTER_SIZE - d
//   степень 37 - idx = 0
//   степень 12 - idx = 25
//   степень 10 - idx = 27
//   степень  2 - idx = 35
//   степень  0 - idx = 37 (свободный член; означает что выходной бит reg[0]

//   outBit   = reg[0]                        (MSB выходит)
//   feedback = XOR всех отводов
//   reg[0..35] = reg[1..36]                 (сдвиг)
//   reg[36]  = feedback                      (новый бит справа)
export function createLfsr(seedBits, tapsDegrees) {
  const seed = normalizeSeed(seedBits);
  let reg = seed.split("").map((ch) => Number(ch));

  // Степень d - индекс REGISTER_SIZE - d; исключаем d=REGISTER_SIZE (=0) и d=0 (=37)
  const tapIndices = tapsDegrees
    .filter((d) => d > 0 && d < REGISTER_SIZE)
    .map((d) => REGISTER_SIZE - d);

  if (reg.every((bit) => bit === 0)) {
    throw new Error("Начальное состояние из одних нулей недопустимо для LFSR.");
  }

  return {
    nextBit() {
      // Выходной бит — MSB (reg[0], степень 37)
      const outBit = reg[0];

      // Feedback = XOR отводов (степени 37,12,10,2):
      let feedback = reg[0]; // степень 37 всегда участвует как старший член
      for (const idx of tapIndices) {
        feedback ^= reg[idx];
      }

      // Сдвиг влево. каждый разряд берёт значение правого соседа
      for (let i = 0; i < REGISTER_SIZE - 1; i += 1) {
        reg[i] = reg[i + 1];
      }
      // Новый бит (feedback) вписывается справа (в LSB)
      reg[REGISTER_SIZE - 1] = feedback;

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
