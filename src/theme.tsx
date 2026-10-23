import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import type { ReactNode } from "react";

export type Theme = "light" | "dark";
const storageKey = "hisabo.theme";
const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void }>({
  theme: "light",
  toggleTheme: () => {},
});

function savedTheme(): Theme | null {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved === "dark" || saved === "light" ? saved : null;
  } catch {
    return null;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState(savedTheme);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const theme = preference ?? (systemDark ? "dark" : "light");
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#0b1220" : "#f4f6fa");
  }, [theme]);
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const followSystem = () => setSystemDark(query.matches);
    const followStorage = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null)
        setPreference(savedTheme());
    };
    query.addEventListener("change", followSystem);
    window.addEventListener("storage", followStorage);
    return () => {
      query.removeEventListener("change", followSystem);
      window.removeEventListener("storage", followStorage);
    };
  }, []);
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setPreference(next);
    // Theme switching still works when browser storage is unavailable.
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      /* This session keeps the preference. */
    }
  }
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useChartColors() {
  const { theme } = useTheme();
  return theme === "dark"
    ? {
        text: "#a6b6cc",
        grid: "#29394f",
        income: "#8faaff",
        expense: "#5bd0b4",
        baseline: "#9daccc",
        empty: "#29394f",
        tooltip: "#23334b",
        tooltipText: "#edf3fc",
      }
    : {
        text: "#8490a3",
        grid: "#edf0f5",
        income: "#4263eb",
        expense: "#24aa97",
        baseline: "#a1acc5",
        empty: "#edf0f5",
        tooltip: "#101c34",
        tooltipText: "#ffffff",
      };
}
