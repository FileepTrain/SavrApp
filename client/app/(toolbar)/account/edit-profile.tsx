// app/account/edit-profile.tsx
import { ThemedSafeView } from "@/components/themed-safe-view";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

const SERVER_URL = "http://10.0.2.2:3000";

export default function EditProfilesPage() {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    //gets users current username
    useEffect(() => {
        const loadUsername = async () => {
            try {
                const currentUsername = await AsyncStorage.getItem("username");
                if (currentUsername) setUsername(currentUsername);
            } catch (err: any) {
                Alert.alert("Error", err.message);
            }
        };

        const loadEmail = async () => {
            try {
                const currentEmail = await AsyncStorage.getItem("email");
                if (currentEmail) setEmail(currentEmail);
            } catch (err: any) {
                Alert.alert("Error", err.message);
            }
        };

        loadUsername();
        loadEmail();
    }, []);

    const handleSave = async () => {
        try {
            setLoading(true);

            const idToken = await AsyncStorage.getItem("idToken");

            if (!idToken) {
                Alert.alert(
                    "Session expired",
                    "Please log in again to change your username",
                    [{ text: "OK", onPress: () => router.replace("/login") }]
                );
                return;
            }


            const res = await fetch(`${SERVER_URL}/api/auth/update-account`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    idToken,
                    username: username,
                    email: email,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to change username");
            }

            //update account data
            if (username) {
                await AsyncStorage.setItem("username", username);
                setUsername(username);
            }

            if (email) {
                await AsyncStorage.setItem("email", email);
                setEmail(email);
            }

            Alert.alert("Successfully updated account");
        } catch (err: any) {
            Alert.alert("Error failed to update", err.message);
        } finally {
            setLoading(false);
        }

    };

    const handleDelete = async () => {
        try {
            setLoading(true);

            const idToken = await AsyncStorage.getItem("idToken");

            if (!idToken) {
                Alert.alert(
                    "Session expired",
                    "Please log in again to change your username",
                    [{ text: "OK", onPress: () => router.replace("/login") }]
                );
                return;
            }

            const res = await fetch(`${SERVER_URL}/api/auth/delete-account`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ idToken }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to delete account");
            }

            //Clears users account in cache
            await AsyncStorage.multiRemove([
                "idToken",
                "username",
                "email",
            ]);

            router.replace("/login");
        } catch (err: any) {
            Alert.alert("Error", err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ThemedSafeView className="flex-1 bg-[#F5E7E8] pt-safe-or-20">
            <View className="flex-1">
                {/*Username bubble*/}
                <Text className="text-[14px] text-[#1E1E1E]">Current Username</Text>
                <View className="bg-[#F2F2F2] rounded-[28px] px-5">
                    <Input
                        value={username}
                        onChangeText={setUsername}
                        placeholder="Username"
                        autoCapitalize="none"
                    />
                </View>

                {/*Email bubble*/}
                <Text className="text-[14px] text-[#1E1E1E]">Current Email</Text>
                <View className="bg-[#F2F2F2] rounded-[28px] px-5">
                    <Input
                        value={email}
                        onChangeText={setEmail}
                        placeholder="Email"
                        autoCapitalize="none"
                    />
                </View>

                {/*Save button*/}
                <View className="mt-4">
                    <Button
                        size="lg"
                        onPress={handleSave}
                        disabled={loading}
                        className="rounded-full bg-[#FFB0B2]"
                    >
                        {loading ? "Saving..." : "Save"}
                    </Button>
                </View>

                {/*Delete button*/}
                <Pressable
                    onPress={() =>
                        Alert.alert(
                            "Permanently Delete Account?",
                            "This can't be undone!",
                            [
                                { text: "Cancel", style: "cancel" },
                                { text: "Delete", style: "destructive", onPress: handleDelete },
                            ]
                        )
                    }
                    className="mt-auto mb-6 w-full h-[50px] bg-[#EB2D2D] rounded-[12px]"
                    style={{
                        shadowColor: "#000",
                        shadowOpacity: 0.15,
                        shadowOffset: { width: 0, height: 2 },
                        shadowRadius: 4,
                        elevation: 5,
                    }}
                >
                    <View className="flex-1 items-center justify-center">
                        <Text className="text-white font-semibold text-[16px]">Delete Account</Text>
                    </View>
                </Pressable>

            </View>

        </ThemedSafeView>
    );
}