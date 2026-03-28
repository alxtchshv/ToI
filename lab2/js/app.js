import { DEFAULT_SEED, DEFAULT_TAPS, REGISTER_SIZE } from "./constants.js";
import { sanitizeBitString, normalizeSeed } from "./lfsr.js";
import { xorTransform } from "./crypto.js";
import { filePreviewBitString, bitArrayToString, symmetricPreview } from "./binary.js";
import { getUi, setStatus } from "./ui.js";

const ui = getUi();

// Фильтрует ввод seed до 0/1 и обновляет подсказку по текущей длине.
function cleanSeedInput() {
  const cleaned = sanitizeBitString(ui.seedInput.value).slice(0, REGISTER_SIZE);
  if (cleaned !== ui.seedInput.value) {
    ui.seedInput.value = cleaned;
  }
  ui.seedHint.textContent = `Длина: ${cleaned.length}/${REGISTER_SIZE}`;
}

// Возвращает seed нужной длины; недостающие биты дополняются нулями.
function getInputSeed() {
  const filtered = sanitizeBitString(ui.seedInput.value).slice(0, REGISTER_SIZE);
  if (filtered.length < REGISTER_SIZE) {
    // По условию недостающие биты добиваются нулями.
    return filtered.padEnd(REGISTER_SIZE, "0");
  }
  return filtered;
}

// Формирует имя файла результата с пометкой режима enc/dec.
function makeOutputFilename(originalName, mode) {
  const dot = originalName.lastIndexOf(".");
  if (dot === -1) return `${originalName}.${mode}.bin`;
  const base = originalName.slice(0, dot);
  const ext = originalName.slice(dot);
  return `${base}.${mode}${ext}`;
}

// Считывает выбранный файл, применяет XOR-шифрование/дешифрование и готовит скачивание.
async function processFile(mode) {
  const file = ui.fileInput.files?.[0];
  if (!file) {
    setStatus(ui, "Сначала выбери файл.", true);
    return;
  }

  const seed = normalizeSeed(getInputSeed());
  if (/^0+$/.test(seed)) {
    setStatus(ui, "Ключ из одних 0 запрещен. Используй хотя бы одну 1.", true);
    return;
  }

  const taps = DEFAULT_TAPS;
  const previewBitsCount = Number(ui.keyPreviewBits.value) || 128;

  const arrayBuffer = await file.arrayBuffer();
  const sourceBytes = new Uint8Array(arrayBuffer);
  const { outputBytes, keyBits } = xorTransform(sourceBytes, seed, taps);

  const sourceBitsPreview = filePreviewBitString(sourceBytes);
  const outBitsPreview = filePreviewBitString(outputBytes);
  const keyBitsString = bitArrayToString(keyBits);
  const keySymmetricPreview = symmetricPreview(keyBitsString, previewBitsCount);

  ui.srcBitsOut.textContent = sourceBitsPreview || "(пустой файл)";
  ui.dstBitsOut.textContent = outBitsPreview || "(пустой файл)";
  ui.keyBitsOut.textContent = keySymmetricPreview || "(нет ключа)";

  const blob = new Blob([outputBytes], { type: "application/octet-stream" });
  const href = URL.createObjectURL(blob);
  ui.downloadLink.href = href;
  ui.downloadLink.download = makeOutputFilename(file.name, mode);
  ui.downloadLink.classList.remove("disabled");

  setStatus(
    ui,
    `${mode === "enc" ? "Шифрование" : "Дешифрование"} завершено. Размер: ${
      sourceBytes.length
    } байт.`
  );
}

// Инициализирует форму и обработчики событий интерфейса.
function init() {
  ui.seedInput.value = DEFAULT_SEED;
  cleanSeedInput();

  ui.seedInput.addEventListener("input", cleanSeedInput);

  ui.setOnesBtn.addEventListener("click", () => {
    ui.seedInput.value = "1".repeat(REGISTER_SIZE);
    cleanSeedInput();
    setStatus(ui, "Начальное состояние установлено: все единицы.");
  });

  ui.encryptBtn.addEventListener("click", async () => {
    try {
      await processFile("enc");
    } catch (err) {
      setStatus(ui, `Ошибка: ${err.message}`, true);
    }
  });

  ui.decryptBtn.addEventListener("click", async () => {
    try {
      await processFile("dec");
    } catch (err) {
      setStatus(ui, `Ошибка: ${err.message}`, true);
    }
  });
}

init();
