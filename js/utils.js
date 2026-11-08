export function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

export function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit", month: "long", year: "numeric"
  }).format(date);
}

export function showMessage(message, type = "info") {
  let node = document.querySelector("#ttfbbToast");
  if (!node) {
    node = document.createElement("div");
    node.id = "ttfbbToast";
    node.className = "ttfbb-toast";
    node.setAttribute("role", "status");
    document.body.append(node);
  }
  node.dataset.type = type;
  node.textContent = message;
  node.classList.add("is-visible");
  window.clearTimeout(showMessage.timer);
  showMessage.timer = window.setTimeout(() => node.classList.remove("is-visible"), 4000);
}
