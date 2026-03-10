import React, { createContext, useCallback, useContext, useState } from "react";
import FilterModal, { Filters } from "@/components/ui/filter_pop_up";

// Initialize default filters when no filters are modified yet
const DEFAULT_FILTERS: Filters = {
  budgetMin: 0,
  budgetMax: 100,
  allergies: [],
  foodTypes: [],
  cookware: [],
  useMyCookwareOnly: false,
};

type HomeFilterContextValue = {
  appliedFilters: Filters;
  setAppliedFilters: (f: Filters | ((prev: Filters) => Filters)) => void;
  resetFilters: () => void;
  openFilterModal: () => void;
};

const HomeFilterContext = createContext<HomeFilterContextValue | null>(null);

export function HomeFilterProvider({ children }: { children: React.ReactNode }) {
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
    // Filters apply to the current page (home or search); no navigation.
  }, [draftFilters]);

  const resetFilters = useCallback(() => {
    setAppliedFilters(DEFAULT_FILTERS);
    setDraftFilters(DEFAULT_FILTERS);
  }, []);

  return (
    <HomeFilterContext.Provider
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
    </HomeFilterContext.Provider>
  );
}
// Export context and types for use in other components
export function useHomeFilter(): HomeFilterContextValue {
  const ctx = useContext(HomeFilterContext);
  if (!ctx) {
    throw new Error("useHomeFilter must be used within HomeFilterProvider");
  }
  return ctx;
}

export { DEFAULT_FILTERS };
export type { Filters };
