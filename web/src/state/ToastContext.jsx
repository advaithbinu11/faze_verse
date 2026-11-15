import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef();
  const push = useCallback((message, kind = 'info') => {
    clearTimeout(timer.current);
    setToast({ message, kind, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        role={toast?.kind === 'error' ? 'alert' : 'status'}
        className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {toast && (
          <div className="max-w-[90%] rounded-md bg-text px-4 py-2.5 text-sm text-bg transition-opacity duration-fast">
            {toast.message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
