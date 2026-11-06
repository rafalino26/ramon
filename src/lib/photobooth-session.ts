import { createSlots, DEFAULT_LAYOUT, type LayoutInfo } from "./layout";
import { createDesign, type EditorDesign } from "./editor-design";

export type PhotoboothTab = "layout" | "camera" | "edit";
export type PhotoSlots = readonly (string | null)[];

export interface PhotoboothSession {
  tab: PhotoboothTab;
  layout: LayoutInfo;
  hasSelectedLayout: boolean;
  images: PhotoSlots;
  design: EditorDesign;
  past: readonly EditorDesign[];
  future: readonly EditorDesign[];
  transaction: EditorDesign | null;
}

export type SessionAction =
  | { type: "tab"; tab: PhotoboothTab }
  | { type: "layout"; layout: LayoutInfo }
  | { type: "photo"; index: number; source: string | null }
  | { type: "reset" }
  | { type: "design"; patch: Partial<EditorDesign> }
  | { type: "design-begin" }
  | { type: "design-end" }
  | { type: "undo" }
  | { type: "redo" };

export function createSession(): PhotoboothSession {
  return {
    tab: "layout",
    layout: DEFAULT_LAYOUT,
    hasSelectedLayout: false,
    images: createSlots(DEFAULT_LAYOUT),
    design: createDesign(),
    past: [],
    future: [],
    transaction: null,
  };
}

export function sessionReducer(
  state: PhotoboothSession,
  action: SessionAction,
): PhotoboothSession {
  switch (action.type) {
    case "tab":
      return { ...state, tab: action.tab };
    case "layout":
      return {
        ...state,
        layout: action.layout,
        hasSelectedLayout: true,
        images:
          action.layout.id === state.layout.id
            ? state.images
            : createSlots(action.layout),
      };
    case "photo":
      if (
        !Number.isInteger(action.index) ||
        action.index < 0 ||
        action.index >= state.images.length
      )
        return state;
      return {
        ...state,
        images: state.images.map((image, index) =>
          index === action.index ? action.source : image,
        ),
      };
    case "reset":
      return { ...state, images: createSlots(state.layout) };
    case "design": {
      const design = { ...state.design, ...action.patch };
      return {
        ...state,
        design,
        past: state.transaction
          ? state.past
          : [...state.past, state.design].slice(-30),
        future: [],
      };
    }
    case "design-begin":
      return state.transaction
        ? state
        : { ...state, transaction: state.design };
    case "design-end":
      return {
        ...state,
        transaction: null,
        past:
          state.transaction && state.transaction !== state.design
            ? [...state.past, state.transaction].slice(-30)
            : state.past,
      };
    case "undo": {
      const previous = state.past.at(-1);
      return previous
        ? {
            ...state,
            design: previous,
            past: state.past.slice(0, -1),
            future: [state.design, ...state.future].slice(0, 30),
            transaction: null,
          }
        : state;
    }
    case "redo": {
      const next = state.future[0];
      return next
        ? {
            ...state,
            design: next,
            past: [...state.past, state.design].slice(-30),
            future: state.future.slice(1),
            transaction: null,
          }
        : state;
    }
  }
}
