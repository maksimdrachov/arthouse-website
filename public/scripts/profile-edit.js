const bannerUpload = document.querySelector("[data-banner-upload]");
const bannerWarning = document.querySelector("[data-banner-warning]");
const bannerCropper = document.querySelector("[data-banner-cropper]");
const bannerCropCanvas = document.querySelector("[data-banner-crop-canvas]");
const bannerCropZoom = document.querySelector("[data-banner-crop-zoom]");
const bannerCropApply = document.querySelector("[data-banner-crop-apply]");

if (bannerUpload && bannerWarning && bannerCropper && bannerCropCanvas && bannerCropZoom && bannerCropApply) {
  const requiredWidth = Number.parseInt(bannerUpload.dataset.requiredWidth, 10);
  const requiredHeight = Number.parseInt(bannerUpload.dataset.requiredHeight, 10);
  const requiredSizeMessage = `Store banner must be exactly ${requiredWidth} x ${requiredHeight} pixels.`;
  const cropContext = bannerCropCanvas.getContext("2d");
  let activeImage = null;
  let activeFile = null;
  let baseScale = 1;
  let zoom = 1;
  let imageOffsetX = 0;
  let imageOffsetY = 0;
  let dragStart = null;
  let isApplyingCrop = false;

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

  const hideCropper = () => {
    bannerCropper.hidden = true;
    activeImage = null;
    activeFile = null;
    dragStart = null;
  };

  const clamp = (value, min, max) => {
    return Math.min(Math.max(value, min), max);
  };

  const currentScale = () => baseScale * zoom;

  const clampOffsets = () => {
    if (!activeImage) {
      return;
    }

    const scale = currentScale();
    const imageWidth = activeImage.naturalWidth * scale;
    const imageHeight = activeImage.naturalHeight * scale;
    const minOffsetX = requiredWidth - imageWidth;
    const minOffsetY = requiredHeight - imageHeight;

    imageOffsetX = imageWidth <= requiredWidth ? (requiredWidth - imageWidth) / 2 : clamp(imageOffsetX, minOffsetX, 0);
    imageOffsetY = imageHeight <= requiredHeight ? (requiredHeight - imageHeight) / 2 : clamp(imageOffsetY, minOffsetY, 0);
  };

  const drawCrop = () => {
    if (!activeImage || !cropContext) {
      return;
    }

    const scale = currentScale();
    cropContext.fillStyle = "#ffffff";
    cropContext.fillRect(0, 0, requiredWidth, requiredHeight);
    cropContext.drawImage(
      activeImage,
      imageOffsetX,
      imageOffsetY,
      activeImage.naturalWidth * scale,
      activeImage.naturalHeight * scale
    );
  };

  const setInitialCrop = (image) => {
    activeImage = image;
    baseScale = Math.max(requiredWidth / image.naturalWidth, requiredHeight / image.naturalHeight);
    zoom = 1;
    bannerCropZoom.value = "1";
    imageOffsetX = (requiredWidth - image.naturalWidth * currentScale()) / 2;
    imageOffsetY = (requiredHeight - image.naturalHeight * currentScale()) / 2;
    clampOffsets();
    drawCrop();
  };

  const createCroppedFile = (blob) => {
    const extensionlessName = activeFile?.name.replace(/\.[^.]+$/, "") || "banner";
    return new File([blob], `${extensionlessName}-banner.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now()
    });
  };

  const setBannerFile = (file) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    bannerUpload.files = dataTransfer.files;
  };

  const applyCrop = () => {
    if (!activeImage || !activeFile) {
      return;
    }

    bannerCropApply.disabled = true;
    isApplyingCrop = true;

    bannerCropCanvas.toBlob(
      (blob) => {
        isApplyingCrop = false;
        bannerCropApply.disabled = false;

        if (!blob) {
          showBannerWarning("Banner crop could not be created.");
          return;
        }

        setBannerFile(createCroppedFile(blob));
        hideCropper();
        clearBannerWarning();
      },
      "image/jpeg",
      0.92
    );
  };

  const loadSelectedImage = (file) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    showBannerWarning("Checking banner dimensions...");

    image.addEventListener("load", () => {
      URL.revokeObjectURL(objectUrl);

      if (image.naturalWidth === requiredWidth && image.naturalHeight === requiredHeight) {
        hideCropper();
        clearBannerWarning();
        return;
      }

      activeFile = file;
      bannerCropper.hidden = false;
      setInitialCrop(image);
      showBannerWarning(
        `${requiredSizeMessage} Selected image is ${image.naturalWidth} x ${image.naturalHeight} pixels. Apply crop before saving.`
      );
    });

    image.addEventListener("error", () => {
      URL.revokeObjectURL(objectUrl);
      hideCropper();
      showBannerWarning("Banner dimensions could not be checked. Please choose a valid image.");
    });

    image.src = objectUrl;
  };

  bannerUpload.addEventListener("change", () => {
    if (isApplyingCrop) {
      return;
    }

    const file = bannerUpload.files?.[0];

    if (!file) {
      hideCropper();
      clearBannerWarning();
      return;
    }

    loadSelectedImage(file);
  });

  bannerCropZoom.addEventListener("input", () => {
    if (!activeImage) {
      return;
    }

    const previousScale = currentScale();
    const centerX = requiredWidth / 2;
    const centerY = requiredHeight / 2;
    const imageCenterX = (centerX - imageOffsetX) / previousScale;
    const imageCenterY = (centerY - imageOffsetY) / previousScale;

    zoom = Number.parseFloat(bannerCropZoom.value);

    const nextScale = currentScale();
    imageOffsetX = centerX - imageCenterX * nextScale;
    imageOffsetY = centerY - imageCenterY * nextScale;
    clampOffsets();
    drawCrop();
  });

  bannerCropCanvas.addEventListener("pointerdown", (event) => {
    if (!activeImage) {
      return;
    }

    bannerCropCanvas.setPointerCapture(event.pointerId);
    dragStart = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      imageOffsetX,
      imageOffsetY
    };
  });

  bannerCropCanvas.addEventListener("pointermove", (event) => {
    if (!dragStart || dragStart.pointerId !== event.pointerId) {
      return;
    }

    const bounds = bannerCropCanvas.getBoundingClientRect();
    const scaleX = requiredWidth / bounds.width;
    const scaleY = requiredHeight / bounds.height;
    imageOffsetX = dragStart.imageOffsetX + (event.clientX - dragStart.x) * scaleX;
    imageOffsetY = dragStart.imageOffsetY + (event.clientY - dragStart.y) * scaleY;
    clampOffsets();
    drawCrop();
  });

  bannerCropCanvas.addEventListener("pointerup", (event) => {
    if (dragStart?.pointerId === event.pointerId) {
      dragStart = null;
    }
  });

  bannerCropCanvas.addEventListener("pointercancel", () => {
    dragStart = null;
  });

  bannerCropApply.addEventListener("click", applyCrop);
}
