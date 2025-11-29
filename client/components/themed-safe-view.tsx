import {
  SafeAreaView,
  SafeAreaViewProps,
} from "react-native-safe-area-context";

// Component is mainly used to display the main background color of the app based on the current theme
export function ThemedSafeView({ className, ...rest }: SafeAreaViewProps) {
  return (
    <SafeAreaView
      className={`flex-1 px-6 pt-6 bg-app-background ${className ?? ""}`}
      {...rest}
    />
  );
}
