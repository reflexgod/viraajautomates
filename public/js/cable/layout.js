// The hero cable's resting shape, in frame units.
// The frame is anchored to the hero's right and bottom edges and scaled to
// the hero's height, so the cable bleeds off the right and bottom.
// Shared by the physics worker, the WebGL cable and the still-image script.
//
// Points are [x, y, z] with y pointing DOWN and z towards the viewer.
// The path enters top-right, curls once (the curl crosses in front of
// itself), runs off the bottom edge and comes back up to the plug.

export const FRAMES = {
  wide: {
    w: 900, h: 900,
    radius: 25,          // cable radius: a cord, not a rope
    plug: 0.95,          // plug scale
    path: [
      [1050, -220, 0], [935, 0, 0], [805, 170, 14], [692, 300, 36],
      [604, 432, 48],
      [500, 562, 36], [380, 582, 14], [268, 500, -10], [248, 368, -30],
      [318, 250, -44], [450, 208, -50], [572, 258, -48], [634, 380, -36],
      [612, 522, -16],
      [598, 648, 6], [578, 772, 14], [520, 878, 22], [430, 906, 28],
      [345, 878, 32],
    ],
  },
  tall: {
    w: 390, h: 844,
    radius: 12,
    plug: 0.46,
    path: [
      [440, -80, 0], [380, 20, 0], [330, 92, 8], [296, 150, 18],
      [262, 206, 22], [214, 234, 14], [162, 222, 4], [138, 178, -8],
      [156, 130, -16], [204, 108, -20], [252, 124, -20], [276, 166, -14],
      [274, 224, -6],
      [300, 300, 4], [340, 380, 8], [372, 470, 10], [386, 560, 10],
      [384, 650, 12], [374, 744, 16],
    ],
  },
  // The plug end hanging into the top of the footer (rendered once, as a still).
  drop: {
    w: 240, h: 520,
    radius: 12,
    plug: 0.5,
    path: [
      [118, -120, 0], [118, -40, 0], [122, 40, 4], [112, 120, 8], [104, 200, 10],
      [112, 270, 10], [124, 330, 8], [128, 380, 6],
    ],
  },
};

export const SEGMENTS = 55;          // physics points = SEGMENTS + 1
