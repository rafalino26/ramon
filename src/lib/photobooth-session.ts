import { createSlots, DEFAULT_LAYOUT, type LayoutInfo } from "./layout";
import { createDesign, type EditorDesign } from "./editor-design";

export type PhotoboothTab = "layout" | "camera" | "edit";
export type PhotoSlots = readonly (string | null)[];
export interface HistoryEntry extends EditorDesign {
  photoEdit?: { index: number; source: string | null; expected: string | null };
}

export interface PhotoboothSession {
  tab: PhotoboothTab;
  layout: LayoutInfo;
  hasSelectedLayout: boolean;
  images: PhotoSlots;
  design: EditorDesign;
  past: readonly HistoryEntry[];
  future: readonly HistoryEntry[];
  transaction: EditorDesign | null;
}

export type SessionAction =
  | { type: "tab"; tab: PhotoboothTab }
  | { type: "layout"; layout: LayoutInfo }
  | { type: "photo"; index: number; source: string | null }
  | { type: "edit-photo"; index: number; source: string; expected: string }
  | { type: "restore"; session: PhotoboothSession }
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
    case "restore":
      return action.session;
    case "edit-photo":
      if (state.images[action.index] !== action.expected) return state;
      return {
        ...state,
        images: state.images.map((source, index) => index === action.index ? action.source : source),
        past: [...state.past, { ...state.design, photoEdit: { index: action.index, source: action.expected, expected: action.source } }].slice(-30),
        future: [],
      };
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
        past: action.layout.id === state.layout.id ? state.past : state.past.filter(entry => !entry.photoEdit),
        future: action.layout.id === state.layout.id ? state.future : [],
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
      if (previous?.photoEdit) {
        const photo = previous.photoEdit;
        if (state.images[photo.index] !== photo.expected) return { ...state, past: state.past.slice(0, -1) };
        return {
          ...state,
          images: state.images.map((source, index) => index === photo.index ? photo.source : source),
          past: state.past.slice(0, -1),
          future: [{ ...state.design, photoEdit: { index: photo.index, source: photo.expected, expected: photo.source } }, ...state.future].slice(0, 30),
          transaction: null,
        };
      }
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
      if (next?.photoEdit) {
        const photo = next.photoEdit;
        if (state.images[photo.index] !== photo.expected) return { ...state, future: state.future.slice(1) };
        return {
          ...state,
          images: state.images.map((source, index) => index === photo.index ? photo.source : source),
          past: [...state.past, { ...state.design, photoEdit: { index: photo.index, source: photo.expected, expected: photo.source } }].slice(-30),
          future: state.future.slice(1),
          transaction: null,
        };
      }
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
