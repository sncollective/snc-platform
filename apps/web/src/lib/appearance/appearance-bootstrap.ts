import { APPEARANCE_MEDIA_QUERY, APPEARANCE_STORAGE_KEY } from "./appearance-controller.js";

/**
 * Set-only first-paint bootstrap. It intentionally has no listeners or shared state: the
 * hydrated AppearanceController becomes the sole lifecycle owner after React mounts.
 */
export const APPEARANCE_BOOTSTRAP_SCRIPT = `(()=>{let preference="system";try{const stored=window.localStorage.getItem("${APPEARANCE_STORAGE_KEY}");if(stored==="light"||stored==="dark"||stored==="system")preference=stored}catch{}let systemDark=false;try{systemDark=window.matchMedia("${APPEARANCE_MEDIA_QUERY}").matches}catch{}const effective=preference==="system"?(systemDark?"dark":"light"):preference;const root=document.documentElement;root.setAttribute("data-theme-preference",preference);root.setAttribute("data-theme",effective)})();`;
