// Kiba — Navigation Shell
import React from 'react';
import { View, TouchableOpacity, StyleSheet, GestureResponderEvent } from 'react-native';
import { BlurView } from 'expo-blur';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator, BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../utils/constants';

import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import ScanScreen from '../screens/ScanScreen';
import PantryScreen from '../screens/PantryScreen';
import PetHubScreen from '../screens/PetHubScreen';
import ResultScreen from '../screens/ResultScreen';
import SpeciesSelectScreen from '../screens/SpeciesSelectScreen';
import CreatePetScreen from '../screens/CreatePetScreen';
import EditPetScreen from '../screens/EditPetScreen';
import HealthConditionsScreen from '../screens/HealthConditionsScreen';
import TermsScreen from '../screens/TermsScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import PaywallScreen from '../screens/PaywallScreen';
import CommunityContributionScreen from '../screens/CommunityContributionScreen';
import ProductConfirmScreen from '../screens/ProductConfirmScreen';
import IngredientCaptureScreen from '../screens/IngredientCaptureScreen';
import { useAppStore } from '../stores/useAppStore';
import {
  HomeStackParamList,
  SearchStackParamList,
  ScanStackParamList,
  PantryStackParamList,
  MeStackParamList,
  RootStackParamList,
  TabParamList,
} from '../types/navigation';

// ─── Stack Navigators ───────────────────────────────────

const HomeStack = createNativeStackNavigator<HomeStackParamList>();
function HomeStackScreen() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} />
      <HomeStack.Screen name="Result" component={ResultScreen} />
    </HomeStack.Navigator>
  );
}

const SearchStack = createNativeStackNavigator<SearchStackParamList>();
function SearchStackScreen() {
  return (
    <SearchStack.Navigator screenOptions={{ headerShown: false }}>
      <SearchStack.Screen name="SearchMain" component={SearchScreen} />
      <SearchStack.Screen name="Result" component={ResultScreen} />
    </SearchStack.Navigator>
  );
}

const ScanStack = createNativeStackNavigator<ScanStackParamList>();
function ScanStackScreen() {
  return (
    <ScanStack.Navigator screenOptions={{ headerShown: false }}>
      <ScanStack.Screen name="ScanMain" component={ScanScreen} />
      <ScanStack.Screen name="Result" component={ResultScreen} />
      <ScanStack.Screen name="CommunityContribution" component={CommunityContributionScreen} />
      <ScanStack.Screen name="ProductConfirm" component={ProductConfirmScreen} />
      <ScanStack.Screen name="IngredientCapture" component={IngredientCaptureScreen} />
    </ScanStack.Navigator>
  );
}

const PantryStack = createNativeStackNavigator<PantryStackParamList>();
function PantryStackScreen() {
  return (
    <PantryStack.Navigator screenOptions={{ headerShown: false }}>
      <PantryStack.Screen name="PantryMain" component={PantryScreen} />
      <PantryStack.Screen name="Result" component={ResultScreen} />
    </PantryStack.Navigator>
  );
}

const MeStack = createNativeStackNavigator<MeStackParamList>();
function MeStackScreen() {
  return (
    <MeStack.Navigator screenOptions={{ headerShown: false }}>
      <MeStack.Screen name="MeMain" component={PetHubScreen} />
      <MeStack.Screen name="SpeciesSelect" component={SpeciesSelectScreen} />
      <MeStack.Screen name="CreatePet" component={CreatePetScreen} />
      <MeStack.Screen name="EditPet" component={EditPetScreen} />
      <MeStack.Screen name="HealthConditions" component={HealthConditionsScreen} />
    </MeStack.Navigator>
  );
}

// ─── Root Stack (Onboarding gate) ───────────────────────

const RootStack = createNativeStackNavigator<RootStackParamList>();

// ─── Tab Navigator ──────────────────────────────────────

const Tab = createBottomTabNavigator<TabParamList>();

const KibaDarkTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.accent,
    background: Colors.background,
    card: Colors.tabBarBackground,
    text: Colors.textPrimary,
    border: Colors.tabBarBorder,
    notification: Colors.severityRed,
  },
};

function RaisedScanButton({ children, onPress }: BottomTabBarButtonProps) {
  return (
    <TouchableOpacity style={styles.scanButton} onPress={onPress as (e: GestureResponderEvent) => void} activeOpacity={0.8}>
      <View style={styles.scanButtonInner}>{children}</View>
    </TouchableOpacity>
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.tabBarActive,
        tabBarInactiveTintColor: Colors.tabBarInactive,
        tabBarBackground: () => (
          <BlurView
            intensity={80}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        ),
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopColor: 'rgba(255,255,255,0.08)',
          borderTopWidth: 1,
          height: 88,
          paddingBottom: 28,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStackScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchStackScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Scan"
        component={ScanStackScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="scan-outline" size={28} color="#FFFFFF" />
          ),
          tabBarButton: (props) => <RaisedScanButton {...props} />,
          tabBarLabel: () => null,
        }}
      />
      <Tab.Screen
        name="Pantry"
        component={PantryStackScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="basket-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Me"
        component={MeStackScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// ─── Root Navigation ────────────────────────────────────

export default function Navigation() {
  const hasAcceptedTos = useAppStore((s) => s.hasAcceptedTos);
  const hasCompletedOnboarding = useAppStore((s) => s.hasCompletedOnboarding);

  return (
    <NavigationContainer theme={KibaDarkTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!hasAcceptedTos ? (
          <RootStack.Screen name="Terms" component={TermsScreen} />
        ) : !hasCompletedOnboarding ? (
          <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <RootStack.Screen name="Main" component={TabNavigator} />
        )}
        <RootStack.Screen
          name="Paywall"
          component={PaywallScreen}
          options={{ presentation: 'modal' }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  scanButton: {
    top: -20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
