for (const carousel of document.querySelectorAll("[data-carousel]")) {
  const slides = [...carousel.querySelectorAll("[data-carousel-slide]")];

  if (!slides.length) {
    continue;
  }

  const previousButton = carousel.querySelector("[data-carousel-prev]");
  const nextButton = carousel.querySelector("[data-carousel-next]");
  const count = carousel.querySelector("[data-carousel-count]");
  const fullscreenButton = carousel.querySelector("[data-product-fullscreen-open]");
  let activeIndex = 0;
  let previousFocus = null;
  let fullscreen = null;
  let fullscreenCloseButton = null;
  let fullscreenImage = null;
  let fullscreenPreviousButton = null;
  let fullscreenNextButton = null;

  const render = () => {
    slides.forEach((slide, index) => {
      slide.classList.toggle("is-active", index === activeIndex);
    });

    if (count) {
      count.textContent = `${activeIndex + 1} / ${slides.length}`;
    }
  };

  const setActiveIndex = (nextIndex) => {
    activeIndex = (nextIndex + slides.length) % slides.length;
    render();
  };

  const renderFullscreen = () => {
    if (!fullscreenImage) {
      return;
    }

    const activeSlide = slides[activeIndex];
    fullscreenImage.src = activeSlide.currentSrc || activeSlide.src;
    fullscreenImage.alt = activeSlide.alt;

    const hasMultipleSlides = slides.length > 1;
    fullscreenPreviousButton.hidden = !hasMultipleSlides;
    fullscreenNextButton.hidden = !hasMultipleSlides;
  };

  const closeFullscreen = () => {
    if (!fullscreen || fullscreen.hidden) {
      return;
    }

    fullscreen.hidden = true;
    document.body.classList.remove("has-product-fullscreen");
    document.removeEventListener("keydown", handleFullscreenKeydown);
    previousFocus?.focus();
  };

  const moveFullscreen = (step) => {
    setActiveIndex(activeIndex + step);
    renderFullscreen();
  };

  function handleFullscreenKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeFullscreen();
      return;
    }

    if (event.key === "ArrowLeft" && slides.length > 1) {
      event.preventDefault();
      moveFullscreen(-1);
      return;
    }

    if (event.key === "ArrowRight" && slides.length > 1) {
      event.preventDefault();
      moveFullscreen(1);
    }
  }

  const createFullscreen = () => {
    fullscreen = document.createElement("div");
    fullscreen.className = "product-fullscreen";
    fullscreen.hidden = true;
    fullscreen.tabIndex = -1;
    fullscreen.setAttribute("role", "dialog");
    fullscreen.setAttribute("aria-modal", "true");
    fullscreen.setAttribute("aria-label", "Product photo");

    fullscreenCloseButton = document.createElement("button");
    fullscreenCloseButton.className = "product-fullscreen-close";
    fullscreenCloseButton.type = "button";
    fullscreenCloseButton.setAttribute("aria-label", "Close fullscreen photo");
    fullscreenCloseButton.textContent = "X";

    fullscreenPreviousButton = document.createElement("button");
    fullscreenPreviousButton.className = "product-fullscreen-prev";
    fullscreenPreviousButton.type = "button";
    fullscreenPreviousButton.setAttribute("aria-label", "Previous photo");
    fullscreenPreviousButton.textContent = "<";

    fullscreenImage = document.createElement("img");
    fullscreenImage.className = "product-fullscreen-image";
    fullscreenImage.alt = "";

    fullscreenNextButton = document.createElement("button");
    fullscreenNextButton.className = "product-fullscreen-next";
    fullscreenNextButton.type = "button";
    fullscreenNextButton.setAttribute("aria-label", "Next photo");
    fullscreenNextButton.textContent = ">";

    fullscreenCloseButton.addEventListener("click", closeFullscreen);
    fullscreenPreviousButton.addEventListener("click", () => moveFullscreen(-1));
    fullscreenNextButton.addEventListener("click", () => moveFullscreen(1));
    fullscreen.addEventListener("click", (event) => {
      if (event.target === fullscreen) {
        closeFullscreen();
      }
    });

    fullscreen.append(
      fullscreenCloseButton,
      fullscreenPreviousButton,
      fullscreenImage,
      fullscreenNextButton
    );
    document.body.append(fullscreen);
  };

  const openFullscreen = () => {
    if (!fullscreen) {
      createFullscreen();
    }

    previousFocus = document.activeElement;
    renderFullscreen();
    fullscreen.hidden = false;
    document.body.classList.add("has-product-fullscreen");
    document.addEventListener("keydown", handleFullscreenKeydown);
    fullscreenCloseButton.focus();
  };

  previousButton?.addEventListener("click", () => {
    setActiveIndex(activeIndex - 1);
  });

  nextButton?.addEventListener("click", () => {
    setActiveIndex(activeIndex + 1);
  });

  fullscreenButton?.addEventListener("click", () => {
    openFullscreen();
  });

  render();
}
