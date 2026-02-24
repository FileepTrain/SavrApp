import React, { createContext, useCallback, useContext, useState } from "react";
import { router, usePathname } from "expo-router";
import FilterModal, { Filters } from "@/components/ui/filter_pop_up";

// Initialize default filters when no filters are modified yet
const DEFAULT_FILTERS: Filters = {
  budgetMin: 0,
  budgetMax: 100,
  allergies: [],
  foodTypes: [],
  cookware: [],
};

type HomeFilterContextValue = {
  appliedFilters: Filters;
  setAppliedFilters: (f: Filters | ((prev: Filters) => Filters)) => void;
  resetFilters: () => void;
  openFilterModal: () => void;
};

const HomeFilterContext = createContext<HomeFilterContextValue | null>(null);

function buildSearchParams(filters: Filters): string {
  const params = new URLSearchParams({
    budgetMin: String(filters.budgetMin),
    budgetMax: String(filters.budgetMax),
    allergies: filters.allergies.join(","),
    foodTypes: filters.foodTypes.join(","),
    cookware: filters.cookware.join(","),
  });
  return params.toString();
}

export function HomeFilterProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [appliedFilters, setAppliedFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const openFilterModal = useCallback(() => {
    setDraftFilters(appliedFilters);
    setIsFilterOpen(true);
  }, [appliedFilters]);

  const handleApply = useCallback(() => {
    const next = draftFilters;
    setAppliedFilters(next);
    setIsFilterOpen(false);
    // Move the user to the search page if they are not already on it
    const onSearch = !pathname?.includes("search");
    if (onSearch) {
      router.push(`/(toolbar)/home/search?${buildSearchParams(next)}`);
    }
  }, [draftFilters, pathname]);

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
