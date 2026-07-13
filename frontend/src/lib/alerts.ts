import Swal from 'sweetalert2';

const ACCENT = '#2563eb';
const DANGER = '#dc2626';

/** A bottom-right auto-dismissing toast. */
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 2600,
  timerProgressBar: true,
  didOpen: (el) => {
    el.addEventListener('mouseenter', Swal.stopTimer);
    el.addEventListener('mouseleave', Swal.resumeTimer);
  },
});

export function toastSuccess(title: string): void {
  Toast.fire({ icon: 'success', title });
}

export function toastError(title: string): void {
  Toast.fire({ icon: 'error', title });
}

/** Ask the user to confirm a destructive action. Resolves true if confirmed. */
export async function confirmDelete(
  text = 'This action cannot be undone.',
  title = 'Are you sure?',
): Promise<boolean> {
  const res = await Swal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, delete',
    cancelButtonText: 'Cancel',
    confirmButtonColor: DANGER,
    cancelButtonColor: '#6b7280',
    reverseButtons: true,
  });
  return res.isConfirmed;
}

/** Ask the user to confirm a non-destructive action (e.g. saving). Resolves true if confirmed. */
export async function confirmAction(
  text = 'Do you want to continue?',
  title = 'Are you sure?',
  confirmButtonText = 'Yes, continue',
): Promise<boolean> {
  const res = await Swal.fire({
    title,
    text,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText: 'Cancel',
    confirmButtonColor: ACCENT,
    cancelButtonColor: '#6b7280',
    reverseButtons: true,
  });
  return res.isConfirmed;
}

/** Prompt for a single text value. Resolves the trimmed value, or null if cancelled. */
export async function promptText(
  title: string,
  initial = '',
  placeholder = '',
): Promise<string | null> {
  const res = await Swal.fire({
    title,
    input: 'text',
    inputValue: initial,
    inputPlaceholder: placeholder,
    showCancelButton: true,
    confirmButtonText: 'Save',
    confirmButtonColor: ACCENT,
    cancelButtonColor: '#6b7280',
    inputValidator: (value) => (value.trim() ? undefined : 'Please enter a value'),
  });
  return res.isConfirmed ? res.value.trim() : null;
}
