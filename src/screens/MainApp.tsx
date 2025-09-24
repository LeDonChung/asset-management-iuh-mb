import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { PlatformPressable } from '@react-navigation/elements';
import {
  useLinkBuilder,
  useTheme,
} from '@react-navigation/native';
import { Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { HomeScreen } from './App/HomeScreen';
import { UnitSelectionScreen } from './App/UnitSelectionScreen';
import { RoomSelectionScreen } from './App/RoomSelectionScreen';
import { InventoryScreen } from './App/InventoryScreen';
import { ProfileScreen } from './App/ProfileScreen';
import { RootStackParamList } from '../types/navigation';
import { SettingScreen } from './App/SettingScreen';

const MyTabBar = ({ state, descriptors, navigation }: any) => {
  const { colors } = useTheme();
  const { buildHref } = useLinkBuilder();
  const getIconName = (routeName: string, focused: boolean) => {
    switch (routeName) {
      case 'home':
        return focused ? 'home' : 'home-outline';
      case 'profile':
        return focused ? 'person' : 'person-outline';
      case 'setting':
        return focused ? 'settings' : 'settings-outline';
      default:
        return 'ellipse';
    }
  };
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.background,
        padding: 5,
      }}
    >
      {state.routes.map(
        (
          route: { key: string; name: string; params?: object },
          index: number,
        ) => {
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;

          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <PlatformPressable
              key={route.key}
              href={buildHref(route.name, route.params)}
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={{ flex: 1, alignItems: 'center' }}
            >
              <Ionicons
                name={getIconName(route.name, isFocused)}
                size={24}
                color={isFocused ? colors.primary : colors.text}
              />
              <Text
                style={{
                  color: isFocused ? colors.primary : colors.text,
                  fontSize: 12,
                }}
              >
                {label}
              </Text>
            </PlatformPressable>
          );
        },
      )}
    </View>
  );
};

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator<RootStackParamList>();

// Home Stack Navigator để chứa HomeScreen và UnitSelectionScreen
const HomeStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="HomeScreen"
    >
      <Stack.Screen name="HomeScreen" component={HomeScreen} />
      <Stack.Screen name="UnitSelectionScreen" component={UnitSelectionScreen} />
      <Stack.Screen name="RoomSelectionScreen" component={RoomSelectionScreen} />
      <Stack.Screen name="InventoryScreen" component={InventoryScreen} />
    </Stack.Navigator>
  );
};

export const MainApp = () => {
  return (
    <Tab.Navigator
      tabBar={props => <MyTabBar {...props} />}
      screenOptions={{ headerShown: false }}
      initialRouteName="home"
      backBehavior="history"
    >
      <Tab.Screen name="home" component={HomeStack} />
      <Tab.Screen name="setting" component={SettingScreen} />
      <Tab.Screen name="profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};
