/**
 * ui.js — Логика интерфейса криптосистемы Эль-Гамаля
 *
 * Отвечает за:
 *   — переключение вкладок
 *   — обработку событий ввода с валидацией в реальном времени
 *   — запуск алгоритмов через Web Workers или setTimeout (без блокировки UI)
 *   — загрузку и скачивание файлов через File API
 */

'use strict';

/* ═══════════════════════════════════════════
   Глобальное состояние приложения
═══════════════════════════════════════════ */
const State = {
    p: null,     // BigInt — простое число
    g: null,     // BigInt — первообразный корень
    x: null,     // BigInt — закрытый ключ
    y: null,     // BigInt — открытый ключ
    primitiveRoots: [],   // BigInt[] — все первообразные корни

    encryptFileData: null,    // Uint8Array — данные файла для шифрования
    encryptFileName: '',

    decryptFileBuffer: null,  // ArrayBuffer — данные .enc файла
    decryptFileName: '',

    viewFileBuffer: null,
};

/* ═══════════════════════════════════════════
   Вкладки
═══════════════════════════════════════════ */
function initTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const panels = document.querySelectorAll('.tab-panel');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Убираем active со всех вкладок и панелей
            tabs.forEach(t => t.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));

            // Активируем нужную
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });
}

/* ═══════════════════════════════════════════
   Вкладка 1: Генерация ключей
═══════════════════════════════════════════ */
function initKeyTab() {
    const pInput   = document.getElementById('param-p');
    const xInput   = document.getElementById('param-x');
    const gSelect  = document.getElementById('param-g');
    const findBtn  = document.getElementById('btn-find-roots');
    const genBtn   = document.getElementById('btn-gen-keys');
    const hint     = document.getElementById('key-hint');
    const output   = document.getElementById('key-output');
    const progress = document.getElementById('key-progress');

    // Валидация в реальном времени (при вводе)
    pInput.addEventListener('input', () => validateKeyInputs());
    xInput.addEventListener('input', () => validateKeyInputs());
    gSelect.addEventListener('change', () => validateKeyInputs());

    function validateKeyInputs() {
        const msgs = [];

        // Проверка p
        const pStr = pInput.value.trim();
        if (!pStr) {
            msgs.push({ type: 'info', text: 'ⓘ Введите простое число p' });
        } else {
            try {
                const pVal = BigInt(pStr);
                if (isPrime(pVal)) {
                    msgs.push({ type: 'ok', text: `✓ p = ${pVal} — простое` });
                    if (pVal <= 255n) {
                        msgs.push({ type: 'warn', text: `⚠ p ≤ 255: нельзя шифровать файлы с байтами ≥ ${pVal}` });
                    } else {
                        msgs.push({ type: 'ok', text: '✓ p > 255: можно шифровать любые файлы' });
                    }
                } else {
                    msgs.push({ type: 'err', text: `✗ p = ${pVal} — не является простым` });
                }
            } catch {
                msgs.push({ type: 'err', text: '✗ Введите целое число' });
            }
        }

        // Проверка g
        if (gSelect.value) {
            const g = BigInt(gSelect.value);
            if (State.primitiveRoots.includes(g)) {
                msgs.push({ type: 'ok', text: `✓ g = ${g} — первообразный корень` });
            } else {
                msgs.push({ type: 'err', text: `✗ g = ${g} — не является первообразным корнем` });
            }
        }

        // Проверка x
        const xStr = xInput.value.trim();
        if (xStr && pStr) {
            try {
                const pVal = BigInt(pStr);
                const xVal = BigInt(xStr);
                if (xVal > 1n && xVal < pVal - 1n) {
                    msgs.push({ type: 'ok', text: `✓ x = ${xVal} в диапазоне (1, ${pVal - 1n})` });
                } else {
                    msgs.push({ type: 'err', text: `✗ x должно быть в диапазоне (1, ${pVal - 1n})` });
                }
            } catch { /* ignore */ }
        }

        // Рендерим сообщения
        hint.innerHTML = msgs.map(m => `<span class="hint-${m.type}">${m.text}</span>`).join('<br>');
    }

    // Найти все первообразные корни
    findBtn.addEventListener('click', () => {
        const pStr = pInput.value.trim();
        if (!pStr) return showToast('Введите значение p', 'error');

        let pVal;
        try { pVal = BigInt(pStr); } catch { return showToast('Некорректное число', 'error'); }
        if (!isPrime(pVal)) return showToast(`${pVal} не является простым числом!`, 'error');
        if (pVal < 3n) return showToast('p должно быть > 2', 'error');

        // Предупреждение для больших p
        if (pVal > 5000n) {
            const ok = confirm(`p = ${pVal} — большое число. Поиск может занять время.\nПродолжить?`);
            if (!ok) return;
        }

        findBtn.disabled = true;
        progress.style.display = 'block';
        progress.querySelector('.progress-bar').style.width = '0%';
        output.textContent = '';

        // Запускаем поиск асинхронно (chunked), чтобы не блокировать UI
        searchRootsAsync(pVal, (done) => {
            progress.querySelector('.progress-bar').style.width = done + '%';
        }, (roots) => {
            State.p = pVal;
            State.primitiveRoots = roots;

            // Заполняем выпадающий список
            gSelect.innerHTML = '<option value="">— выберите g —</option>';
            roots.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.toString();
                opt.textContent = r.toString();
                gSelect.appendChild(opt);
            });

            const pf = getPrimeFactors(pVal - 1n);
            output.textContent =
`p = ${pVal}
p-1 = ${pVal - 1n}
Простые делители (p-1): [${pf.join(', ')}]

Найдено ${roots.length} первообразных корней:
[${roots.join(', ')}]`;

            progress.style.display = 'none';
            findBtn.disabled = false;
            validateKeyInputs();
            showToast(`Найдено ${roots.length} первообразных корней`, 'success');
        });
    });

    // Вычислить открытый ключ
    genBtn.addEventListener('click', () => {
        const pStr = pInput.value.trim();
        const gStr = gSelect.value;
        const xStr = xInput.value.trim();

        if (!pStr || !gStr || !xStr) return showToast('Заполните все поля', 'error');

        let pVal, gVal, xVal;
        try {
            pVal = BigInt(pStr); gVal = BigInt(gStr); xVal = BigInt(xStr);
        } catch { return showToast('Некорректные значения', 'error'); }

        if (!isPrime(pVal)) return showToast(`${pVal} не простое!`, 'error');
        if (!State.primitiveRoots.includes(gVal)) return showToast(`${gVal} не первообразный корень!`, 'error');
        if (xVal <= 1n || xVal >= pVal - 1n) return showToast(`x вне диапазона (1, ${pVal - 1n})`, 'error');

        State.p = pVal; State.g = gVal; State.x = xVal;
        State.y = computePublicKey(pVal, gVal, xVal);

        output.textContent =
`=== Генерация ключей (Эль-Гамаль) ===

1. Простое число:       p = ${pVal}
2. Первообразный корень: g = ${gVal}
3. Закрытый ключ:       x = ${xVal}
4. Вычисляем y = g^x mod p:
   y = ${gVal}^${xVal} mod ${pVal} = ${State.y}

Открытый ключ  Ko = (p=${pVal}, g=${gVal}, y=${State.y})
Закрытый ключ  Kc = ${xVal}`;

        showToast('Ключи сгенерированы!', 'success');
    });
}

/* ═══════════════════════════════════════════
   Асинхронный поиск первообразных корней
   (чтобы страница не зависала на больших p)
═══════════════════════════════════════════ */
function searchRootsAsync(p, onProgress, onDone) {
    const pf = getPrimeFactors(p - 1n);
    const total = Number(p) - 2;    // g от 2 до p-1
    const roots = [];
    const CHUNK = 500;              // обрабатываем по 500 значений за раз
    let current = 0;

    function processChunk() {
        const end = Math.min(current + CHUNK, total);
        for (let i = current; i < end; i++) {
            const g = BigInt(i + 2);
            if (isPrimitiveRoot(g, p, pf)) roots.push(g);
        }
        current = end;
        onProgress(Math.floor(current / total * 100));

        if (current < total) {
            setTimeout(processChunk, 0);    // отдаём управление браузеру
        } else {
            onDone(roots);
        }
    }
    setTimeout(processChunk, 0);
}

/* ═══════════════════════════════════════════
   Вкладка 2: Шифрование
═══════════════════════════════════════════ */
function initEncryptTab() {
    const fileInput  = document.getElementById('enc-file-input');
    const fileLabel  = document.getElementById('enc-file-label');
    const kInput     = document.getElementById('enc-k');
    const kHint      = document.getElementById('enc-k-hint');
    const encBtn     = document.getElementById('btn-encrypt');
    const output     = document.getElementById('enc-output');
    const dlArea     = document.getElementById('enc-download-area');
    const progress   = document.getElementById('enc-progress');

    // Выбор файла через кнопку
    document.getElementById('btn-enc-choose-file').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;
        fileLabel.textContent = file.name;
        fileLabel.classList.add('has-file');
        const reader = new FileReader();
        reader.onload = e => {
            State.encryptFileData = new Uint8Array(e.target.result);
            State.encryptFileName = file.name;
        };
        reader.readAsArrayBuffer(file);
    });

    // Валидация k в реальном времени
    kInput.addEventListener('input', () => {
        if (!State.p) { kHint.innerHTML = '<span class="hint-warn">⚠ Сначала сгенерируйте ключи (вкладка 1)</span>'; return; }
        const kStr = kInput.value.trim();
        if (!kStr) { kHint.innerHTML = ''; return; }
        try {
            const k = BigInt(kStr);
            const msgs = [];
            if (k > 1n && k < State.p - 1n) {
                msgs.push(`<span class="hint-ok">✓ k = ${k} в диапазоне (1, ${State.p - 1n})</span>`);
            } else {
                msgs.push(`<span class="hint-err">✗ k должно быть в диапазоне (1, ${State.p - 1n})</span>`);
            }
            const coprime = isCoprime(k, State.p - 1n);
            if (coprime) {
                msgs.push(`<span class="hint-ok">✓ НОД(${k}, ${State.p - 1n}) = 1 (взаимно просты)</span>`);
            } else {
                const { gcd } = extendedGcd(k, State.p - 1n);
                msgs.push(`<span class="hint-err">✗ НОД(${k}, ${State.p - 1n}) = ${gcd} (не взаимно просты!)</span>`);
            }
            kHint.innerHTML = msgs.join('<br>');
        } catch {
            kHint.innerHTML = '<span class="hint-err">✗ Введите целое число</span>';
        }
    });

    // Кнопка «Зашифровать»
    encBtn.addEventListener('click', () => {
        if (!State.p || !State.g || !State.y) return showToast('Сначала сгенерируйте ключи (вкладка 1)', 'error');
        if (!State.encryptFileData) return showToast('Выберите файл', 'error');

        const kStr = kInput.value.trim();
        if (!kStr) return showToast('Введите k', 'error');

        let k0;
        try { k0 = BigInt(kStr); } catch { return showToast('Некорректное k', 'error'); }
        if (k0 <= 1n || k0 >= State.p - 1n) return showToast(`k вне диапазона (1, ${State.p - 1n})`, 'error');
        if (!isCoprime(k0, State.p - 1n)) return showToast(`k и p-1 не взаимно просты!`, 'error');

        encBtn.disabled = true;
        progress.style.display = 'block';
        progress.querySelector('.progress-bar').style.width = '0%';
        output.textContent = 'Шифрование...';
        dlArea.innerHTML = '';

        // Запускаем шифрование асинхронно
        setTimeout(() => {
            try {
                const result = encryptFile(
                    State.encryptFileData, State.p, State.g, State.y, k0,
                    pct => { progress.querySelector('.progress-bar').style.width = pct + '%'; }
                );

                output.textContent =
`=== Шифрование завершено ===

Файл: ${State.encryptFileName}
p = ${State.p}, g = ${State.g}, y = ${State.y}
k для первого блока = ${k0}
Исходный размер: ${result.originalLen} байт
${result.paddingLen > 0 ? `Паддинг: ${result.paddingLen} байт\n` : ''}Всего пар (a, b): ${result.totalPairs}

Первые пары (a, b):
${result.log}`;

                // Кнопка скачивания
                const blob = new Blob([result.buffer], { type: 'application/octet-stream' });
                const url  = URL.createObjectURL(blob);
                dlArea.innerHTML = `
                    <a class="download-btn" href="${url}" download="${State.encryptFileName}.enc">
                        Скачать ${State.encryptFileName}.enc
                    </a>`;

                progress.style.display = 'none';
                encBtn.disabled = false;
                showToast('Файл зашифрован!', 'success');
            } catch (e) {
                output.textContent = 'Ошибка: ' + e.message;
                progress.style.display = 'none';
                encBtn.disabled = false;
                showToast(e.message, 'error');
            }
        }, 50);
    });
}

/* ═══════════════════════════════════════════
   Вкладка 3: Дешифрование
═══════════════════════════════════════════ */
function initDecryptTab() {
    const fileInput  = document.getElementById('dec-file-input');
    const fileLabel  = document.getElementById('dec-file-label');
    const xInput     = document.getElementById('dec-x');
    const pInput     = document.getElementById('dec-p');
    const decBtn     = document.getElementById('btn-decrypt');
    const output     = document.getElementById('dec-output');
    const dlArea     = document.getElementById('dec-download-area');
    const progress   = document.getElementById('dec-progress');

    // Выбор .enc файла
    document.getElementById('btn-dec-choose-file').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;
        fileLabel.textContent = file.name;
        fileLabel.classList.add('has-file');
        const reader = new FileReader();
        reader.onload = e => {
            State.decryptFileBuffer = e.target.result;
            State.decryptFileName = file.name;
            // Автозаполняем p из заголовка файла
            try {
                const view = new DataView(e.target.result);
                const pFromFile = view.getUint32(4, false);
                pInput.value = pFromFile;
            } catch { /* ignore */ }
        };
        reader.readAsArrayBuffer(file);
    });

    // Автозаполнение из сгенерированных ключей
    document.getElementById('btn-dec-fill-keys').addEventListener('click', () => {
        if (!State.x || !State.p) return showToast('Ключи не сгенерированы', 'error');
        xInput.value = State.x.toString();
        pInput.value = State.p.toString();
        showToast('Ключи заполнены из вкладки 1', 'success');
    });

    // Кнопка «Расшифровать»
    decBtn.addEventListener('click', () => {
        if (!State.decryptFileBuffer) return showToast('Выберите .enc файл', 'error');
        const xStr = xInput.value.trim(), pStr = pInput.value.trim();
        if (!xStr || !pStr) return showToast('Введите x и p', 'error');

        let x, p;
        try { x = BigInt(xStr); p = BigInt(pStr); } catch { return showToast('Некорректные значения', 'error'); }
        if (x <= 1n || x >= p - 1n) return showToast(`x вне диапазона (1, ${p - 1n})`, 'error');

        decBtn.disabled = true;
        progress.style.display = 'block';
        progress.querySelector('.progress-bar').style.width = '0%';
        output.textContent = 'Дешифрование...';
        dlArea.innerHTML = '';

        setTimeout(() => {
            try {
                const result = decryptFile(
                    State.decryptFileBuffer, x, p,
                    pct => { progress.querySelector('.progress-bar').style.width = pct + '%'; }
                );

                const pMismatch = result.pFromFile !== p
                    ? `\n⚠ p из файла = ${result.pFromFile} (использован)` : '';

                output.textContent =
`=== Дешифрование завершено ===

Файл: ${State.decryptFileName}
p = ${result.pFromFile}, x = ${x}${pMismatch}
Восстановлено байт: ${result.data.length}

Первые расшифрованные значения:
${result.log}`;

                // Определяем имя выходного файла (убираем .enc)
                const outName = State.decryptFileName.replace(/\.enc$/i, '') || 'decrypted';
                const blob = new Blob([result.data], { type: 'application/octet-stream' });
                const url  = URL.createObjectURL(blob);
                dlArea.innerHTML = `
                    <a class="download-btn" href="${url}" download="${outName}">
                        Скачать ${outName}
                    </a>`;

                progress.style.display = 'none';
                decBtn.disabled = false;
                showToast('Файл расшифрован!', 'success');
            } catch (e) {
                output.textContent = 'Ошибка: ' + e.message;
                progress.style.display = 'none';
                decBtn.disabled = false;
                showToast(e.message, 'error');
            }
        }, 50);
    });
}

/* ═══════════════════════════════════════════
   Вкладка 4: Просмотр файлов
═══════════════════════════════════════════ */
function initViewTab() {
    const fileInput = document.getElementById('view-file-input');
    const fileLabel = document.getElementById('view-file-label');
    const viewBtn   = document.getElementById('btn-view');
    const output    = document.getElementById('view-output');

    document.getElementById('btn-view-choose-file').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;
        fileLabel.textContent = file.name;
        fileLabel.classList.add('has-file');
        const reader = new FileReader();
        reader.onload = e => {
            State.viewFileBuffer = e.target.result;
            State.viewFileName = file.name;
        };
        reader.readAsArrayBuffer(file);
    });

    viewBtn.addEventListener('click', () => {
        if (!State.viewFileBuffer) return showToast('Выберите файл', 'error');
        const data = new Uint8Array(State.viewFileBuffer);
        const isEnc = State.viewFileName && State.viewFileName.toLowerCase().endsWith('.enc');

        if (isEnc && data.length >= 8) {
            const view = new DataView(State.viewFileBuffer);
            const origLen = view.getUint32(0, false);
            const p = view.getUint32(4, false);
            const pairs = (data.length - 8) / 8;

            let lines = [
                `Файл: ${State.viewFileName}`,
                `Размер: ${data.length} байт`,
                `${'═'.repeat(60)}`,
                `ЗАШИФРОВАННЫЙ ФАЙЛ`,
                `${'═'.repeat(60)}`,
                `Исходный размер: ${origLen} байт`,
                `Параметр p: ${p}`,
                `Всего пар (a, b): ${pairs}`,
                ``,
                `Первые 20 пар:`,
                `${'─'.repeat(50)}`,
                ` №         a           b`,
                `${'─'.repeat(50)}`,
            ];
            const show = Math.min(20, pairs);
            for (let i = 0; i < show; i++) {
                const off = 8 + i * 8;
                const a = view.getUint32(off, false);
                const b = view.getUint32(off + 4, false);
                lines.push(` ${String(i + 1).padStart(2)}   ${String(a).padStart(10)}   ${String(b).padStart(10)}`);
            }
            output.textContent = lines.join('\n');
        } else {
            // Обычный файл — показываем байты
            const show = Math.min(200, data.length);
            let rows = [];
            for (let i = 0; i < show; i += 20) {
                rows.push(Array.from(data.slice(i, i + 20)).map(b => String(b).padStart(3)).join(' '));
            }
            output.textContent =
`Файл: ${State.viewFileName}
Размер: ${data.length} байт

Первые ${show} байт (десятичные):
${'─'.repeat(70)}
${rows.join('\n')}
${'─'.repeat(70)}
... и ещё ${Math.max(0, data.length - show)} байт`;
        }
    });
}

/* ═══════════════════════════════════════════
   Toast-уведомления
═══════════════════════════════════════════ */
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast toast-${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

/* ═══════════════════════════════════════════
   Точка входа
═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initKeyTab();
    initEncryptTab();
    initDecryptTab();
    initViewTab();
});
