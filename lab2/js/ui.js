// Собирает ссылки на DOM-элементы интерфейса.
export function getUi() {
  return {
    seedInput: document.getElementById("seedInput"),
    seedHint: document.getElementById("seedHint"),
    tapsInput: document.getElementById("tapsInput"),
    keyPreviewBits: document.getElementById("keyPreviewBits"),
    setOnesBtn: document.getElementById("setOnesBtn"),
    fileInput: document.getElementById("fileInput"),
    encryptBtn: document.getElementById("encryptBtn"),
    decryptBtn: document.getElementById("decryptBtn"),
    status: document.getElementById("status"),
    keyBitsOut: document.getElementById("keyBitsOut"),
    srcBitsOut: document.getElementById("srcBitsOut"),
    dstBitsOut: document.getElementById("dstBitsOut"),
    downloadLink: document.getElementById("downloadLink"),
  };
}

// Показывает пользователю статус операции (успех/ошибка).
export function setStatus(ui, text, isError = false) {
  ui.status.textContent = text;
  ui.status.style.color = isError ? "#b91c1c" : "#0f766e";
}
