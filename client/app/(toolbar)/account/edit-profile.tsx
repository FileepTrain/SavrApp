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
        <ThemedSafeView className="flex-1 pt-safe-or-20">
            <View className="gap-5 px-4 h-full">
                {/*Username bubble*/}
                <Input
                    label="Current Username"
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Username"
                />

                {/*Email bubble*/}
                <Input
                    label="Current Email"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email"
                />

                {/*Save button*/}
                <View className="mt-4">
                    <Button
                        size="lg"
                        onPress={handleSave}
                        disabled={loading}
                        textClassName="font-medium text-lg"
                    >
                        {loading ? "Saving..." : "Save Changes"}
                    </Button>
                </View>

                {/*Delete button*/}
                <View className="mt-auto">

                    <Button
                        size="lg"
                        variant="destructive"
                        className="mb-6"
                        textClassName="font-medium text-lg"
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
                        disabled={loading}
                    >
                        {loading ? "Deleting..." : "Delete Account"}
                    </Button>
                </View>
            </View>
        </ThemedSafeView>
    );
}