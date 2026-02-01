import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HERO_IMAGES } from "@/lib/constants";

interface HeroCarouselProps {
  onStartHiring: () => void;
  onApplyNow: () => void;
}

export function HeroCarousel({ onStartHiring, onApplyNow }: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % HERO_IMAGES.length);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + HERO_IMAGES.length) % HERO_IMAGES.length);
  }, []);

  useEffect(() => {
    const interval = setInterval(nextSlide, 4000);
    return () => clearInterval(interval);
  }, [nextSlide]);

  return (
    <section className="relative h-screen w-full overflow-hidden" data-testid="section-hero">
      {/* Background Images */}
      {HERO_IMAGES.map((image, index) => (
        <div
          key={index}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            index === currentIndex ? "opacity-100" : "opacity-0"
          }`}
        >
          <img
            src={image.url}
            alt={image.alt}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70" />
        </div>
      ))}

      {/* Content */}
      <div className="relative z-10 flex h-full items-center justify-center px-4">
        <div className="max-w-4xl text-center">
          <h1
            className="mb-6 text-4xl font-bold text-white md:text-5xl lg:text-6xl xl:text-7xl"
            style={{ lineHeight: 1.1 }}
            data-testid="text-hero-headline"
          >
            Your Success, Our Mission
          </h1>
          <p
            className="mb-8 text-lg text-white/90 md:text-xl lg:text-2xl max-w-3xl mx-auto leading-relaxed"
            data-testid="text-hero-subheadline"
          >
            AI-powered recruitment meets human expertise. Find exceptional talent 80% faster
            with guaranteed compliance.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
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
          </div>
        </div>
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={prevSlide}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
        data-testid="button-carousel-prev"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        onClick={nextSlide}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
        data-testid="button-carousel-next"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      {/* Dot Indicators */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        {HERO_IMAGES.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === currentIndex
                ? "w-8 bg-primary"
                : "w-2 bg-white/50 hover:bg-white/80"
            }`}
            data-testid={`button-dot-${index}`}
          />
        ))}
      </div>
    </section>
  );
}
