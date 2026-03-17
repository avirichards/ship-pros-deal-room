import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronRight, ChevronLeft, X, Sparkles } from 'lucide-react';

export interface TourStep {
  /** CSS selector for the element to highlight */
  target: string;
  /** Title of the tooltip */
  title: string;
  /** Description text */
  content: string;
  /** Preferred placement of the tooltip */
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

interface ProductTourProps {
  steps: TourStep[];
  tourKey: string; // localStorage key to track completion
  onComplete?: () => void;
}

export function ProductTour({ steps, tourKey, onComplete }: ProductTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Check if tour has been completed
  useEffect(() => {
    const completed = localStorage.getItem(tourKey);
    if (!completed) {
      // Small delay to let the page render before starting
      const timer = setTimeout(() => setIsActive(true), 800);
      return () => clearTimeout(timer);
    }
  }, [tourKey]);

  // Position the spotlight and tooltip
  const positionTooltip = useCallback(() => {
    if (!isActive || currentStep >= steps.length) return;

    const step = steps[currentStep];
    const el = document.querySelector(step.target);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    setTargetRect(rect);

    // Scroll element into view if needed
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Calculate tooltip position
    const padding = 16;
    const tooltipWidth = 340;
    const tooltipHeight = 180;
    const placement = step.placement || 'bottom';

    let top = 0;
    let left = 0;

    switch (placement) {
      case 'bottom':
        top = rect.bottom + padding;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'top':
        top = rect.top - tooltipHeight - padding;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + padding;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - padding;
        break;
    }

    // Clamp to viewport
    left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));
    top = Math.max(16, Math.min(top, window.innerHeight - tooltipHeight - 16));

    setTooltipStyle({ top, left, width: tooltipWidth });
  }, [isActive, currentStep, steps]);

  useEffect(() => {
    positionTooltip();
    window.addEventListener('resize', positionTooltip);
    window.addEventListener('scroll', positionTooltip, true);
    return () => {
      window.removeEventListener('resize', positionTooltip);
      window.removeEventListener('scroll', positionTooltip, true);
    };
  }, [positionTooltip]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeTour();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const completeTour = () => {
    localStorage.setItem(tourKey, 'true');
    setIsActive(false);
    onComplete?.();
  };

  if (!isActive || !targetRect) return null;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const isFirst = currentStep === 0;

  return (
    <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: 'auto' }}>
      {/* Semi-transparent overlay with spotlight cutout using CSS clip-path */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <defs>
          <mask id="tour-spotlight">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={targetRect.left - 6}
              y={targetRect.top - 6}
              width={targetRect.width + 12}
              height={targetRect.height + 12}
              rx="8"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0" y="0" width="100%" height="100%"
          fill="rgba(0,0,0,0.65)"
          mask="url(#tour-spotlight)"
        />
      </svg>

      {/* Spotlight ring / glow */}
      <div
        className="absolute border-2 border-teal-400 rounded-lg shadow-[0_0_0_4px_rgba(0,191,166,0.2),0_0_20px_rgba(0,191,166,0.3)] transition-all duration-300 ease-out"
        style={{
          top: targetRect.top - 6,
          left: targetRect.left - 6,
          width: targetRect.width + 12,
          height: targetRect.height + 12,
          pointerEvents: 'none',
        }}
      />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden transition-all duration-300 ease-out"
        style={{ ...tooltipStyle, pointerEvents: 'auto' }}
      >
        {/* Header accent */}
        <div className="h-1 bg-gradient-to-r from-teal-400 to-teal-600" />

        <div className="p-5">
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-500" />
              <span className="text-xs font-medium text-teal-600 uppercase tracking-wide">
                Step {currentStep + 1} of {steps.length}
              </span>
            </div>
            <button
              onClick={completeTour}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <h3 className="text-base font-semibold text-navy-950 mb-1.5">{step.title}</h3>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">{step.content}</p>

          {/* Progress dots */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    i === currentStep
                      ? 'w-6 bg-teal-500'
                      : i < currentStep
                      ? 'w-1.5 bg-teal-300'
                      : 'w-1.5 bg-gray-200'
                  }`}
                />
              ))}
            </div>

            {/* Navigation */}
            <div className="flex gap-2">
              {!isFirst && (
                <button
                  onClick={handlePrev}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Back
                </button>
              )}
              {isFirst && (
                <button
                  onClick={completeTour}
                  className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 rounded-md transition-colors"
                >
                  Skip Tour
                </button>
              )}
              <button
                onClick={handleNext}
                className="flex items-center gap-1 px-4 py-1.5 text-sm font-medium bg-teal-500 hover:bg-teal-600 text-white rounded-md transition-colors shadow-sm"
              >
                {isLast ? 'Finish' : 'Next'}
                {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
