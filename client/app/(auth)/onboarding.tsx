import { ThemedSafeView } from '@/components/themed-safe-view';
import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { OnboardingPager } from '@/components/onboarding-pager';
import { IconSymbol } from '@/components/ui/icon-symbol';
import Button from '@/components/ui/button';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppPreferences } from '@/contexts/app-preferences-context';
import {
  AccessibilitySection,
  BudgetPreferencesSection,
  DietaryPreferencesSection,
  LocationSharingSection,
  MyCookwareSection,
  NutrientDisplaySection,
  UserPreferencesDraft,
} from '@/components/preferences';

import { SERVER_URL } from '@/utils/server-url';

const initialDraft: UserPreferencesDraft = {
  cookware: [],
  diets: [],
  allergies: [],
  budget: 100,
  accessibility: {
    themePreference: "system",
    textSize: 3,
  },
  nutrientDisplay: ["Calories", "Protein", "Fat", "Carbohydrates", "Fiber"],
  shareLocation: false,
};

export default function OnboardingPage() {
  const pagerRef = React.useRef<{ setPage: (index: number) => void } | null>(null);
  const { themePreference, textSize, setThemePreference, setTextSize } = useAppPreferences();
  const [currentPage, setCurrentPage] = React.useState(0);
  const [draft, setDraft] = React.useState<UserPreferencesDraft>(initialDraft);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  const totalPages = 7;
  const lastPageIndex = totalPages - 1;

  const goToPage = React.useCallback(
    (pageIndex: number) => {
      const clamped = Math.max(0, Math.min(pageIndex, totalPages - 1));
      setCurrentPage(clamped);
      pagerRef.current?.setPage(clamped);
      setErrorMessage('');
    },
    [totalPages]
  );

  const goNext = React.useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const goPrev = React.useCallback(() => goToPage(currentPage - 1), [currentPage, goToPage]);

  const finishOnboarding = React.useCallback(async () => {
    try {
      setIsSaving(true);
      const idToken = await AsyncStorage.getItem("idToken");

      if (idToken) {
        const response = await fetch(`${SERVER_URL}/api/auth/update-preferences`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cookware: draft.cookware,
            diets: draft.diets,
            allergies: draft.allergies,
            budget: draft.budget,
            nutrientDisplay: draft.nutrientDisplay,
            locationEnabled: draft.shareLocation,
            appPreferences: draft.accessibility,
            onboarded: true, // Indicate that the user has completed the onboarding process
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.warn("Failed to update onboarding preferences on server", errorData);
        }
      }

      await AsyncStorage.setItem("USER_COOKWARE", JSON.stringify(draft.cookware));
      await AsyncStorage.setItem("diets", JSON.stringify(draft.diets));
      await AsyncStorage.setItem("allergies", JSON.stringify(draft.allergies));
      await AsyncStorage.setItem("USER_BUDGET", JSON.stringify(draft.budget));
      await AsyncStorage.setItem("APP_PREFERENCES", JSON.stringify(draft.accessibility));
      await AsyncStorage.setItem("NUTRIENT_DISPLAY", JSON.stringify(draft.nutrientDisplay));
      await AsyncStorage.setItem("LOCATION_ENABLED", draft.shareLocation ? "true" : "false");
      await AsyncStorage.setItem("onboarded", "true");
      router.replace('/home');
    } finally {
      setIsSaving(false);
    }
  }, [draft]);

  const handleSkip = React.useCallback(() => {
    if (currentPage === lastPageIndex) {
      void finishOnboarding();
      return;
    }
    goToPage(lastPageIndex);
  }, [currentPage, finishOnboarding, goToPage, lastPageIndex]);

  const handleRightPress = React.useCallback(() => {
    if (currentPage === lastPageIndex) {
      void finishOnboarding();
      return;
    }
    goNext();
  }, [currentPage, finishOnboarding, goNext, lastPageIndex]);

  const onPressDot = React.useCallback(
    (pageIndex: number) => {
      goToPage(pageIndex);
    },
    [goToPage]
  );

  React.useEffect(() => {
    setDraft((prev) => ({
      ...prev,
      accessibility: {
        themePreference,
        textSize,
      },
    }));
  }, [textSize, themePreference]);

  const renderStepContent = () => {
    if (currentPage === 0) {
      return <WelcomeStep />;
    }
    if (currentPage === 1) {
      return (
        <>
          <Text className="text-foreground text-2xl font-bold px-4">My Cookware</Text>
          <Text className="text-muted-foreground text-base px-4">Select the cookware you have. You can search for recipes that use these equipment.</Text>
          <MyCookwareSection
            value={draft.cookware}
            onChange={(cookware) => setDraft((prev) => ({ ...prev, cookware }))}
          />
        </>
      );
    }
    if (currentPage === 2) {
      return (
        <>
          <Text className="text-foreground text-2xl font-bold px-4">Dietary Preferences</Text>
          <Text className="text-muted-foreground text-base px-4">You may choose to the selected exclude allergies and diets from recipe searches.</Text>
          <DietaryPreferencesSection
            selectedDiets={draft.diets}
            selectedAllergies={draft.allergies}
            onChangeDiets={(diets) => setDraft((prev) => ({ ...prev, diets }))}
            onChangeAllergies={(allergies) => setDraft((prev) => ({ ...prev, allergies }))}
          />
        </>
      );
    }
    if (currentPage === 3) {
      return (
        <View className="gap-4 px-4">
          <Text className="text-foreground text-2xl font-bold">Budget Preferences</Text>
          <BudgetPreferencesSection
            value={draft.budget}
            onChange={(budget) => setDraft((prev) => ({ ...prev, budget }))}
          />
        </View>
      );
    }
    if (currentPage === 4) {
      return (
        <View className="gap-4 px-4">
          <Text className="text-foreground text-2xl font-bold">Accessibility</Text>
          <Text className="text-muted-foreground text-base">Modify the layout of the entire app to your preference.</Text>
          <AccessibilitySection
            value={draft.accessibility}
            onChange={(accessibility) => {
              setDraft((prev) => ({ ...prev, accessibility }));
              setThemePreference(accessibility.themePreference);
              setTextSize(accessibility.textSize);
            }}
          />
        </View>
      );
    }
    if (currentPage === 5) {
      return (
        <>
          <Text className="text-foreground text-2xl font-bold px-4">Nutrient Display</Text>
          <Text className="text-muted-foreground text-base px-4">Select the nutrients you want to display when viewing a recipe's details.</Text>
          <NutrientDisplaySection
            value={draft.nutrientDisplay}
            onChange={(nutrientDisplay) => setDraft((prev) => ({ ...prev, nutrientDisplay }))}
            error={errorMessage}
          />
        </>
      );
    }
    return (
      <View className="gap-4 px-4">
        <Text className="text-foreground text-2xl font-bold">Share Your Location</Text>
        <Text className="text-muted-foreground text-base">We use your location to search for ingredients from your local stores.</Text>
        <LocationSharingSection
          value={draft.shareLocation}
          onChange={(shareLocation) => setDraft((prev) => ({ ...prev, shareLocation }))}
        />
      </View>
    );
  };

  return (
    <ThemedSafeView className="flex-1 bg-app-background">
      <Pressable onPress={handleSkip} className="self-end">
        <Text className="text-muted-foreground text-base font-medium mb-2">
          {currentPage === lastPageIndex ? 'Finish' : 'Skip'}
        </Text>
      </Pressable>
      <ProgressBar
        currentPage={currentPage}
        totalPages={totalPages}
        onPressDot={onPressDot}
        onPressLeft={goPrev}
        onPressRight={handleRightPress}
      />
      <OnboardingPager
        ref={pagerRef}
        style={styles.pagerView}
        initialPage={0}
        pageMargin={48}
        currentPage={currentPage}
        onPageSelected={(e) => {
          setCurrentPage(e.nativeEvent.position);
          setErrorMessage('');
        }}
      >
        {Array.from({ length: totalPages }).map((_, idx) => (
          <View key={String(idx)} className="flex-1">
            <View className="gap-4 flex-1 mb-16">
              {currentPage === idx ? renderStepContent() : null}
              {!!errorMessage && currentPage === idx ? (
                <Text className="text-red-primary">{errorMessage}</Text>
              ) : null}
              <Button
                variant={idx === 0 ? 'default' : 'primary'}
                className="mt-auto w-full h-16"
                textClassName="font-medium text-lg"
                onPress={() => {
                  if (idx === lastPageIndex) {
                    void finishOnboarding();
                    return;
                  }
                  goNext();
                }}
                disabled={isSaving}
              >
                {idx === 0 ? "Let's go!" : idx === lastPageIndex ? 'Finish setup' : 'Continue'}
              </Button>
            </View>
          </View>
        ))}
      </OnboardingPager>
    </ThemedSafeView>
  );
}

const ProgressBar = ({
  currentPage,
  totalPages,
  onPressDot,
  onPressLeft,
  onPressRight,
}: {
  currentPage: number;
  totalPages: number;
  onPressDot: (pageIndex: number) => void;
  onPressLeft: () => void;
  onPressRight: () => void;
}) => {
  return (
    <View className="mb-4 gap-4">
      <View className="flex-row gap-2 w-full">
        {Array.from({ length: totalPages }).map((_, idx) => {
          const isActive = idx === currentPage;
          return (
            <Pressable
              key={String(idx)}
              className={
                isActive
                  ? 'h-2 flex-1 bg-red-secondary rounded-full'
                  : 'h-2 flex-1 bg-background border border-muted-background rounded-full'
              }
              onPress={() => onPressDot(idx)}
            />
          );
        })}
      </View>
      <View className="flex-row gap-2 w-full justify-between">
        <Pressable
          className="rounded-full w-10 h-10 bg-background border border-muted-background items-center justify-center"
          onPress={onPressLeft}
          disabled={currentPage <= 0}
          style={{ opacity: currentPage <= 0 ? 0.4 : 1 }}
        >
          <IconSymbol name="chevron-left" size={24} color="--color-icon" />
        </Pressable>
        <Pressable
          className="rounded-full w-10 h-10 bg-background border border-muted-background items-center justify-center"
          onPress={onPressRight}
          disabled={currentPage >= totalPages - 1}
          style={{ opacity: currentPage >= totalPages - 1 ? 0.4 : 1 }}
        >
          <IconSymbol name="chevron-right" size={24} color="--color-icon" />
        </Pressable>
      </View>
    </View>
  )
}

const WelcomeStep = () => {
  return (
    <View className="gap-4">
      <Text className="text-foreground text-4xl font-bold">Welcome to <Text className="text-red-primary">Savr</Text></Text>
      <Text className="text-foreground text-xl font-medium">
        Your cooking journey starts here.
      </Text>
      <Text className="text-muted-foreground text-base">
        We will personalize recipes, budgets, and nutrition guidance in a few quick steps.
      </Text>
      <Text className="text-muted-foreground text-base">You can always change this later in Settings.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pagerView: {
    flex: 1,
  },
});