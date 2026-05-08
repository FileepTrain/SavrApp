import PagerView from 'react-native-pager-view';
import React, { forwardRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export type OnboardingPagerProps = {
  style: StyleProp<ViewStyle>;
  initialPage: number;
  pageMargin: number;
  onPageSelected: (e: { nativeEvent: { position: number } }) => void;
  children: React.ReactNode;
  /** Used on web; ignored on native. */
  currentPage?: number;
};

export const OnboardingPager = forwardRef<PagerView, OnboardingPagerProps>(
  function OnboardingPager(
    { style, initialPage, pageMargin, onPageSelected, children },
    ref
  ) {
    return (
      <PagerView
        ref={ref}
        style={style}
        initialPage={initialPage}
        pageMargin={pageMargin}
        onPageSelected={onPageSelected}
      >
        {children}
      </PagerView>
    );
  }
);
