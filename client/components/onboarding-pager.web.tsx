import React, { forwardRef, useImperativeHandle } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';

export type OnboardingPagerProps = {
  style: StyleProp<ViewStyle>;
  initialPage: number;
  pageMargin: number;
  onPageSelected: (e: { nativeEvent: { position: number } }) => void;
  children: React.ReactNode;
  currentPage?: number;
};

export type OnboardingPagerRef = {
  setPage: (index: number) => void;
};

export const OnboardingPager = forwardRef<OnboardingPagerRef, OnboardingPagerProps>(
  function OnboardingPager({ style, children, currentPage = 0 }, ref) {
    const pages = React.Children.toArray(children);

    useImperativeHandle(ref, () => ({
      setPage: () => {
        /* parent already updates currentPage in state */
      },
    }));

    return (
      <View style={style}>
        {pages[currentPage] ?? null}
      </View>
    );
  }
);
