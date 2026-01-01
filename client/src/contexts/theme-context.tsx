import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { THEMES, applyTheme, getStoredTheme, saveTheme, type ThemeDefinition } from "@/lib/themes";

interface ThemeContextType {
  themeId: string;
  isDark: boolean;
  theme: ThemeDefinition | undefined;
  setTheme: (themeId: string) => void;
  toggleDark: () => void;
  setDark: (isDark: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<string>("macos-sequoia");
  const [isDark, setIsDark] = useState<boolean>(false);

  useEffect(() => {
    const stored = getStoredTheme();
    setThemeId(stored.themeId);
    setIsDark(stored.isDark);
    applyTheme(stored.themeId, stored.isDark);
  }, []);

  const setTheme = (newThemeId: string) => {
    setThemeId(newThemeId);
    saveTheme(newThemeId, isDark);
    applyTheme(newThemeId, isDark);
  };

  const toggleDark = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    saveTheme(themeId, newDark);
    applyTheme(themeId, newDark);
  };

  const setDarkMode = (newDark: boolean) => {
    setIsDark(newDark);
    saveTheme(themeId, newDark);
    applyTheme(themeId, newDark);
  };

  const theme = THEMES.find(t => t.id === themeId);

  return (
    <ThemeContext.Provider value={{ themeId, isDark, theme, setTheme, toggleDark, setDark: setDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
