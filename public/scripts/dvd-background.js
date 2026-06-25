const dvdTemplate = document.querySelector("[data-dvd-bouncer]");
const dvdLayer = document.querySelector("[data-dvd-layer]");

if (dvdTemplate && dvdLayer) {
  const trailLength = 12;
  const trailSampleSeconds = 0.08;
  const maxLogos = 64;
  const spawnInset = 2;
  const normalLogo = {
    element: dvdTemplate,
    x: 24,
    y: 24,
    velocityX: 135,
    velocityY: 95
  };
  const thirdEyeLogos = [];
  let previousTime = 0;
  let thirdEyeOpen = false;

  const getLogoSize = () => {
    const rect = dvdTemplate.getBoundingClientRect();

    return {
      width: rect.width || 240,
      height: rect.height || 105
    };
  };

  const getBounds = () => {
    const size = getLogoSize();

    return {
      width: size.width,
      height: size.height,
      maxX: Math.max(0, window.innerWidth - size.width),
      maxY: Math.max(0, window.innerHeight - size.height)
    };
  };

  const moveElement = (element, x, y, opacity = 0.7) => {
    element.style.opacity = opacity.toString();
    element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  const makeLogoElement = (isTrail = false) => {
    const element = dvdTemplate.cloneNode(true);
    element.removeAttribute("data-dvd-bouncer");
    element.alt = "";

    if (isTrail) {
      element.classList.add("dvd-video-trail");
    }

    dvdLayer.append(element);
    return element;
  };

  const makeTrail = () => {
    return Array.from({ length: trailLength }, () => makeLogoElement(true));
  };

  const makeThirdEyeLogo = (x, y, velocityX, velocityY) => ({
    element: makeLogoElement(),
    mirrorElement: makeLogoElement(),
    trail: makeTrail(),
    mirrorTrail: makeTrail(),
    history: [],
    trailElapsed: 0,
    spawnCooldown: 0,
    x,
    y,
    velocityX,
    velocityY
  });

  const removeThirdEyeLogos = () => {
    for (const logo of thirdEyeLogos.splice(0)) {
      logo.element.remove();
      logo.mirrorElement.remove();
      logo.trail.forEach((element) => element.remove());
      logo.mirrorTrail.forEach((element) => element.remove());
    }
  };

  const clampLogo = (logo) => {
    const bounds = getBounds();
    logo.x = Math.min(Math.max(0, logo.x), bounds.maxX);
    logo.y = Math.min(Math.max(0, logo.y), bounds.maxY);
  };

  const spawnOppositeLogo = (sourceLogo, bouncedX, bouncedY) => {
    if (!thirdEyeOpen || thirdEyeLogos.length >= maxLogos) {
      return;
    }

    const bounds = getBounds();
    let spawnX = sourceLogo.x;
    let spawnY = sourceLogo.y;
    let spawnVelocityX = -sourceLogo.velocityX;
    let spawnVelocityY = -sourceLogo.velocityY;

    if (bouncedX) {
      spawnVelocityX = sourceLogo.velocityX;
      spawnX = sourceLogo.x <= 0 ? spawnInset : bounds.maxX - spawnInset;
    }

    if (bouncedY) {
      spawnVelocityY = sourceLogo.velocityY;
      spawnY = sourceLogo.y <= 0 ? spawnInset : bounds.maxY - spawnInset;
    }

    const spawnedLogo = makeThirdEyeLogo(
      Math.min(Math.max(0, spawnX), bounds.maxX),
      Math.min(Math.max(0, spawnY), bounds.maxY),
      spawnVelocityX,
      spawnVelocityY
    );
    spawnedLogo.history = [...sourceLogo.history];

    thirdEyeLogos.push(spawnedLogo);
  };

  const renderThirdEyeLogo = (logo) => {
    const bounds = getBounds();
    const mirroredX = bounds.maxX - logo.x;

    moveElement(logo.element, logo.x, logo.y);
    moveElement(logo.mirrorElement, mirroredX, logo.y);

    logo.trail.forEach((element, index) => {
      const point = logo.history[index];
      const opacity = Math.max(0.06, 0.42 - index * 0.03);

      if (!point) {
        moveElement(element, logo.x, logo.y, 0);
        return;
      }

      moveElement(element, point.x, point.y, opacity);
    });

    logo.mirrorTrail.forEach((element, index) => {
      const point = logo.history[index];
      const opacity = Math.max(0.06, 0.42 - index * 0.03);

      if (!point) {
        moveElement(element, mirroredX, logo.y, 0);
        return;
      }

      moveElement(element, bounds.maxX - point.x, point.y, opacity);
    });
  };

  const updateNormalMode = (elapsedSeconds) => {
    normalLogo.x += normalLogo.velocityX * elapsedSeconds;
    normalLogo.y += normalLogo.velocityY * elapsedSeconds;

    const bounds = getBounds();

    if (normalLogo.x <= 0 || normalLogo.x >= bounds.maxX) {
      normalLogo.x = Math.min(Math.max(0, normalLogo.x), bounds.maxX);
      normalLogo.velocityX *= -1;
    }

    if (normalLogo.y <= 0 || normalLogo.y >= bounds.maxY) {
      normalLogo.y = Math.min(Math.max(0, normalLogo.y), bounds.maxY);
      normalLogo.velocityY *= -1;
    }

    moveElement(normalLogo.element, normalLogo.x, normalLogo.y);
  };

  const updateThirdEyeMode = (elapsedSeconds) => {
    for (const logo of [...thirdEyeLogos]) {
      logo.spawnCooldown = Math.max(0, logo.spawnCooldown - elapsedSeconds);
      logo.trailElapsed += elapsedSeconds;
      if (logo.trailElapsed >= trailSampleSeconds) {
        logo.trailElapsed = 0;
        logo.history.unshift({ x: logo.x, y: logo.y });
        logo.history = logo.history.slice(0, trailLength);
      }

      logo.x += logo.velocityX * elapsedSeconds;
      logo.y += logo.velocityY * elapsedSeconds;

      const bounds = getBounds();
      let bouncedX = false;
      let bouncedY = false;

      if (logo.x <= 0 || logo.x >= bounds.maxX) {
        logo.x = Math.min(Math.max(0, logo.x), bounds.maxX);
        logo.velocityX *= -1;
        bouncedX = true;
      }

      if (logo.y <= 0 || logo.y >= bounds.maxY) {
        logo.y = Math.min(Math.max(0, logo.y), bounds.maxY);
        logo.velocityY *= -1;
        bouncedY = true;
      }

      if ((bouncedX || bouncedY) && logo.spawnCooldown === 0) {
        logo.spawnCooldown = 0.12;
        spawnOppositeLogo(logo, bouncedX, bouncedY);
      }

      renderThirdEyeLogo(logo);
    }
  };

  const setThirdEyeMode = (isOpen) => {
    thirdEyeOpen = isOpen;

    if (thirdEyeOpen) {
      normalLogo.element.style.opacity = "0";
      removeThirdEyeLogos();
      thirdEyeLogos.push(
        makeThirdEyeLogo(normalLogo.x, normalLogo.y, normalLogo.velocityX, normalLogo.velocityY)
      );
      thirdEyeLogos.forEach(renderThirdEyeLogo);
      return;
    }

    const activeLogo = thirdEyeLogos[0];
    if (activeLogo) {
      normalLogo.x = activeLogo.x;
      normalLogo.y = activeLogo.y;
      normalLogo.velocityX = activeLogo.velocityX;
      normalLogo.velocityY = activeLogo.velocityY;
    }

    removeThirdEyeLogos();
    normalLogo.element.style.opacity = "0.7";
    clampLogo(normalLogo);
    moveElement(normalLogo.element, normalLogo.x, normalLogo.y);
  };

  const animate = (time) => {
    if (!previousTime) {
      previousTime = time;
    }

    const elapsedSeconds = Math.min((time - previousTime) / 1000, 0.05);
    previousTime = time;

    if (thirdEyeOpen) {
      updateThirdEyeMode(elapsedSeconds);
    } else {
      updateNormalMode(elapsedSeconds);
    }

    requestAnimationFrame(animate);
  };

  const start = () => {
    const bounds = getBounds();
    normalLogo.x = Math.max(0, bounds.maxX / 2 - 80);
    normalLogo.y = 24;
    moveElement(normalLogo.element, normalLogo.x, normalLogo.y);
    requestAnimationFrame(animate);
  };

  window.addEventListener("resize", () => {
    clampLogo(normalLogo);
    thirdEyeLogos.forEach(clampLogo);

    if (thirdEyeOpen) {
      thirdEyeLogos.forEach(renderThirdEyeLogo);
    } else {
      moveElement(normalLogo.element, normalLogo.x, normalLogo.y);
    }
  });

  window.addEventListener("third-eye-change", (event) => {
    setThirdEyeMode(Boolean(event.detail?.open));
  });

  if (dvdTemplate.complete) {
    start();
  } else {
    dvdTemplate.addEventListener("load", start, { once: true });
  }
}
