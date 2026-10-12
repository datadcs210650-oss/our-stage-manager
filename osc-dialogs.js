/* OSC — in-app dialog manager. All content is inserted as text, never HTML. */
(function () {
  "use strict";
  if (window.oscConfirm || window.oscPrompt || window.oscAlert) return;

  var queue = [];
  var active = false;
  var sequence = 0;

  function titleFor(kind) {
    return kind === "confirm" ? "Xác nhận thao tác" : kind === "prompt" ? "Nhập thông tin" : "Thông báo";
  }

  function actionFor(kind, message) {
    if (kind === "alert") return "Đã hiểu";
    if (kind === "prompt") return "Lưu thông tin";
    var text = String(message || "").toLocaleLowerCase("vi");
    if (text.startsWith("mở khóa")) return "Mở khóa";
    if (text.startsWith("khóa cột")) return "Khóa cột";
    if (text.startsWith("khóa toàn bộ")) return "Khóa học kỳ";
    if (text.startsWith("xóa") || text.startsWith("chuyển") ||
        text.startsWith("đưa toàn bộ") || text.startsWith("xóa vĩnh viễn")) return "Xác nhận xóa";
    return "Xác nhận";
  }

  function next() {
    if (active || !queue.length) return;
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", next, { once: true });
      return;
    }

    active = true;
    var job = queue.shift();
    var id = "osc-dialog-" + (++sequence);
    var previousFocus = document.activeElement;
    var backdrop = document.createElement("div");
    backdrop.className = "osc-dialog-backdrop";
    var panel = document.createElement("section");
    panel.className = "osc-dialog-panel";
    panel.setAttribute("role", job.kind === "prompt" ? "dialog" : "alertdialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", id + "-title");
    panel.setAttribute("aria-describedby", id + "-message");
    panel.setAttribute("tabindex", "-1");

    var top = document.createElement("div");
    top.className = "osc-dialog-heading";
    var badge = document.createElement("div");
    badge.className = "osc-dialog-symbol";
    badge.setAttribute("aria-hidden", "true");
    badge.textContent = job.kind === "confirm" ? "?" : job.kind === "prompt" ? "✎" : "i";
    var heading = document.createElement("div");
    var eyebrow = document.createElement("span");
    eyebrow.className = "osc-dialog-eyebrow";
    eyebrow.textContent = "OUR STAGE CLUB";
    var title = document.createElement("h2");
    title.className = "osc-dialog-title";
    title.id = id + "-title";
    title.textContent = titleFor(job.kind);
    heading.appendChild(eyebrow);
    heading.appendChild(title);
    top.appendChild(badge);
    top.appendChild(heading);

    var message = document.createElement("p");
    message.className = "osc-dialog-message";
    message.id = id + "-message";
    message.textContent = job.message;

    panel.appendChild(top);
    panel.appendChild(message);

    var field = null;
    if (job.kind === "prompt") {
      field = document.createElement("input");
      field.className = "osc-dialog-input";
      field.type = "text";
      field.value = job.defaultValue;
      field.setAttribute("aria-label", job.message);
      field.setAttribute("autocomplete", "off");
      panel.appendChild(field);
    }

    var footer = document.createElement("div");
    footer.className = "osc-dialog-actions";
    var cancel = null;
    if (job.kind !== "alert") {
      cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "osc-dialog-btn osc-dialog-btn-cancel";
      cancel.textContent = "Hủy";
      footer.appendChild(cancel);
    }
    var accept = document.createElement("button");
    accept.type = "button";
    accept.className = "osc-dialog-btn osc-dialog-btn-accept";
    accept.textContent = actionFor(job.kind, job.message);
    footer.appendChild(accept);
    panel.appendChild(footer);
    backdrop.appendChild(panel);

    var settled = false;
    function close(result) {
      if (settled) return;
      settled = true;
      document.removeEventListener("keydown", onKeydown, true);
      backdrop.remove();
      active = false;
      job.resolve(result);
      if (previousFocus && previousFocus.isConnected &&
          typeof previousFocus.focus === "function") {
        try { previousFocus.focus({ preventScroll: true }); } catch (_) {}
      }
      queueMicrotask(next);
    }

    function cancelResult() {
      return job.kind === "confirm" ? false : job.kind === "prompt" ? null : undefined;
    }
    function acceptResult() {
      return job.kind === "confirm" ? true : job.kind === "prompt" ? field.value : undefined;
    }

    function onKeydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close(cancelResult());
      } else if (event.key === "Tab") {
        var focusable = cancel ? [field, cancel, accept].filter(Boolean) : [accept];
        var first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
          event.preventDefault(); first.focus();
        }
      } else if (event.key === "Enter" && job.kind === "prompt" && document.activeElement === field) {
        event.preventDefault(); close(acceptResult());
      }
    }

    if (cancel) cancel.addEventListener("click", function () { close(cancelResult()); });
    accept.addEventListener("click", function () { close(acceptResult()); });
    document.body.appendChild(backdrop);
    document.addEventListener("keydown", onKeydown, true);
    if (field) {
      field.focus();
      field.select();
    } else if (cancel) {
      cancel.focus(); /* Default focus stays on the safe option for destructive actions. */
    } else {
      accept.focus();
    }
  }

  function request(kind, message, defaultValue) {
    return new Promise(function (resolve) {
      queue.push({
        kind: kind,
        message: String(message == null ? "" : message),
        defaultValue: String(defaultValue == null ? "" : defaultValue),
        resolve: resolve
      });
      next();
    });
  }

  window.oscConfirm = function (message) { return request("confirm", message); };
  window.oscAlert = function (message) { return request("alert", message); };
  window.oscPrompt = function (message, defaultValue) { return request("prompt", message, defaultValue); };
})();