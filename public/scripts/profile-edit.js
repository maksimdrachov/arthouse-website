const bannerUpload = document.querySelector("[data-banner-upload]");
const bannerWarning = document.querySelector("[data-banner-warning]");

if (bannerUpload && bannerWarning) {
  const requiredWidth = Number.parseInt(bannerUpload.dataset.requiredWidth, 10);
  const requiredHeight = Number.parseInt(bannerUpload.dataset.requiredHeight, 10);
  const requiredSizeMessage = `Store banner must be exactly ${requiredWidth} x ${requiredHeight} pixels.`;

  const clearBannerWarning = () => {
    bannerWarning.hidden = true;
    bannerWarning.textContent = "";
    bannerUpload.setCustomValidity("");
  };

  const showBannerWarning = (message) => {
    bannerWarning.textContent = message;
    bannerWarning.hidden = false;
    bannerUpload.setCustomValidity(message);
  };

  bannerUpload.addEventListener("change", () => {
    const file = bannerUpload.files?.[0];

    if (!file) {
      clearBannerWarning();
      return;
    }

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    showBannerWarning("Checking banner dimensions...");

    image.addEventListener("load", () => {
      URL.revokeObjectURL(objectUrl);

      if (image.naturalWidth === requiredWidth && image.naturalHeight === requiredHeight) {
        clearBannerWarning();
        return;
      }

      showBannerWarning(
        `${requiredSizeMessage} Selected image is ${image.naturalWidth} x ${image.naturalHeight} pixels.`
      );
    });

    image.addEventListener("error", () => {
      URL.revokeObjectURL(objectUrl);
      showBannerWarning("Banner dimensions could not be checked. Please choose a valid image.");
    });

    image.src = objectUrl;
  });
}
