import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

export type RecipeNotesPagerRef = {
  setPage: (page: number) => void;
};

type PageSelectedEvent = {
  nativeEvent: { position: number };
};

type Props = {
  style?: StyleProp<ViewStyle>;
  initialPage?: number;
  scrollEnabled?: boolean;
  onPageSelected?: (e: PageSelectedEvent) => void;
  children?: React.ReactNode;
};

/**
 * Web-only stand-in for react-native-pager-view (native-only).
 * Supports the subset of props used by RecipeNotesModal.
 */
function RecipeNotesPager(
  { style, initialPage = 0, onPageSelected, children }: Props,
  ref: React.Ref<RecipeNotesPagerRef>,
) {
  const [page, setPage] = useState(initialPage);
  const onPageSelectedRef = useRef(onPageSelected);
  onPageSelectedRef.current = onPageSelected;

  const setPageAndNotify = useCallback((next: number) => {
    setPage(next);
    onPageSelectedRef.current?.({ nativeEvent: { position: next } });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      setPage: setPageAndNotify,
    }),
    [setPageAndNotify],
  );

  const items = React.Children.toArray(children);

  return (
    <View style={[{ flex: 1 }, style]}>
      {items.map((child, i) => (
        <View
          key={i}
          // `display` is valid on react-native-web; hides inactive pages like a pager.
          style={[
            { flex: 1 },
            page === i
              ? undefined
              : ({ display: "none" } as React.ComponentProps<typeof View>["style"]),
          ]}
        >
          {child}
        </View>
      ))}
    </View>
  );
}

export default forwardRef(RecipeNotesPager);
