import { View, Text, Image } from "react-native";
import React from "react";
import Button from "./ui/button";
import { images } from "@/constants";

const ContinueWithGoogle = () => {
  return (
    <Button size="lg" className="bg-white border border-muted-background">
      <View className="flex-row items-center gap-[10px]">
        <Image
          source={images.googleIcon}
          resizeMode="contain"
          className="w-10 h-10"
        />
        <Text className="text-black text-lg font-roboto-medium">
          Continue with Google
        </Text>
      </View>
    </Button>
  );
};

export default ContinueWithGoogle;
