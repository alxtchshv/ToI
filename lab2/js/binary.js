import { PREVIEW_MAX_BYTES } from "./constants.js";

// Преобразует один байт в строку из 8 бит.
export function byteToBits(byte) {
  return byte.toString(2).padStart(8, "0");
}

// Преобразует массив байтов в сплошную битовую строку.
export function bytesToBitString(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    out += byteToBits(bytes[i]);
  }
  return out;
}

// Преобразует массив битов (0/1) в строку.
export function bitArrayToString(bitArray) {
  let out = "";
  for (let i = 0; i < bitArray.length; i += 1) {
    out += bitArray[i] ? "1" : "0";
  }
  return out;
}

// Возвращает бинарное представление файла с ограничением на объем превью.
export function filePreviewBitString(bytes) {
  if (bytes.length <= PREVIEW_MAX_BYTES) {
    return bytesToBitString(bytes);
  }

  const start = bytes.slice(0, PREVIEW_MAX_BYTES);
  const end = bytes.slice(bytes.length - PREVIEW_MAX_BYTES);
  return `${bytesToBitString(start)}\n...\n${bytesToBitString(end)}`;
}

// Возвращает симметричное превью: первые N и последние N бит.
export function symmetricPreview(bitString, chunkSize) {
  const n = Math.max(8, Math.min(chunkSize, bitString.length));
  if (bitString.length <= n * 2) return bitString;
  const first = bitString.slice(0, n);
  const last = bitString.slice(-n);
  return `${first}\n...\n${last}`;
}
