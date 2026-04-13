import { useTranslation } from "react-i18next";
import { useThemePreset } from "@/hooks/use-theme-preset";

/**
 * Celestial theme toggle — pill slider with day/night sky gradient.
 *
 * On click: adds .theme-transitioning to <html> so all CSS-var-driven
 * colours animate over 0.7s (see index.css), then removes it after 750ms.
 */
export function CelestialToggle() {
  const { isDark, toggleDark } = useThemePreset();
  const { t } = useTranslation();

  function handleToggle() {
    document.documentElement.classList.add("theme-transitioning");
    toggleDark();
    setTimeout(() => document.documentElement.classList.remove("theme-transitioning"), 750);
  }

  const label = isDark
    ? t("theme.switchToLight", "Switch to light mode")
    : t("theme.switchToDark", "Switch to dark mode");

  return (
    <button
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
          <div className="ct-star" style={{ width: 2, height: 2, top: 6, left: 8 }} />
          <div className="ct-star" style={{ width: 1, height: 1, top: 12, left: 18 }} />
          <div className="ct-star" style={{ width: 2, height: 2, top: 8, left: 28 }} />
          <div className="ct-star" style={{ width: 1, height: 1, top: 18, left: 12 }} />
          <div className="ct-star" style={{ width: 1, height: 1, top: 22, left: 22 }} />
        </div>
      </div>

      {/* Orb: slides left (light) → right (dark) */}
      <div className="ct-orb" aria-hidden="true" />
    </button>
  );
}
