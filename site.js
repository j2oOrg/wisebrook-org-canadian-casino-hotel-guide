(function () {
  "use strict";

  const navToggle = document.querySelector("[data-nav-toggle]");
  const navLinks = document.querySelector("[data-nav-links]");

  if (navToggle && navLinks) {
    const openLabel = navToggle.getAttribute("data-open-label") || "Open navigation";
    const closeLabel = navToggle.getAttribute("data-close-label") || "Close navigation";

    const closeNavigation = (restoreFocus = false) => {
      navToggle.setAttribute("aria-expanded", "false");
      navToggle.setAttribute("aria-label", openLabel);
      navLinks.classList.remove("is-open");
      document.body.classList.remove("nav-open");

      if (restoreFocus) {
        navToggle.focus();
      }
    };

    navToggle.addEventListener("click", () => {
      const opening = navToggle.getAttribute("aria-expanded") !== "true";
      navToggle.setAttribute("aria-expanded", String(opening));
      navToggle.setAttribute("aria-label", opening ? closeLabel : openLabel);
      navLinks.classList.toggle("is-open", opening);
      document.body.classList.toggle("nav-open", opening);

      if (opening) {
        navLinks.querySelector("a[href]")?.focus();
      }
    });

    navLinks.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("a[href]")) {
        closeNavigation();
      }
    });

    document.addEventListener("click", (event) => {
      if (
        navToggle.getAttribute("aria-expanded") === "true" &&
        !navLinks.contains(event.target) &&
        !navToggle.contains(event.target)
      ) {
        closeNavigation();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && navToggle.getAttribute("aria-expanded") === "true") {
        closeNavigation(true);
      }
    });

    const desktopNavigation = window.matchMedia("(min-width: 48.8125rem)");
    desktopNavigation.addEventListener("change", (event) => {
      if (event.matches) {
        closeNavigation();
      }
    });
  }

  document.querySelectorAll("[data-register]").forEach((register) => {
    const tabs = Array.from(register.querySelectorAll("[data-property-tab], [role='tab']"));
    const panels = Array.from(register.querySelectorAll("[data-property-panel], [role='tabpanel']"));

    if (!tabs.length || !panels.length) {
      return;
    }

    const panelForTab = (tab, index) => {
      const controlledId = tab.getAttribute("aria-controls") || tab.getAttribute("data-property-tab");
      const normalizedId = controlledId?.replace(/^#/, "");
      return (
        (normalizedId && document.getElementById(normalizedId)) ||
        panels.find((panel) => panel.getAttribute("data-property-panel") === normalizedId) ||
        panels[index] ||
        null
      );
    };

    const activateTab = (nextTab, moveFocus = true) => {
      tabs.forEach((tab, index) => {
        const selected = tab === nextTab;
        const panel = panelForTab(tab, index);

        tab.setAttribute("aria-selected", String(selected));
        tab.setAttribute("tabindex", selected ? "0" : "-1");
        if (panel) {
          panel.hidden = !selected;
        }
      });

      if (moveFocus) {
        nextTab.focus();
      }
    };

    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => activateTab(tab, false));
      tab.addEventListener("keydown", (event) => {
        let nextIndex = index;

        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          nextIndex = (index + 1) % tabs.length;
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          nextIndex = (index - 1 + tabs.length) % tabs.length;
        } else if (event.key === "Home") {
          nextIndex = 0;
        } else if (event.key === "End") {
          nextIndex = tabs.length - 1;
        } else {
          return;
        }

        event.preventDefault();
        activateTab(tabs[nextIndex]);
      });
    });

    const initiallySelected = tabs.find((tab) => tab.getAttribute("aria-selected") === "true") || tabs[0];
    activateTab(initiallySelected, false);
  });

  document.querySelectorAll("[data-current-year]").forEach((element) => {
    element.textContent = String(new Date().getFullYear());
  });
})();
