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
 * Формат выходного файла (бинарный):
 *   [0..3]  — оригинальная длина файла (uint32 big-endian)
 *   [4..7]  — значение p (uint32 big-endian)
 *   [8..N]  — пары (a, b), каждая по 8 байт (два uint32 big-endian)
 *
 * @param {Uint8Array} data   — исходные байты
 * @param {BigInt}     p
 * @param {BigInt}     g
 * @param {BigInt}     y
 * @param {BigInt}     k0     — k для первого блока (введён пользователем)
 * @param {function}   onProgress — колбэк прогресса
 * @returns {{ buffer: ArrayBuffer, pairs: Array<{a:BigInt,b:BigInt}>, log: string }}
 */
function encryptFile(data, p, g, y, k0, onProgress) {
    const originalLen = data.length;
    const pairs = [];
    const logLines = [];

    // Добавляем паддинг (PKCS#7) если нужно
    const blockSize = 8;
    const paddingLen = (blockSize - (originalLen % blockSize)) % blockSize;
    let paddedData = data;
    if (paddingLen > 0) {
        paddedData = new Uint8Array(originalLen + paddingLen);
        paddedData.set(data);
        paddedData.fill(paddingLen, originalLen);  // байты паддинга = их количество
    }

    // Проверка: все байты должны быть < p
    const maxByte = Math.max(...paddedData);
    if (BigInt(maxByte) >= p) {
        throw new Error(`Байт ${maxByte} ≥ p = ${p}. Увеличьте p (нужно p > ${maxByte})!`);
    }

    // Шифруем побайтово
    for (let i = 0; i < paddedData.length; i++) {
        const m = BigInt(paddedData[i]);

        // Первый блок — k из поля ввода, остальные — случайные
        const k = (i === 0) ? k0 : randomCoprime(p);

        const { a, b } = encryptByte(m, p, g, y, k);
        pairs.push({ a, b });

        // Логируем первые 10 пар
        if (i < 10) {
            logLines.push(`[${i + 1}] m=${paddedData[i]}, k=${k}, a=${a}, b=${b}`);
        }
        if (i === 10) logLines.push('...');

        if (onProgress && i % 200 === 0) onProgress(Math.floor(i / paddedData.length * 100));
    }

    // Записываем в бинарный буфер
    const bufferSize = 8 + pairs.length * 8;              // заголовок 8 байт + пары
    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);

    view.setUint32(0, originalLen, false);                 // оригинальная длина (big-endian)
    view.setUint32(4, Number(p), false);                   // p (big-endian)

    let offset = 8;
    for (const { a, b } of pairs) {
        view.setUint32(offset, Number(a), false);          // a
        view.setUint32(offset + 4, Number(b), false);      // b
        offset += 8;
    }

    if (onProgress) onProgress(100);

    return {
        buffer,
        pairs: pairs.slice(0, 10),                         // первые 10 для отображения
        totalPairs: pairs.length,
        originalLen,
        paddingLen,
        log: logLines.join('\n')
    };
}

/**
 * Дешифрует файл, зашифрованный функцией encryptFile.
 * @param {ArrayBuffer} buffer  — содержимое .enc файла
 * @param {BigInt}      x       — закрытый ключ
 * @param {BigInt}      p       — параметр системы (может не совпасть с файловым)
 * @param {function}    onProgress
 * @returns {{ data: Uint8Array, log: string, pFromFile: BigInt }}
 */
function decryptFile(buffer, x, p, onProgress) {
    const view = new DataView(buffer);

    if (buffer.byteLength < 8) throw new Error('Файл повреждён или не является .enc файлом');

    const originalLen = view.getUint32(0, false);          // big-endian
    const pFromFile = BigInt(view.getUint32(4, false));

    // Если p из файла не совпадает с введённым — используем из файла
    const usedP = pFromFile;

    // Читаем пары (a, b)
    const pairsCount = (buffer.byteLength - 8) / 8;
    const logLines = [];
    const decryptedBytes = [];

    for (let i = 0; i < pairsCount; i++) {
        const offset = 8 + i * 8;
        const a = BigInt(view.getUint32(offset, false));
        const b = BigInt(view.getUint32(offset + 4, false));

        const m = decryptByte(a, b, usedP, x);
        decryptedBytes.push(Number(m));

        if (i < 10) logLines.push(`[${i + 1}] a=${a}, b=${b} → m=${m}`);
        if (i === 10) logLines.push('...');

        if (onProgress && i % 200 === 0) onProgress(Math.floor(i / pairsCount * 100));
    }

    if (onProgress) onProgress(100);

    // Обрезаем до оригинальной длины (убираем паддинг)
    const result = new Uint8Array(decryptedBytes.slice(0, originalLen));

    return {
        data: result,
        pFromFile,
        log: logLines.join('\n')
    };
}
