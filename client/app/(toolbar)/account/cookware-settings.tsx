import { ThemedSafeView } from "@/components/themed-safe-view";
import { loadUserCookware, saveUserCookware } from "@/utils/cookware";
import { MyCookwareSection } from "@/components/preferences";
import React, { useEffect, useState } from "react";

export default function CookwareSettingsPage() {
  const [selectedCookware, setSelectedCookware] = useState<Set<string>>(
    new Set()
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const saved = await loadUserCookware();
      setSelectedCookware(saved);
      setIsLoading(false);
    };
    load();
  }, []);

  const handleChange = async (next: string[]) => {
    setSelectedCookware(new Set(next));
    await saveUserCookware(new Set(next));
  };

  return (
    <ThemedSafeView className="flex-1 pt-safe-or-20">
      <MyCookwareSection
        value={[...selectedCookware]}
        onChange={handleChange}
        isLoading={isLoading}
      />
    </ThemedSafeView>
  );
}
