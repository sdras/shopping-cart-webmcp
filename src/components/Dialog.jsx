import { useEffect, useRef } from "react";

/**
 * A native modal <dialog>: focus trapping, Escape, and an inert page behind
 * it come from the platform. Clicking the backdrop closes it.
 */
export default function Dialog({ open, onClose, className, labelledBy, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={className}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      {open && children}
    </dialog>
  );
}
