import {
  CoverSlideLayout,
  StatsSlideLayout,
  AboutSlideLayout,
  ServicesSlideLayout,
  ComparisonTableSlideLayout,
  FeatureGridSlideLayout,
  WhyUsSlideLayout,
  ProcessFlowSlideLayout,
  DemandFlowSlideLayout,
  DomainMatrixSlideLayout,
  ContactSlideLayout,
  DeckContext,
  type TypedSlide,
  type DeckCtx,
} from "./ITSlideLayouts";

interface TypedSlideRendererProps {
  slide: TypedSlide;
  ctx: DeckCtx;
}

export function TypedSlideRenderer({ slide, ctx }: TypedSlideRendererProps) {
  return (
    <DeckContext.Provider value={ctx}>
      {slide.slide_type === "cover" && <CoverSlideLayout data={slide} />}
      {slide.slide_type === "stats" && <StatsSlideLayout data={slide} />}
      {slide.slide_type === "about" && <AboutSlideLayout data={slide} />}
      {slide.slide_type === "services" && <ServicesSlideLayout data={slide} />}
      {slide.slide_type === "comparison_table" && <ComparisonTableSlideLayout data={slide} />}
      {slide.slide_type === "feature_grid" && <FeatureGridSlideLayout data={slide} />}
      {slide.slide_type === "why_us" && <WhyUsSlideLayout data={slide} />}
      {slide.slide_type === "process_flow" && <ProcessFlowSlideLayout data={slide} />}
      {slide.slide_type === "demand_flow" && <DemandFlowSlideLayout data={slide} />}
      {slide.slide_type === "domain_matrix" && <DomainMatrixSlideLayout data={slide} />}
      {slide.slide_type === "contact" && <ContactSlideLayout data={slide} />}
    </DeckContext.Provider>
  );
}
