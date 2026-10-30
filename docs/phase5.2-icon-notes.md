# Phase 5.2 icon exports

The selected artwork came from `assets/icons/icon-512.png`: a cyan-blue circular ring with three downward chevrons and a dark circular interior. The built-in imagegen tool removed the exterior square background. A second edit cleaned the outer edge; System.Drawing then exported the edited RGBA image to 16, 32, 48, 128, and 512px with high quality bicubic interpolation and alpha-preserving compositing.

Final export paths: `assets/icons/icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png`, and `icon-512.png`. The popup uses the 128px export at 40 CSS pixels. The manifest uses 16/32/48/128px for the extension and 16/32px for the toolbar.

The browser tests inspect each PNG's IHDR (8-bit RGBA), dimensions, four corner alpha values (all 0), visible cyan artwork, and blended alpha edges. The [preview sheet](phase5.2-icon-preview.png) shows white, dark, and checkerboard backgrounds, native small sizes, and an enlarged 16px view. Visual review found the circular ring and downward-chevron symbol recognizable at 16px. No checkerboard is baked into the exported icons.

## Built-in edit prompts

Initial edit:

> Use case: background-extraction. Edit the supplied selected Circle Arrow extension icon. Remove ONLY the dark square background OUTSIDE the outer circular ring and make those corners truly transparent. Preserve the original cyan-to-blue circular ring, the three downward cyan chevrons, and the dark circular interior exactly as closely as possible. Keep the circular symbol centered, retain smooth anti-aliased outer edges without a dark square halo. No extra artwork, no text, no new border. Output one square RGBA transparent PNG.

Final cleanup:

> Background extraction cleanup only. Keep this cyan-blue circular ring, dark circular interior, and exactly three downward chevrons unchanged. Clean away ALL stray cyan/blue specks and stray pixels outside the outer circle, including the small speck at the top and edge residue. Outside the smooth circular outer boundary must be perfectly transparent. Preserve a crisp smoothly antialiased circular edge, centered with equal small clear padding on all sides. No square matte, no checkerboard drawn into the image, no additional marks or glow outside the circle.

The new popup and toolbar rendering still require a manual unpacked-extension check in Chrome. No live download was triggered during this change.
