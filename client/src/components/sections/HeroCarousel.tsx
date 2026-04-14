import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HERO_SLIDES } from "@/lib/constants";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const SLIDE_DURATION = 6000;
const SWIPE_THRESHOLD = 50;

const kenBurnsVariants = [
  "hero-kb-zoom-in-left",
  "hero-kb-zoom-in-right",
  "hero-kb-zoom-out-center",
  "hero-kb-zoom-in-top",
];

interface HeroCarouselProps {
  onStartHiring: () => void;
  onApplyNow: () => void;
}

function useMotionVariants() {
  const reduced = useReducedMotion();

  const instant = { duration: 0 };

  return {
    headline: {
      initial: reduced ? { opacity: 1 } : { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: reduced ? instant : { duration: 1.5, ease: [0.4, 0, 0.2, 1] },
    },
    subheadline: {
      initial: reduced ? { opacity: 1 } : { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: reduced ? instant : { duration: 1.5, ease: [0.4, 0, 0.2, 1], delay: 0.15 },
    },
    buttons: {
      initial: reduced ? { opacity: 1 } : { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: reduced ? instant : { duration: 1.5, ease: [0.4, 0, 0.2, 1], delay: 0.3 },
    },
  };
}

export function HeroCarousel({ onStartHiring, onApplyNow }: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const motionVariants = useMotionVariants();

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % HERO_SLIDES.length);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
  }, []);

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  useEffect(() => {
    autoAdvanceRef.current = setTimeout(() => {
      nextSlide();
    }, SLIDE_DURATION);
    return () => {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, [currentIndex, nextSlide]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        document.documentElement.setAttribute("data-hero-visible", entry.isIntersecting ? "true" : "false");
      },
      { threshold: 0.15 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => {
      observer.disconnect();
      document.documentElement.removeAttribute("data-hero-visible");
    };
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > Math.abs(dx)) return;
    if (dx < 0) nextSlide();
    else prevSlide();
  }, [nextSlide, prevSlide]);

  const currentSlide = HERO_SLIDES[currentIndex];

  return (
    <section
      ref={sectionRef}
      className="relative h-[88vh] w-full overflow-hidden group/hero"
      data-testid="section-hero"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {HERO_SLIDES.map((slide, index) => (
        <div
          key={index}
          className={`absolute inset-0 transition-opacity ease-in-out ${
            prefersReducedMotion ? "duration-300" : "duration-[2000ms]"
          } ${index === currentIndex ? "opacity-100" : "opacity-0"}`}
          style={{ willChange: "opacity" }}
        >
          <div
            className={`h-full w-full ${prefersReducedMotion ? "" : kenBurnsVariants[index % kenBurnsVariants.length]}`}
          >
            <img
              src={slide.url}
              alt={slide.alt}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/40 to-black/30" />
        </div>
      ))}

      {!prefersReducedMotion && (
        <div className="absolute inset-0 z-[1] pointer-events-none hero-ambient-overlay" />
      )}

      <div className="relative z-10 flex h-full items-end px-6 sm:px-10 md:px-16 lg:px-20 pb-24 md:pb-28 lg:pb-32">
        <div className="max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.h1
              key={`headline-${currentIndex}`}
              {...motionVariants.headline}
              className="mb-4 text-3xl font-bold text-white sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl"
              style={{ lineHeight: 1.1 }}
              data-testid="text-hero-headline"
            >
              {currentSlide.headline}
            </motion.h1>
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.p
              key={`subheadline-${currentIndex}`}
              {...motionVariants.subheadline}
              className="mb-8 text-base text-white/85 md:text-lg lg:text-xl max-w-xl leading-relaxed"
              data-testid="text-hero-subheadline"
            >
              {currentSlide.subheadline}
            </motion.p>
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.div
              key={`buttons-${currentIndex}`}
              {...motionVariants.buttons}
              className="flex flex-col sm:flex-row items-start gap-4"
            >
              <Button
                size="lg"
                onClick={onStartHiring}
                className="min-w-[200px] text-lg h-12"
                data-testid="button-hero-start-hiring"
              >
                Start Hiring Today
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={onApplyNow}
                className="min-w-[200px] text-lg h-12 bg-white/10 border-white/30 text-white hover:bg-white/20"
                data-testid="button-hero-apply"
              >
                Apply for Opportunities
              </Button>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <button
        onClick={prevSlide}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-all duration-300 opacity-0 group-hover/hero:opacity-100"
        data-testid="button-carousel-prev"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        onClick={nextSlide}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-all duration-300 opacity-0 group-hover/hero:opacity-100"
        data-testid="button-carousel-next"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
        {HERO_SLIDES.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`rounded-full transition-all duration-500 ease-in-out cursor-pointer ${
              index === currentIndex
                ? "w-[8px] h-[8px] bg-white/90"
                : "w-[6px] h-[6px] bg-white/40 hover:bg-white/60"
            }`}
            data-testid={`button-indicator-${index}`}
          />
        ))}
      </div>
    </section>
  );
}
