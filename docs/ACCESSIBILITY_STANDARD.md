# AI Core Accessibility Standard v1.0

## Conformance target

WCAG 2.2 AA is the shared minimum. Native HTML semantics are preferred. Custom widgets must implement equivalent WAI-ARIA Authoring Practices semantics and keyboard behavior.

## Non-negotiable contracts

- Ordinary text contrast: at least 4.5:1.
- UI boundaries/state/focus contrast: at least 3:1 where the WCAG criterion applies.
- Meaning is not communicated by color alone.
- Focus is visible, ordered, and not obscured.
- Icon-only controls have an accessible name.
- Touch actions expose at least a 44px effective target by company standard.
- Drag/swipe interactions have a non-drag/single-pointer alternative when required.
- Status updates use programmatic semantics without stealing focus.
- Critical information is never toast-only.
- Disabled/read-only/invalid/required states are semantic as well as visual.
- Reduced-motion and forced-color/high-contrast preferences preserve hierarchy and meaning.

## Keyboard

Every business outcome available by pointer/touch is keyboard reachable unless the task intrinsically depends on a modality. Dialogs enter focus, contain modal focus, support Escape when dismissible, and return focus to the invoker.

## Forms

Persistent visible labels are required. Placeholder text is not the sole label. Validation identifies the field and correction, preserves entered values and moves focus to the first invalid field at the chosen validation boundary.

## Touch, gesture and motion

Hover is enhancement only. Swipe-only navigation is forbidden. Drag/reorder provides controls or menu alternatives. Non-essential motion is removable without losing state or completion meaning.

## Data surfaces

Tables use table semantics for relational data. Loading/empty/error/populated are separate states. Selection and sorting state are programmatically exposed.

## Verification

At minimum: keyboard-only, focus-visible, accessible names, target size, 200% zoom, 400% reflow, reduced motion, forced colors/high contrast, loading/error paths, dialog focus return and status announcements.

## Machine sources

- `registry/ui-ux-features.json`
- `design-system/interaction.contract.json#accessibility`
- `design-system/runtime-v2.css`
- `docs/UI_QA_VISUAL_REGRESSION.md`
