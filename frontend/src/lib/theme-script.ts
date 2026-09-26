// Runs before first paint (inlined in <head> by app/layout.tsx) so the page
// never flashes the wrong theme. It also stays active for the life of the
// page: while the choice is "system" it follows the device switching light
// or dark, and it applies a choice made in another tab. That works on every
// page, whether or not a ThemeSwitcher is mounted.
//
// Kept outside any "use client" module so the server layout can import the
// string. It must stay a static string with no runtime or user data: it is
// the project's one sanctioned dangerouslySetInnerHTML (see .coderabbit.yaml).
// Must stay in sync with components/theme.tsx.
export const THEME_STORAGE_KEY = "stratosphere-theme";

export const THEME_INIT_SCRIPT = `(function(){
var key=${JSON.stringify(THEME_STORAGE_KEY)},root=document.documentElement,media=null;
function choice(){try{var c=localStorage.getItem(key);return c==="night"||c==="dawn"?c:"system";}catch(e){return "system";}}
function apply(){var c=choice();root.dataset.theme=c==="dawn"||(c==="system"&&media&&media.matches)?"dawn":"night";}
try{media=window.matchMedia("(prefers-color-scheme: light)");}catch(e){}
apply();
if(media){if(media.addEventListener){media.addEventListener("change",apply);}else if(media.addListener){media.addListener(apply);}}
window.addEventListener("storage",function(e){if(e.key===key||e.key===null){apply();}});
})();`;
