import { Check, Circle, LoaderCircle } from "lucide-react";

type Step = {
  id: number;
  label: string;
  status: 'pending' | 'current' | 'completed' | 'loading';
};

type StepIndicatorProps = {
  steps: Step[];
};

export const StepIndicator = ({ steps }: StepIndicatorProps) => {
  return (
    <div className="w-full h-16 bg-gray-900 flex items-center justify-center gap-2 border-b border-gray-700">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div className="flex items-center gap-2 px-4">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                ${step.status === 'completed' ? 'bg-green-500 text-white' : ''}
                ${step.status === 'current' ? 'bg-blue-500 text-white' : ''}
                ${step.status === 'pending' ? 'bg-gray-700 text-gray-400' : ''}
                ${step.status === 'loading' ? 'bg-blue-500 text-white' : ''}`}
            >
              {step.status === 'completed' && <Check size={16} />}
              {step.status === 'pending' && <Circle size={16} />}
              {step.status === 'current' && step.id}
              {step.status === 'loading' && <LoaderCircle className="animate-spin" size={16} />}
            </div>
            <span
              className={`text-sm font-bold
                ${step.status === 'current' || step.status === 'completed' ? 'text-white' : 'text-gray-500'}`}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div className={`w-10 h-0.5 ${step.status === 'completed' ? 'bg-green-500' : 'bg-gray-700'}`} />
          )}
        </div>
      ))}
    </div>
  );
};
