import React, { createContext, useCallback, useContext, useState } from "react";
import FilterModal, { Filters } from "@/components/ui/filter_pop_up";

//initialize empty filters
const DEFAULT_FILTERS: Filters = {
  budgetMin: 0,
  budgetMax: 100,
  allergies: [],
  foodTypes: [],
  cookware: [],
  useMyCookwareOnly: false,
};

type MealPlanFilterContextValue = {
  appliedFilters: Filters;
  setAppliedFilters: (f: Filters | ((prev: Filters) => Filters)) => void;
  resetFilters: () => void;
  openFilterModal: () => void;
};

const MealPlanFilterContext = createContext<MealPlanFilterContextValue | null>(null);

export function MealPlanFilterProvider({ children }: { children: React.ReactNode }) {
  const [appliedFilters, setAppliedFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const openFilterModal = useCallback(() => {
    setDraftFilters(appliedFilters);
    setIsFilterOpen(true);
  }, [appliedFilters]);

  const handleApply = useCallback(() => {
    setAppliedFilters(draftFilters);
    setIsFilterOpen(false);
  }, [draftFilters]);

  const resetFilters = useCallback(() => {
    setAppliedFilters(DEFAULT_FILTERS);
    setDraftFilters(DEFAULT_FILTERS);
  }, []);

  return (
    <MealPlanFilterContext.Provider
      value={{
        appliedFilters,
        setAppliedFilters,
        openFilterModal,
        resetFilters,
      }}
    >
      {children}
      <FilterModal
        visible={isFilterOpen}
        draft={draftFilters}
        onChangeDraft={setDraftFilters}
        onCancel={() => setIsFilterOpen(false)}
        onReset={resetFilters}
        onApply={handleApply}
      />
    </MealPlanFilterContext.Provider>
  );
}
// Export context and types for use in other components
export function useMealPlanFilter(): MealPlanFilterContextValue {
  const ctx = useContext(MealPlanFilterContext);
  if (!ctx) {
    throw new Error("useMealPlanFilter must be used within MealPlanFilterProvider");
  }
  return ctx;
}

export { DEFAULT_FILTERS };
export type { Filters };