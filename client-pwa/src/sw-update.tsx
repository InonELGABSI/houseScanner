import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export default function SWUpdateToast() {
  const [open, setOpen] = useState(false);
  const { updateServiceWorker } = useRegisterSW({
    onNeedRefresh() {
      setOpen(true);
    },
  });

  if (!open) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-xl px-4 py-3 bg-black text-white shadow">
      New version available.
      <button
        className="ml-3 underline"
        onClick={() => updateServiceWorker(true)}
      >Reload</button>
      <button
        className="ml-2 text-xs opacity-70 hover:opacity-100"
        onClick={() => setOpen(false)}
      >Dismiss</button>
    </div>
  );
}
