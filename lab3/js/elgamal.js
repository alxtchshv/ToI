/**
 * elgamal.js — Реализация криптосистемы Эль-Гамаля
 *
 * Алгоритм (из методического пособия БГУИР):
 *   Генерация ключей:
 *     1. Выбрать простое p
 *     2. Выбрать первообразный корень g по модулю p
 *     3. Выбрать случайное x ∈ (1, p-1)
 *     4. Вычислить y = g^x mod p
 *     Открытый ключ: (p, g, y), Закрытый ключ: x
 *
 *   Шифрование байта m:
 *     1. Выбрать случайное k, взаимно простое с p-1
 *     2. a = g^k mod p
 *     3. b = (y^k * m) mod p
 *     Шифротекст: пара (a, b)
 *
 *   Дешифрование (a, b):
 *     m = b * a^(-x) mod p = b * (a^x)^(-1) mod p
 */

'use strict';

/* ────────────────────── Ключи ────────────────────── */

/**
 * Вычисляет открытый ключ y из параметров p, g, x.
 * @param {BigInt} p  — простое число
 * @param {BigInt} g  — первообразный корень mod p
 * @param {BigInt} x  — закрытый ключ
 * @returns {BigInt} y = g^x mod p
 */
function computePublicKey(p, g, x) {
    return fastPowMod(g, x, p);
}

/* ────────────────────── Шифрование / дешифрование ────────────────────── */

/**
 * Шифрует один байт (число m ∈ [0, p-1]).
 * @param {BigInt} m  — байт исходного текста
 * @param {BigInt} p  — параметр системы
 * @param {BigInt} g  — первообразный корень
 * @param {BigInt} y  — открытый ключ
 * @param {BigInt} k  — случайное число, взаимно простое с p-1
 * @returns {{ a: BigInt, b: BigInt }}
 */
function encryptByte(m, p, g, y, k) {
    const a = fastPowMod(g, k, p);            // a = g^k mod p
    const yk = fastPowMod(y, k, p);           // y^k mod p
    const b = (yk * m) % p;                   // b = y^k * m mod p
    return { a, b };
}

/**
 * Дешифрует пару (a, b) в исходный байт.
 * @param {BigInt} a
 * @param {BigInt} b
 * @param {BigInt} p
 * @param {BigInt} x  — закрытый ключ
 * @returns {BigInt}
 */
function decryptByte(a, b, p, x) {
    const ax = fastPowMod(a, x, p);           // a^x mod p
    const axInv = modInverse(ax, p);           // (a^x)^(-1) mod p
    if (axInv === null) return 0n;             // ошибка (не должна возникнуть)
    return (b * axInv) % p;                    // m = b * (a^x)^(-1) mod p
}

/* ────────────────────── Работа с файлами ────────────────────── */

/**
 * Зашифровывает массив байт.
 * Первый блок шифруется ключом k0, остальные — случайными k.
 *
 * Формат выходного файла (БИНАРНЫЙ, big-endian, uint32):
 *   [0..3]    — оригинальная длина файла (uint32 BE)
 *   [4..7]    — параметр p (uint32 BE)
 *   [8..9]    — длина имени файла в байтах (uint16 BE)
 *   [10..M]   — имя файла в UTF-8 (с расширением)
 *   [M..N]    — пары (a, b), каждая по 8 байт: a (uint32 BE), b (uint32 BE)
 *
 * Имя файла встраивается в .enc, чтобы после расшифровки исходное
 * расширение всегда восстанавливалось — даже если пользователь
 * переименовал .enc файл.
 *
 * @param {Uint8Array} data
 * @param {BigInt}     p
 * @param {BigInt}     g
 * @param {BigInt}     y
 * @param {BigInt}     k0
 * @param {function}   onProgress
 * @param {string}     [origFileName]  — оригинальное имя файла (с расширением)
 * @returns {{ buffer: ArrayBuffer, totalPairs: number, originalLen: number, flow: string }}
 */
function encryptFile(data, p, g, y, k0, onProgress, origFileName = '') {
    const originalLen = data.length;

    // Проверка: все байты должны быть < p
    for (let i = 0; i < data.length; i++) {
        if (BigInt(data[i]) >= p) {
            throw new Error(`Байт ${data[i]} ≥ p = ${p}. Увеличьте p (нужно p > 255)!`);
        }
    }

    // Проверка: p должно помещаться в uint32
    if (p > 0xFFFFFFFFn) {
        throw new Error(`p = ${p} слишком большое для бинарного формата (макс. 4 294 967 295)`);
    }

    // Кодируем имя файла в UTF-8
    const nameBytes = new TextEncoder().encode(origFileName);
    if (nameBytes.length > 0xFFFF) {
        throw new Error('Слишком длинное имя файла');
    }

    const pairs = [];
    const pairsForDisplay = [];

    // Шифруем побайтово
    for (let i = 0; i < data.length; i++) {
        const m = BigInt(data[i]);
        const k = (i === 0) ? k0 : randomCoprime(p);
        const { a, b } = encryptByte(m, p, g, y, k);
        pairs.push({ a, b });
        pairsForDisplay.push(`${a} ${b}`);

        if (onProgress && i % 200 === 0) onProgress(Math.floor(i / data.length * 100));
    }

    // Записываем в бинарный буфер
    const headerSize = 8 + 2 + nameBytes.length;          // 8 (len+p) + 2 (nameLen) + имя
    const bufferSize = headerSize + pairs.length * 8;
    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);
    const u8 = new Uint8Array(buffer);

    view.setUint32(0, originalLen, false);                 // длина файла, 4 байта BE
    view.setUint32(4, Number(p), false);                   // p, 4 байта BE
    view.setUint16(8, nameBytes.length, false);            // длина имени, 2 байта BE
    u8.set(nameBytes, 10);                                  // имя файла (UTF-8)

    let offset = headerSize;
    for (const { a, b } of pairs) {
        view.setUint32(offset, Number(a), false);
        view.setUint32(offset + 4, Number(b), false);
        offset += 8;
    }

    if (onProgress) onProgress(100);

    const flowDisplay = pairsForDisplay.slice(0, 200).join('  ');
    const moreText = pairs.length > 200 ? `\n\n... и ещё ${pairs.length - 200} пар` : '';

    return {
        buffer,
        totalPairs: pairs.length,
        originalLen,
        flow: flowDisplay + moreText
    };
}

/**
 * Дешифрует файл.
 *
 * @returns {{ data: Uint8Array, flow: string, pFromFile: BigInt, originalName: string }}
 */
function decryptFile(buffer, x, p, onProgress) {
    const arrBuf = (buffer instanceof ArrayBuffer)
        ? buffer
        : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

    if (arrBuf.byteLength < 10) {
        throw new Error('Файл повреждён или не является .enc файлом');
    }

    const view = new DataView(arrBuf);
    const u8 = new Uint8Array(arrBuf);

    const originalLen = view.getUint32(0, false);
    const pFromFile = BigInt(view.getUint32(4, false));
    const nameLen = view.getUint16(8, false);

    if (10 + nameLen > arrBuf.byteLength) {
        throw new Error('Некорректный заголовок (неверная длина имени)');
    }

    // Читаем оригинальное имя файла
    const originalName = new TextDecoder().decode(u8.subarray(10, 10 + nameLen));

    const headerSize = 10 + nameLen;
    const usedP = pFromFile;

    const pairsCount = (arrBuf.byteLength - headerSize) / 8;
    if (!Number.isInteger(pairsCount)) {
        throw new Error('Некорректная длина файла: не кратно 8 байтам');
    }

    const decryptedBytes = [];
    for (let i = 0; i < pairsCount; i++) {
        const offset = headerSize + i * 8;
        const a = BigInt(view.getUint32(offset, false));
        const b = BigInt(view.getUint32(offset + 4, false));

        const m = decryptByte(a, b, usedP, x);
        decryptedBytes.push(Number(m));

        if (onProgress && i % 200 === 0) onProgress(Math.floor(i / pairsCount * 100));
    }

    if (onProgress) onProgress(100);

    const result = new Uint8Array(decryptedBytes.slice(0, originalLen));

    const flowDisplay = Array.from(result).slice(0, 400).join(' ');
    const more = result.length > 400 ? `\n\n... и ещё ${result.length - 400} байт` : '';

    return {
        data: result,
        pFromFile,
        originalName,                              // оригинальное имя с расширением
        flow: flowDisplay + more
    };
}
