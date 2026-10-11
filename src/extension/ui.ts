/** Task 01 only: keep controls disabled, even if markup changes accidentally. */
for (const id of ['start', 'cancel'] as const) {
  const button = document.getElementById(id);
  if (button instanceof HTMLButtonElement) {
    button.disabled = true;
  }
}
