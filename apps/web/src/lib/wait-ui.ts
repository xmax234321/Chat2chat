/** Wait for a bottom sheet modal to finish dismissing before presenting another native modal. */
export function waitAfterModalClose(ms = 320): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
