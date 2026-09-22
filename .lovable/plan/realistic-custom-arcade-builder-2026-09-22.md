# Realistic Custom Arcade Builder

## Goal
Turn the current flat request form into a product configurator where customers can design a machine, upload artwork, inspect it in interactive 3D and fixed product views, then submit the complete build specification for quoting.

## Customer experience
- Replace the small diagram with a large, realistic cabinet viewer using a lit showroom scene, material reflections, shadows, and a floor contact shadow.
- Support drag-to-rotate, zoom, reset, fullscreen, and one-tap Front, Side, and Perspective camera views.
- Keep the machine visible while configuring on desktop; provide a compact sticky preview launcher on mobile.
- Reorganize the flow into Cabinet, Appearance, Controls, Hardware, Games, and Delivery steps with a persistent build summary.
- Expand cabinet choices to upright, deluxe upright, bartop, cocktail, pedestal, wall-mount, 4-player, racing cockpit, sit-down/Japanese style, and virtual pinball.
- Add dimensional choices, cabinet profile, monitor orientation, screen treatment, marquee type, speaker layout, ventilation, wheels/feet, coin door, and accessibility options.
- Add finishes and materials: body, trim, T-molding, control deck, marquee lighting, button colors, joystick colors, and finish type.
- Add richer controls: player count, joystick style, button layout, trackball, spinner, light guns, steering wheel, pedals, flight stick, dance pads, pinball buttons, and USB ports.
- Add hardware choices for monitor, audio, computer tier, storage, Wi-Fi/Ethernet, Bluetooth, lighting, and cooling.
- Add artwork uploads for left side, right side, front/kickplate, control panel, marquee, and screen graphic. Show each upload on the 3D cabinet immediately, with replace/remove controls and file validation.
- Preserve current games, budget, financing, setup, contact, reference-product, and quote-request behavior.

## Realistic product model
- Build a configurable procedural cabinet in React Three Fiber so dimensions and parts change instantly instead of swapping static illustrations.
- Use physically based materials for painted wood, laminate, metal, glass, LEDs, and textured controls.
- Map uploaded artwork onto the appropriate cabinet surfaces with correct image color handling and sensible crop/fit behavior.
- Adjust geometry by cabinet type, player count, screen orientation, control accessories, and selected hardware.
- Optimize for phones: capped pixel density, demand-based rendering, compact geometry, and graceful fallback to a polished fixed front view when WebGL is unavailable.

## Saving and administration
- Store flexible build details in a structured customization field and store private artwork paths separately from public URLs.
- Create a private, image-only upload area with strict size limits. Guests may add new artwork using unguessable paths but cannot browse, replace, or read other uploads; staff can review submitted artwork.
- Save the exact selected options and artwork references with each request.
- Upgrade the admin request view to show a readable specification grouped by section, artwork thumbnails through temporary links, and the same configured product preview.
- When an accepted build becomes a service machine, use its primary artwork image as the machine photo when available.

## Security follow-up
- Preserve public newsletter signup while removing direct public read/delete access to category subscriptions.
- Route category preference replacement through a narrowly scoped database action tied to the subscriber email, so visitors can still subscribe without seeing or deleting other subscribers’ preferences.

## Technical details
- Add React 18-compatible `three`, `@react-three/fiber`, and `@react-three/drei` versions.
- Add focused viewer, model, upload, and option-section components rather than expanding the page into one large file.
- Add one database migration for request customization fields, private artwork storage rules, and the newsletter preference security correction.
- Update generated database types after the migration.
- Verify the complete customer submission path and staff review path on desktop and mobile, including 3D rendering, each fixed camera angle, artwork mapping, upload restrictions, and request persistence.
