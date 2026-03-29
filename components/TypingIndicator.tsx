import React, { useEffect, useRef } from "react";
import { View, Animated } from "react-native";

export default function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );

    animate(dot1, 0).start();
    animate(dot2, 150).start();
    animate(dot3, 300).start();
  }, []);

  return (
    <View className="flex-row items-center px-4 mb-3">
      <View className="bg-nexus-surface rounded-2xl rounded-bl-sm px-4 py-3 flex-row items-center gap-1">
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View
            key={i}
            style={{ opacity: dot }}
            className="w-2 h-2 rounded-full bg-nexus-textDim"
          />
        ))}
      </View>
    </View>
  );
}
