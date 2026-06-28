const homeItemGrid = document.querySelector("[data-home-item-grid]");
const homeLoadMoreButton = document.querySelector("[data-home-load-more]");

if (homeItemGrid && homeLoadMoreButton) {
  const getLoadedItemIds = () => {
    return [...homeItemGrid.querySelectorAll("[data-home-item-id]")]
      .map((item) => item.dataset.homeItemId)
      .filter(Boolean);
  };

  const setLoading = (isLoading) => {
    homeLoadMoreButton.disabled = isLoading;
    homeLoadMoreButton.textContent = isLoading ? "loading..." : "load more";
  };

  const createTextSpan = (className, text) => {
    const span = document.createElement("span");
    span.className = className;
    span.textContent = text;
    return span;
  };

  const createItemCard = (item) => {
    const card = document.createElement("a");
    card.className = "public-item-card";
    card.href = item.href;
    card.dataset.homeItemId = String(item.id);

    const photo = document.createElement("span");
    photo.className = "public-item-photo";

    if (item.primaryPhotoPath) {
      const image = document.createElement("img");
      image.src = item.primaryPhotoPath;
      image.alt = "";
      photo.append(image);
    } else {
      photo.textContent = "No photo";
    }

    card.append(photo, createTextSpan("public-item-name", item.name));

    if (item.artistName) {
      card.append(createTextSpan("public-item-artist", item.artistName));
    }

    card.append(createTextSpan("public-item-price", item.priceDisplay));

    return card;
  };

  homeLoadMoreButton.addEventListener("click", async () => {
    const url = new URL(
      homeLoadMoreButton.dataset.homeLoadMoreUrl || "/api/home-items",
      window.location.origin
    );
    url.searchParams.set("exclude", getLoadedItemIds().join(","));
    setLoading(true);

    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`Load more request failed with status ${response.status}.`);
      }

      const data = await response.json();
      const items = Array.isArray(data.items) ? data.items : [];
      const fragment = document.createDocumentFragment();

      for (const item of items) {
        fragment.append(createItemCard(item));
      }

      homeItemGrid.append(fragment);

      if (!data.hasMoreItems || items.length === 0) {
        homeLoadMoreButton.closest(".home-load-more-actions")?.remove();
        return;
      }

      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  });
}
