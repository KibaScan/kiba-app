// Kiba — Navigation Shell
import React from 'react';
import { View, TouchableOpacity, StyleSheet, GestureResponderEvent } from 'react-native';
import { BlurView } from 'expo-blur';
import { NavigationContainer, DefaultTheme, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator, BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../utils/constants';

import HomeScreen from '../screens/HomeScreen';
import CommunityScreen from '../screens/CommunityScreen';
import ScanScreen from '../screens/ScanScreen';
import PantryScreen from '../screens/PantryScreen';
import EditPantryItemScreen from '../screens/EditPantryItemScreen';
import PetHubScreen from '../screens/PetHubScreen';
import ResultScreen from '../screens/ResultScreen';
import RecallDetailScreen from '../screens/RecallDetailScreen';
import SpeciesSelectScreen from '../screens/SpeciesSelectScreen';
import CreatePetScreen from '../screens/CreatePetScreen';
import EditPetScreen from '../screens/EditPetScreen';
import HealthConditionsScreen from '../screens/HealthConditionsScreen';
import MedicationFormScreen from '../screens/MedicationFormScreen';
import MedicationsListScreen from '../screens/MedicationsListScreen';
import AppointmentsListScreen from '../screens/AppointmentsListScreen';
import MedicalRecordsScreen from '../screens/MedicalRecordsScreen';
import CreateAppointmentScreen from '../screens/CreateAppointmentScreen';
import AppointmentDetailScreen from '../screens/AppointmentDetailScreen';
import NotificationPreferencesScreen from '../screens/NotificationPreferencesScreen';
import BCSReferenceScreen from '../screens/BCSReferenceScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TermsScreen from '../screens/TermsScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import PaywallScreen from '../screens/PaywallScreen';
import CommunityContributionScreen from '../screens/CommunityContributionScreen';
import ProductConfirmScreen from '../screens/ProductConfirmScreen';
import IngredientCaptureScreen from '../screens/IngredientCaptureScreen';
import CompareScreen from '../screens/CompareScreen';
import SafeSwitchSetupScreen from '../screens/SafeSwitchSetupScreen';
import SafeSwitchDetailScreen from '../screens/SafeSwitchDetailScreen';
import { useAppStore } from '../stores/useAppStore';
import {
  HomeStackParamList,
  CommunityStackParamList,
  ScanStackParamList,
  PantryStackParamList,
  MeStackParamList,
  RootStackParamList,
  TabParamList,
} from '../types/navigation';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// ─── Stack Navigators ───────────────────────────────────

const HomeStack = createNativeStackNavigator<HomeStackParamList>();
function HomeStackScreen() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} />
      <HomeStack.Screen name="Result" component={ResultScreen} />
      <HomeStack.Screen name="RecallDetail" component={RecallDetailScreen} />
      <HomeStack.Screen name="AppointmentDetail" component={AppointmentDetailScreen} />
      <HomeStack.Screen name="Compare" component={CompareScreen} />
      <HomeStack.Screen name="SafeSwitchDetail" component={SafeSwitchDetailScreen} />
    </HomeStack.Navigator>
  );
}

const CommunityStack = createNativeStackNavigator<CommunityStackParamList>();
function CommunityStackScreen() {
  return (
    <CommunityStack.Navigator screenOptions={{ headerShown: false }}>
      <CommunityStack.Screen name="CommunityMain" component={CommunityScreen} />
      <CommunityStack.Screen name="Result" component={ResultScreen} />
      <CommunityStack.Screen name="RecallDetail" component={RecallDetailScreen} />
      <CommunityStack.Screen name="Compare" component={CompareScreen} />
    </CommunityStack.Navigator>
  );
}

const ScanStack = createNativeStackNavigator<ScanStackParamList>();
function ScanStackScreen() {
  return (
    <ScanStack.Navigator screenOptions={{ headerShown: false }}>
      <ScanStack.Screen name="ScanMain" component={ScanScreen} />
      <ScanStack.Screen name="Result" component={ResultScreen} />
      <ScanStack.Screen name="RecallDetail" component={RecallDetailScreen} />
      <ScanStack.Screen name="CommunityContribution" component={CommunityContributionScreen} />
      <ScanStack.Screen name="ProductConfirm" component={ProductConfirmScreen} />
      <ScanStack.Screen name="IngredientCapture" component={IngredientCaptureScreen} />
      <ScanStack.Screen name="Compare" component={CompareScreen} />
    </ScanStack.Navigator>
  );
}

const PantryStack = createNativeStackNavigator<PantryStackParamList>();
function PantryStackScreen() {
  return (
    <PantryStack.Navigator screenOptions={{ headerShown: false }}>
      <PantryStack.Screen name="PantryMain" component={PantryScreen} />
      <PantryStack.Screen name="EditPantryItem" component={EditPantryItemScreen} />
      <PantryStack.Screen name="SafeSwitchSetup" component={SafeSwitchSetupScreen} />
      <PantryStack.Screen name="SafeSwitchDetail" component={SafeSwitchDetailScreen} />
      <PantryStack.Screen name="Result" component={ResultScreen} />
      <PantryStack.Screen name="RecallDetail" component={RecallDetailScreen} />
      <PantryStack.Screen name="Compare" component={CompareScreen} />
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
      <MeStack.Screen name="BCSReference" component={BCSReferenceScreen} />
      <MeStack.Screen name="MedicationForm" component={MedicationFormScreen} />
      <MeStack.Screen name="Medications" component={MedicationsListScreen} />
      <MeStack.Screen name="MedicalRecords" component={MedicalRecordsScreen} />
      <MeStack.Screen name="Appointments" component={AppointmentsListScreen} />
      <MeStack.Screen name="CreateAppointment" component={CreateAppointmentScreen} />
      <MeStack.Screen name="AppointmentDetail" component={AppointmentDetailScreen} />
      <MeStack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} />
      <MeStack.Screen name="Settings" component={SettingsScreen} />
      <MeStack.Screen name="Result" component={ResultScreen} />
      <MeStack.Screen name="RecallDetail" component={RecallDetailScreen} />
      <MeStack.Screen name="Compare" component={CompareScreen} />
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
        name="Community"
        component={CommunityStackScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
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
    <NavigationContainer ref={navigationRef} theme={KibaDarkTheme}>
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
