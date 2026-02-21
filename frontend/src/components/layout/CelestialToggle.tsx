import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useThemePreset } from "@/hooks/use-theme-preset";

/**
 * Celestial theme toggle — a sun/moon orb slider inspired by day/night aesthetics.
 *
 * Behaviour:
 *  1. Before toggling: adds .theme-transitioning to <html> so all CSS-var-driven
 *     colours animate over 0.7s (see index.css).
 *  2. Fires an ember-burst radial flash from the button's screen position.
 *  3. Calls toggleDark() which switches .dark class + CSS vars on <html>.
 *  4. Removes .theme-transitioning after 750ms.
 */
export function CelestialToggle() {
  const { isDark, toggleDark } = useThemePreset();
  const { t } = useTranslation();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);

  function handleToggle() {
    // Ember flash — originates from the toggle button's centre
    if (buttonRef.current && flashRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const x = ((rect.left + rect.width / 2) / window.innerWidth * 100).toFixed(1) + "%";
      const y = ((rect.top + rect.height / 2) / window.innerHeight * 100).toFixed(1) + "%";
      const flash = flashRef.current;
      flash.style.setProperty("--flash-x", x);
      flash.style.setProperty("--flash-y", y);
      // Restart animation by removing and re-adding the class
      flash.classList.remove("ember-active");
      void flash.offsetWidth; // force reflow
      flash.classList.add("ember-active");
    }

    // Smooth transition: add class before, remove after animation completes
    document.documentElement.classList.add("theme-transitioning");
    toggleDark();
    setTimeout(() => document.documentElement.classList.remove("theme-transitioning"), 750);
  }

  const label = isDark ? t("theme.switchToLight", "Switch to light mode") : t("theme.switchToDark", "Switch to dark mode");

  return (
    <>
      {/* Global ember flash overlay — rendered at body root level via fixed positioning */}
      <div ref={flashRef} className="ember-flash" aria-hidden="true" />

      <button
        ref={buttonRef}
        onClick={handleToggle}
        role="switch"
        aria-checked={isDark}
        aria-label={label}
        title={label}
        className="celestial-toggle"
      >
        {/* Track: sky gradient + stars */}
        <div className="ct-track" aria-hidden="true">
          <div className="ct-sky" />
          <div className="ct-stars">
            <div
              className="ct-star"
              style={{ width: 2, height: 2, top: 6, left: 8, animationDelay: "0s" }}
            />
            <div
              className="ct-star"
              style={{ width: 1, height: 1, top: 12, left: 18, animationDelay: "0.3s" }}
            />
            <div
              className="ct-star"
              style={{ width: 2, height: 2, top: 8, left: 28, animationDelay: "0.6s" }}
            />
            <div
              className="ct-star"
              style={{ width: 1, height: 1, top: 18, left: 12, animationDelay: "0.9s" }}
            />
            <div
              className="ct-star"
              style={{ width: 1, height: 1, top: 22, left: 22, animationDelay: "1.2s" }}
            />
          </div>
        </div>

        {/* Orb: sun (light) → moon (dark) */}
        <div className="ct-orb" aria-hidden="true" />
      </button>
    </>
  );
}
