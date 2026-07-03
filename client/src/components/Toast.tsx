import { CheckCircle, X, AlertCircle } from "lucide-react";
import { useEffect } from "react";

type ToastType = 'success' | 'error' | 'info';

type ToastProps = {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
};

export const Toast = ({ message, type, onClose, duration = 5000 }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const bgColor = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500'
  }[type];

  const Icon = type === 'success' ? CheckCircle : AlertCircle;

  return (
    <div
      className={`fixed bottom-5 right-5 ${bgColor} text-white px-6 py-4 rounded-lg shadow-lg 
        flex items-center gap-3 z-50 animate-slide-up`}
    >
      <Icon size={20} />
      <span className="font-bold">{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-70">
        <X size={16} />
      </button>
    </div>
  );
};
