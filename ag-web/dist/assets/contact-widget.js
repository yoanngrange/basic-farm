// Plain vanilla JS, loaded directly (no bundler) on static listing pages.
// Progressive enhancement: the form still exists without JS, it just
// won't submit anywhere — acceptable since candidates need no account
// and this is the only interactive bit on an otherwise static page.
(function () {
  var widget = document.getElementById("contact-widget");
  if (!widget) return;

  var listingId = widget.getAttribute("data-listing-id");
  var apiBase = widget.getAttribute("data-api-base");
  var form = document.getElementById("contact-form");
  var successEl = document.getElementById("contact-success");
  var errorEl = document.getElementById("contact-error");

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    errorEl.hidden = true;
    successEl.hidden = true;

    var formData = new FormData(form);
    var payload = {
      contactType: "contact_form",
      candidateEmail: formData.get("email"),
      message: formData.get("message") || undefined,
    };

    fetch(apiBase + "/jobs/listings/" + listingId + "/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        if (!res.ok) throw new Error("request failed");
        successEl.hidden = false;
        form.reset();
      })
      .catch(function () {
        errorEl.hidden = false;
        errorEl.textContent = "Something went wrong, please try again.";
      });
  });
})();
