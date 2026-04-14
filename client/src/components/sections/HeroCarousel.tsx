import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HERO_SLIDES } from "@/lib/constants";
import { motion, AnimatePresence } from "framer-motion";

const SLIDE_DURATION = 6000;

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

const headlineMotion = {
  initial: { opacity: 0, y: 30, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -20, scale: 0.97 },
  transition: { type: "spring", stiffness: 80, damping: 20, mass: 0.8 },
};

const subheadlineMotion = {
  initial: { opacity: 0, y: 25 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -15 },
  transition: { type: "spring", stiffness: 70, damping: 22, mass: 0.8, delay: 0.15 },
};

const buttonsMotion = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { type: "spring", stiffness: 60, damping: 20, mass: 0.8, delay: 0.3 },
};

export function HeroCarousel({ onStartHiring, onApplyNow }: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef<number | null>(null);
  const startTimeRef = useRef(Date.now());
  const sectionRef = useRef<HTMLElement>(null);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % HERO_SLIDES.length);
    setProgress(0);
    startTimeRef.current = Date.now();
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
    setProgress(0);
    startTimeRef.current = Date.now();
  }, []);

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(index);
    setProgress(0);
    startTimeRef.current = Date.now();
  }, []);

  useEffect(() => {
    startTimeRef.current = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min(elapsed / SLIDE_DURATION, 1);
      setProgress(pct);
      if (pct >= 1) {
        nextSlide();
      } else {
        progressRef.current = requestAnimationFrame(tick);
      }
    };
    progressRef.current = requestAnimationFrame(tick);
    return () => {
      if (progressRef.current) cancelAnimationFrame(progressRef.current);
    };
  }, [currentIndex, nextSlide]);

  useEffect(() => {
    if (sectionRef.current) {
      sectionRef.current.setAttribute("data-hero-visible", "true");
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        document.documentElement.setAttribute("data-hero-visible", entry.isIntersecting ? "true" : "false");
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => {
      observer.disconnect();
      document.documentElement.removeAttribute("data-hero-visible");
    };
  }, []);

  const currentSlide = HERO_SLIDES[currentIndex];
  const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <section ref={sectionRef} className="relative h-screen w-full overflow-hidden group/hero" data-testid="section-hero">
      {HERO_SLIDES.map((slide, index) => (
        <div
          key={index}
          className={`absolute inset-0 transition-all duration-[1200ms] ease-in-out ${
            index === currentIndex
              ? "opacity-100 scale-100"
              : "opacity-0 scale-105"
          }`}
          style={{ willChange: "opacity, transform" }}
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
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70" />
        </div>
      ))}

      <div className="absolute inset-0 z-[1] pointer-events-none hero-ambient-overlay" />

      <div className="relative z-10 flex h-full items-center justify-center px-4">
        <div className="max-w-4xl text-center">
          <AnimatePresence mode="wait">
            <motion.h1
              key={`headline-${currentIndex}`}
              {...headlineMotion}
              className="mb-6 text-4xl font-bold text-white md:text-5xl lg:text-6xl xl:text-7xl"
              style={{ lineHeight: 1.1 }}
              data-testid="text-hero-headline"
            >
              {currentSlide.headline}
            </motion.h1>
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.p
              key={`subheadline-${currentIndex}`}
              {...subheadlineMotion}
              className="mb-8 text-lg text-white/90 md:text-xl lg:text-2xl max-w-3xl mx-auto leading-relaxed"
              data-testid="text-hero-subheadline"
            >
              {currentSlide.subheadline}
            </motion.p>
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.div
              key={`buttons-${currentIndex}`}
              {...buttonsMotion}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
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

      <div className="absolute bottom-0 left-0 right-0 z-20 flex h-1 gap-1 px-8 pb-6">
        {HERO_SLIDES.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className="relative h-1 flex-1 rounded-full overflow-hidden bg-white/20 cursor-pointer"
            data-testid={`button-progress-${index}`}
          >
            <div
              className="absolute inset-y-0 left-0 bg-primary rounded-full transition-none"
              style={{
                width: index === currentIndex
                  ? `${progress * 100}%`
                  : index < currentIndex
                    ? "100%"
                    : "0%",
              }}
            />
          </button>
        ))}
      </div>
    </section>
  );
}
