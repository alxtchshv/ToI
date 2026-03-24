import { buildKeyStreamBits } from "./lfsr.js";

// Выполняет побайтный XOR входных данных с ключевым потоком LFSR.
export function xorTransform(inputBytes, seed, taps) {
  const bitLength = inputBytes.length * 8;
  const keyBits = buildKeyStreamBits(seed, taps, bitLength);
  const output = new Uint8Array(inputBytes.length);

  for (let i = 0; i < inputBytes.length; i += 1) {
    let keyByte = 0;
    for (let b = 0; b < 8; b += 1) {
      keyByte = (keyByte << 1) | keyBits[i * 8 + b];
    }
    output[i] = inputBytes[i] ^ keyByte;
  }

  return { outputBytes: output, keyBits };
}
