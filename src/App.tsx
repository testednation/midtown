import React, { useState } from 'react';
import { VehicleId, GameMode } from './types';
import { VehicleSelectMenu } from './components/VehicleSelectMenu';
import { GameCanvas } from './components/GameCanvas';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'menu' | 'game'>('menu');
  const [selectedVehicleId, setSelectedVehicleId] = useState<VehicleId>('taxi');
  const [selectedColor, setSelectedColor] = useState<string>('#facc15');
  const [selectedMode, setSelectedMode] = useState<GameMode>('cruise');

  const handleStartGame = (vehicleId: VehicleId, color: string, mode: GameMode) => {
    setSelectedVehicleId(vehicleId);
    setSelectedColor(color);
    setSelectedMode(mode);
    setCurrentScreen('game');
  };

  const handleReturnToMenu = () => {
    setCurrentScreen('menu');
  };

  return (
    <main className="w-screen h-screen overflow-hidden bg-black text-white select-none">
      {currentScreen === 'menu' ? (
        <VehicleSelectMenu
          onStartGame={handleStartGame}
          initialVehicleId={selectedVehicleId}
        />
      ) : (
        <GameCanvas
          vehicleId={selectedVehicleId}
          vehicleColor={selectedColor}
          gameMode={selectedMode}
          onReturnToMenu={handleReturnToMenu}
        />
      )}
    </main>
  );
}
