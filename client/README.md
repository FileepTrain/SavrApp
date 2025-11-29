# How to run React Native Expo on Android emulator

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Set up [Android emulator](https://docs.expo.dev/get-started/set-up-your-environment/?mode=development-build&platform=android&device=simulated) for Windows. Follow the instructions until the end of "Set up an emulator"

2. Run the desired emulator

3. Move into client folder

   ```bash
   cd client
   ```

4. Install dependencies

   ```bash
   npm install
   ```

5. Start the app

   ```bash
   npx expo start
   ```

6. Select android emulator when prompted

   ```bash
   a
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## About the project

The client utilizes:

- Expo (TypeScript)
- Nativewind for tailwind-like CSS styling with semantic variable naming. Refer to ./tailwind.config.js for the list of variables.
