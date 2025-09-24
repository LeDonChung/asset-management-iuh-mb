import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { LoginScreen } from '../screens/Auth/LoginScreen';
import { ForgotPasswordScreen } from '../screens/Auth/ForgotPasswordScreen';
import { MainApp } from '../screens/MainApp';

const Stack = createStackNavigator();

export const RootNavigator = () => {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        // Authenticated screens
        <Stack.Screen name="MainApp" component={MainApp} />
      ) : (
        // Unauthenticated screens
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};
