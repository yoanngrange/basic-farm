// Plain vanilla JS, loaded directly on static listing pages. The
// Turnstile widget is only rendered on demand (button click), not on
// page load — reduces third-party script weight for visitors who never
// need the contact info, and keeps the button meaningful (an explicit
// user action, not an auto-triggered check).
(function () {
  var container = document.getElementById("reveal-contact");
  if (!container) return;

  var listingId = container.getAttribute("data-listing-id");
  var apiBase = container.getAttribute("data-api-base");
  var siteKey = container.getAttribute("data-site-key");
  var btn = document.getElementById("reveal-btn");
  var turnstileEl = document.getElementById("turnstile-container");
  var resultEl = document.getElementById("reveal-result");
  var errorEl = document.getElementById("reveal-error");
  var rendered = false;

  function showError(message) {
    errorEl.hidden = false;
    errorEl.textContent = message;
    btn.hidden = false;
    btn.disabled = false;
    rendered = false;
  }

  function fetchContact(captchaToken) {
    fetch(apiBase + "/jobs/listings/" + listingId + "/reveal-contact?captchaToken=" + encodeURIComponent(captchaToken))
      .then(function (res) {
        if (!res.ok) throw new Error("verification failed");
        return res.json();
      })
      .then(function (data) {
        var parts = [];
        if (data.email) parts.push(data.email);
        if (data.phone) parts.push(data.phone);
        resultEl.textContent = parts.length ? parts.join(" — ") : resultEl.getAttribute("data-no-info-text");
        resultEl.hidden = false;
        turnstileEl.hidden = true;
      })
      .catch(function () {
        showError(errorEl.getAttribute("data-error-text"));
      });
  }

  function renderWidget() {
    turnstileEl.hidden = false;
    window.turnstile.render(turnstileEl, {
      sitekey: siteKey,
      callback: fetchContact,
      "error-callback": function () {
        showError(errorEl.getAttribute("data-error-text"));
      },
    });
  }

  btn.addEventListener("click", function () {
    if (rendered) return;
    rendered = true;
    btn.disabled = true;
    errorEl.hidden = true;

    if (window.turnstile) {
      renderWidget();
      return;
    }
    // The Cloudflare script loads async — poll briefly for it.
    var attempts = 0;
    var interval = setInterval(function () {
      attempts++;
      if (window.turnstile) {
        clearInterval(interval);
        renderWidget();
      } else if (attempts > 20) {
        clearInterval(interval);
        showError(errorEl.getAttribute("data-error-text"));
      }
    }, 250);
  });
})();
