// ============================================================
// ТЕСТОВЫЕ ДАННЫЕ
// ============================================================

const testData = {
    // Обычные тесты для Плейфейра
    playfair1: {
        cipher: 'playfair',
        key: 'MONARCHY',
        text: 'HELLO',
        action: 'encrypt',
        name: 'Тест 1',
        isEdgeCase: false
    },
    playfair2: {
        cipher: 'playfair',
        key: 'KEYWORD',
        text: 'HIDE THE GOLD',
        action: 'encrypt',
        name: 'Тест 2',
        isEdgeCase: false
    },
    
    // Краевые случаи для Плейфейра
    playfair_edge1: {
        cipher: 'playfair',
        key: 'SECRET',
        text: 'BALLOON',
        action: 'encrypt',
        name: 'Тест 3 (двойные буквы)',
        isEdgeCase: true
    },
    playfair_edge2: {
        cipher: 'playfair',
        key: 'CIPHER',
        text: 'HELLO',
        action: 'encrypt',
        name: 'Тест 4 (нечётная длина)',
        isEdgeCase: true
    },
    playfair_edge3: {
        cipher: 'playfair',
        key: 'TEST',
        text: 'JUMP',
        action: 'encrypt',
        name: 'Тест 5 (буква J)',
        isEdgeCase: true
    },
    playfair_edge4: {
        cipher: 'playfair',
        key: 'PUZZLE',
        text: 'AAAA',
        action: 'encrypt',
        name: 'Тест 6 (одинаковые буквы)',
        isEdgeCase: true
    },
    
    // Обычные тесты для Виженера
    vigenere1: {
        cipher: 'vigenere',
        key: 'КЛЮЧ',
        text: 'ПРИВЕТ',
        action: 'encrypt',
        name: 'Тест 1',
        isEdgeCase: false
    },
    vigenere2: {
        cipher: 'vigenere',
        key: 'ШИФР',
        text: 'КРИПТОГРАФИЯ',
        action: 'encrypt',
        name: 'Тест 2',
        isEdgeCase: false
    },
    
    // Краевые случаи для Виженера
    vigenere_edge1: {
        cipher: 'vigenere',
        key: 'АБВ',
        text: 'ДЛИННЫЙ ТЕКСТ ДЛЯ ДЕМОНСТРАЦИИ ПРОГРЕССИВНОГО КЛЮЧА',
        action: 'encrypt',
        name: 'Тест 3 (прогрессивный ключ)',
        isEdgeCase: true
    },
    vigenere_edge2: {
        cipher: 'vigenere',
        key: 'КОРОТКИЙКЛЮЧ',
        text: 'ТЕКСТ',
        action: 'encrypt',
        name: 'Тест 4 (ключ длиннее текста)',
        isEdgeCase: true
    }
};

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

// Обновление отображаемых тестов
function updateTestButtons() {
    const cipher = document.querySelector('input[name="cipher"]:checked').value;
    const testButtonsContainer = document.getElementById('testButtons');
    testButtonsContainer.innerHTML = '';
    
    for (let testId in testData) {
        const test = testData[testId];
        if (test.cipher === cipher) {
            const button = document.createElement('button');
            button.className = test.isEdgeCase ? 'test-btn edge-case' : 'test-btn';
            button.textContent = test.name;
            button.onclick = () => loadTest(testId);
            testButtonsContainer.appendChild(button);
        }
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    updateTestButtons();
    
    // Обновляем тесты при смене алгоритма
    document.querySelectorAll('input[name="cipher"]').forEach(radio => {
        radio.addEventListener('change', updateTestButtons);
    });
});

// Загрузка теста
function loadTest(testId) {
    const test = testData[testId];
    if (!test) return;
    
    document.querySelector(`input[name="cipher"][value="${test.cipher}"]`).checked = true;
    document.querySelector(`input[name="action"][value="${test.action}"]`).checked = true;
    document.getElementById('key').value = test.key;
    document.getElementById('inputText').value = test.text;
    updateTestButtons();
    showMessage(`Загружен: ${test.name}`, 'success');
}

// Обработка загрузки файла
document.getElementById('fileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('inputText').value = e.target.result;
            showMessage('Файл успешно загружен', 'success');
        };
        reader.readAsText(file, 'UTF-8');
    }
});

// Показать сообщение
function showMessage(text, type) {
    const msg = document.getElementById('message');
    msg.textContent = text;
    msg.className = `message ${type} show`;
    setTimeout(() => {
        msg.classList.remove('show');
    }, 5000);
}

// Очистка ввода
function clearInput() {
    document.getElementById('inputText').value = '';
    document.getElementById('fileInput').value = '';
}

// Копирование в буфер обмена
function copyToClipboard() {
    const output = document.getElementById('outputText');
    if (!output.value) {
        showMessage('Нет текста для копирования', 'error');
        return;
    }
    output.select();
    document.execCommand('copy');
    showMessage('Текст скопирован в буфер обмена', 'success');
}

// Сохранение в файл
function saveToFile() {
    const output = document.getElementById('outputText').value;
    if (!output) {
        showMessage('Нет текста для сохранения', 'error');
        return;
    }
    
    const cipher = document.querySelector('input[name="cipher"]:checked').value;
    const action = document.querySelector('input[name="action"]:checked').value;
    const filename = `${cipher}_${action}_${Date.now()}.txt`;
    
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    
    showMessage('Файл успешно сохранен', 'success');
}

// ============================================================
// ШИФР ПЛЕЙФЕЙРА
// ============================================================

function preparePlayfairKey(key) {
    // Удаляем все кроме букв, переводим в верхний регистр
    key = key.toUpperCase().replace(/[^A-Z]/g, '');
    
    // Заменяем J на I
    key = key.replace(/J/g, 'I');
    
    // Удаляем дубликаты
    let uniqueKey = '';
    for (let char of key) {
        if (!uniqueKey.includes(char)) {
            uniqueKey += char;
        }
    }
    
    // Добавляем оставшиеся буквы алфавита
    const alphabet = 'ABCDEFGHIKLMNOPQRSTUVWXYZ'; // без J
    for (let char of alphabet) {
        if (!uniqueKey.includes(char)) {
            uniqueKey += char;
        }
    }
    
    return uniqueKey;
}

function createPlayfairMatrix(key) {
    const preparedKey = preparePlayfairKey(key);
    const matrix = [];
    
    for (let i = 0; i < 5; i++) {
        matrix[i] = [];
        for (let j = 0; j < 5; j++) {
            matrix[i][j] = preparedKey[i * 5 + j];
        }
    }
    
    return matrix;
}

function findPosition(matrix, char) {
    for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
            if (matrix[i][j] === char) {
                return [i, j];
            }
        }
    }
    return null;
}

function preparePlayfairText(text, forEncryption) {
    // Удаляем все кроме букв, переводим в верхний регистр
    text = text.toUpperCase().replace(/[^A-Z]/g, '');
    
    // Заменяем J на I
    text = text.replace(/J/g, 'I');
    
    if (forEncryption) {
        // Разбиваем на пары, добавляем X между одинаковыми буквами
        let prepared = '';
        let i = 0;
        
        while (i < text.length) {
            let first = text[i];
            let second = (i + 1 < text.length) ? text[i + 1] : 'X';
            
            if (first === second) {
                // Одинаковые буквы - вставляем X между ними
                prepared += first + 'X';
                i++; // Берём только первую букву, вторая остаётся на следующую итерацию
            } else {
                // Разные буквы - нормальная пара
                prepared += first + second;
                i += 2;
            }
        }
        
        // Если длина нечётная, добавляем X в конец
        if (prepared.length % 2 !== 0) {
            prepared += 'X';
        }
        
        return prepared;
    }
    
    return text;
}

function playfairEncrypt(text, key) {
    const matrix = createPlayfairMatrix(key);
    const prepared = preparePlayfairText(text, true);
    let result = '';
    
    for (let i = 0; i < prepared.length; i += 2) {
        const char1 = prepared[i];
        const char2 = prepared[i + 1];
        
        const [row1, col1] = findPosition(matrix, char1);
        const [row2, col2] = findPosition(matrix, char2);
        
        if (row1 === row2) {
            // Одна строка - сдвигаем вправо
            result += matrix[row1][(col1 + 1) % 5];
            result += matrix[row2][(col2 + 1) % 5];
        } else if (col1 === col2) {
            // Один столбец - сдвигаем вниз
            result += matrix[(row1 + 1) % 5][col1];
            result += matrix[(row2 + 1) % 5][col2];
        } else {
            // Прямоугольник - меняем столбцы
            result += matrix[row1][col2];
            result += matrix[row2][col1];
        }
    }
    
    return result;
}

function playfairDecrypt(text, key) {
    const matrix = createPlayfairMatrix(key);
    const prepared = preparePlayfairText(text, false);
    let result = '';
    
    for (let i = 0; i < prepared.length; i += 2) {
        const char1 = prepared[i];
        const char2 = prepared[i + 1];
        
        const [row1, col1] = findPosition(matrix, char1);
        const [row2, col2] = findPosition(matrix, char2);
        
        if (row1 === row2) {
            // Одна строка - сдвигаем влево
            result += matrix[row1][(col1 + 4) % 5];
            result += matrix[row2][(col2 + 4) % 5];
        } else if (col1 === col2) {
            // Один столбец - сдвигаем вверх
            result += matrix[(row1 + 4) % 5][col1];
            result += matrix[(row2 + 4) % 5][col2];
        } else {
            // Прямоугольник - меняем столбцы (операция симметрична)
            result += matrix[row1][col2];
            result += matrix[row2][col1];
        }
    }
    
    return result;
}

// ============================================================
// ШИФР ВИЖЕНЕРА С ПРОГРЕССИВНЫМ КЛЮЧОМ
// ============================================================

function prepareVigenereText(text) {
    // Удаляем все кроме русских букв, переводим в верхний регистр
    return text.toUpperCase().replace(/[^А-Я]/g, '');
}

function prepareVigenereKey(key) {
    return key.toUpperCase().replace(/[^А-Я]/g, '');
}

function getProgressiveKey(baseKey, keyUsageCount) {
    const alphabet = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
    let result = '';
    
    for (let char of baseKey) {
        const index = alphabet.indexOf(char);
        const newIndex = (index + keyUsageCount) % alphabet.length;
        result += alphabet[newIndex];
    }
    
    return result;
}

function vigenereEncrypt(text, baseKey) {
    const alphabet = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
    const prepared = prepareVigenereText(text);
    const preparedKey = prepareVigenereKey(baseKey);
    let result = '';
    let charCount = 0; // Счётчик обработанных символов
    
    for (let i = 0; i < prepared.length; i++) {
        const char = prepared[i];
        const charIndex = alphabet.indexOf(char);
        
        // Вычисляем, какой это "цикл" использования ключа
        const keyUsageCount = Math.floor(charCount / preparedKey.length);
        
        // Получаем прогрессивный ключ для текущего цикла
        const currentKey = getProgressiveKey(preparedKey, keyUsageCount);
        
        // Позиция в текущем ключе
        const keyPosition = charCount % preparedKey.length;
        const keyChar = currentKey[keyPosition];
        const keyCharIndex = alphabet.indexOf(keyChar);
        
        // Шифрование
        const encryptedIndex = (charIndex + keyCharIndex) % alphabet.length;
        result += alphabet[encryptedIndex];
        
        charCount++;
    }
    
    return result;
}

function vigenereDecrypt(text, baseKey) {
    const alphabet = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
    const prepared = prepareVigenereText(text);
    const preparedKey = prepareVigenereKey(baseKey);
    let result = '';
    let charCount = 0;
    
    for (let i = 0; i < prepared.length; i++) {
        const char = prepared[i];
        const charIndex = alphabet.indexOf(char);
        
        // Вычисляем, какой это "цикл" использования ключа
        const keyUsageCount = Math.floor(charCount / preparedKey.length);
        
        // Получаем прогрессивный ключ для текущего цикла
        const currentKey = getProgressiveKey(preparedKey, keyUsageCount);
        
        // Позиция в текущем ключе
        const keyPosition = charCount % preparedKey.length;
        const keyChar = currentKey[keyPosition];
        const keyCharIndex = alphabet.indexOf(keyChar);
        
        // Расшифрование
        const decryptedIndex = (charIndex - keyCharIndex + alphabet.length) % alphabet.length;
        result += alphabet[decryptedIndex];
        
        charCount++;
    }
    
    return result;
}

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ ОБРАБОТКИ
// ============================================================

function processText() {
    const inputText = document.getElementById('inputText').value;
    const key = document.getElementById('key').value;
    const cipher = document.querySelector('input[name="cipher"]:checked').value;
    const action = document.querySelector('input[name="action"]:checked').value;
    
    // Валидация
    if (!inputText.trim()) {
        showMessage('Введите текст для обработки', 'error');
        return;
    }
    
    if (!key.trim()) {
        showMessage('Введите ключ шифрования', 'error');
        return;
    }
    
    let result = '';
    
    try {
        if (cipher === 'playfair') {
            // Проверка ключа на английские буквы
            if (!/[A-Za-z]/.test(key)) {
                showMessage('Для шифра Плейфейра ключ должен содержать английские буквы', 'error');
                return;
            }
            
            if (action === 'encrypt') {
                result = playfairEncrypt(inputText, key);
            } else {
                result = playfairDecrypt(inputText, key);
            }
        } else if (cipher === 'vigenere') {
            // Проверка ключа на русские буквы
            if (!/[А-Яа-я]/.test(key)) {
                showMessage('Для шифра Виженера ключ должен содержать русские буквы', 'error');
                return;
            }
            
            if (action === 'encrypt') {
                result = vigenereEncrypt(inputText, key);
            } else {
                result = vigenereDecrypt(inputText, key);
            }
        }
        
        document.getElementById('outputText').value = result;
        showMessage('Текст успешно обработан', 'success');
        
    } catch (error) {
        showMessage('Ошибка при обработке текста: ' + error.message, 'error');
    }
}
