/**
 * utils.js — Математические утилиты для криптосистемы Эль-Гамаля
 * Используется BigInt для корректной работы с большими числами.
 */

'use strict';

/**
 * Быстрое возведение в степень по модулю.
 * Алгоритм: последовательное возведение в квадрат (right-to-left binary method).
 * @param {BigInt} base  — основание
 * @param {BigInt} exp   — показатель степени
 * @param {BigInt} mod   — модуль
 * @returns {BigInt}
 */
function fastPowMod(base, exp, mod) {
    let result = 1n;
    base = base % mod;
    while (exp > 0n) {
        if (exp & 1n) {                  // если текущий бит = 1
            result = (result * base) % mod;
        }
        base = (base * base) % mod;      // возводим в квадрат
        exp >>= 1n;                       // сдвиг вправо (следующий бит)
    }
    return result;
}

/**
 * Расширенный алгоритм Евклида.
 * Находит НОД(a, b) и коэффициенты x, y такие, что a*x + b*y = НОД(a, b).
 * @param {BigInt} a
 * @param {BigInt} b
 * @returns {{ gcd: BigInt, x: BigInt, y: BigInt }}
 */
function extendedGcd(a, b) {
    if (a === 0n) return { gcd: b, x: 0n, y: 1n };
    const sub = extendedGcd(b % a, a);
    return {
        gcd: sub.gcd,
        x: sub.y - (b / a) * sub.x,
        y: sub.x
    };
}

/**
 * Мультипликативный обратный элемент a по модулю m.
 * Возвращает null, если обратного не существует (НОД(a, m) ≠ 1).
 * @param {BigInt} a
 * @param {BigInt} m
 * @returns {BigInt|null}
 */
function modInverse(a, m) {
    const { gcd, x } = extendedGcd(a % m, m);
    if (gcd !== 1n) return null;                 // обратный не существует
    return ((x % m) + m) % m;                   // приводим к положительному
}

/**
 * Проверяет, взаимно ли просты числа a и b (НОД = 1).
 * @param {BigInt} a
 * @param {BigInt} b
 * @returns {boolean}
 */
function isCoprime(a, b) {
    return extendedGcd(a, b).gcd === 1n;
}

/**
 * Находит все простые делители числа n.
 * @param {BigInt} n
 * @returns {BigInt[]}
 */
function getPrimeFactors(n) {
    const factors = [];
    let temp = n;
    for (let i = 2n; i * i <= temp; i++) {
        if (temp % i === 0n) {
            factors.push(i);
            while (temp % i === 0n) temp /= i;   // убираем все вхождения
        }
    }
    if (temp > 1n) factors.push(temp);            // остаток — простой делитель
    return factors;
}

/**
 * Детерминированная проверка простоты числа n (пробное деление).
 * Достаточно для академических задач с небольшими p.
 * @param {BigInt} n
 * @returns {boolean}
 */
function isPrime(n) {
    if (n < 2n) return false;
    if (n === 2n) return true;
    if (n % 2n === 0n) return false;
    const limit = BigInt(Math.ceil(Math.sqrt(Number(n)))) + 1n;
    for (let i = 3n; i <= limit; i += 2n) {
        if (n % i === 0n) return false;
    }
    return true;
}

/**
 * Проверяет, является ли g первообразным корнем по модулю p.
 * Условие: g^((p-1)/q) mod p ≠ 1 для каждого простого делителя q числа p-1.
 * @param {BigInt} g
 * @param {BigInt} p
 * @param {BigInt[]} primeFactors — простые делители p-1
 * @returns {boolean}
 */
function isPrimitiveRoot(g, p, primeFactors) {
    if (g <= 1n) return false;
    const phi = p - 1n;
    for (const q of primeFactors) {
        if (fastPowMod(g, phi / q, p) === 1n) return false;
    }
    return true;
}

/**
 * Находит все первообразные корни по модулю простого p.
 * @param {BigInt} p
 * @param {function(number): void} [onProgress] — колбэк прогресса 0..100
 * @returns {BigInt[]}
 */
function findAllPrimitiveRoots(p, onProgress) {
    if (!isPrime(p)) return [];
    const primeFactors = getPrimeFactors(p - 1n);
    const roots = [];
    const total = Number(p) - 2;           // проверяем g от 2 до p-1
    for (let i = 0; i < total; i++) {
        const g = BigInt(i + 2);
        if (isPrimitiveRoot(g, p, primeFactors)) roots.push(g);
        if (onProgress && i % 500 === 0) onProgress(Math.floor(i / total * 100));
    }
    if (onProgress) onProgress(100);
    return roots;
}

/**
 * Генерирует случайное взаимно простое с phi число k в диапазоне (1, p-1).
 * @param {BigInt} p
 * @returns {BigInt}
 */
function randomCoprime(p) {
    const range = Number(p) - 3;           // диапазон [2, p-2]
    let k;
    do {
        k = BigInt(2 + Math.floor(Math.random() * range));
    } while (!isCoprime(k, p - 1n));
    return k;
}
