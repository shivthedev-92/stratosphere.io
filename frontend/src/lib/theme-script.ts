// Runs before first paint (inlined in <head> by app/layout.tsx) so the page
// never flashes the wrong theme. Kept outside any "use client" module so the
// server layout can import the string. Must stay in sync with components/theme.tsx.
export const THEME_STORAGE_KEY = "stratosphere-theme";

export const THEME_INIT_SCRIPT = `(function(){try{var c=localStorage.getItem("${THEME_STORAGE_KEY}")||"system";var d=c==="dawn"||(c==="system"&&window.matchMedia("(prefers-color-scheme: light)").matches);document.documentElement.dataset.theme=d?"dawn":"night";}catch(e){document.documentElement.dataset.theme="night";}})();`;
