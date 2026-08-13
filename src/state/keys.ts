// Single source of truth for localStorage keys, so the scenario-link loader and
// the state hooks agree on where things live.

export const inputsKey = (id: string) => `quoin:inputs:${id}`;
export const SELECTION_KEY = 'quoin:selection';
export const TAX_KEY = 'quoin:tax';
export const COMPARE_KEY = 'quoin:compare';
export const NAV_COLLAPSE_KEY = 'quoin:nav:collapsed';
export const SAVED_KEY = 'quoin:saved';
