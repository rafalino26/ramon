/** The preview and export share these frame styles. */
export const frameStyles = {
  default: "frame-default",
  thin: "frame-thin",
  rounded: "frame-rounded",
  polaroid: "frame-polaroid",
  circle: "frame-circle",
  film: "frame-film",
  postcard: "frame-postcard",
  double: "frame-double",
  inset: "frame-inset",
} as const;

export type FramePreset = keyof typeof frameStyles;
