import { useSyncExternalStore } from "react";
import { applySkin, getSkin, SKINS, subscribeSkin } from "../../skins";
import { theme } from "../../theme";
import { getLocale, useT } from "../../i18n/locale";

/** Reuses the app-wide persisted skin, including the advanced editor and dialogs. */
export function AppearanceToggle() {
  useT();
  const current = useSyncExternalStore(
    subscribeSkin,
    getSkin,
    () => "graphite",
  );
  const light =
    SKINS.find((skin) => skin.id === current)?.tokens.colorScheme === "light";
  const portuguese = getLocale() === "pt-BR";
  return (
    <select
      aria-label={portuguese ? "Aparência" : "Appearance"}
      title={portuguese ? "Modo claro ou escuro" : "Light or dark mode"}
      value={light ? "light" : "dark"}
      onChange={(event) =>
        applySkin(event.target.value === "light" ? "latte" : "graphite")
      }
      style={{
        height: 26,
        borderRadius: 8,
        padding: "0 6px",
        fontSize: 11,
        background: theme.panelAlt,
        color: theme.text,
        border: `1px solid ${theme.border}`,
      }}
    >
      <option value="dark">{portuguese ? "Escuro" : "Dark"}</option>
      <option value="light">{portuguese ? "Claro" : "Light"}</option>
    </select>
  );
}
