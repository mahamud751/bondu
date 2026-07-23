import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '../theme';
import { ProDrawCanvas, type DrawStroke } from './ProDrawCanvas';

export type GameState = {
  id: string;
  status: string;
  drawerId?: string | null;
  word?: string | null;
  wordHint?: string | null;
  round?: number;
  maxRounds?: number;
  scores?: Record<string, number>;
  strokes?: DrawStroke[] | Array<{ x: number; y: number; type?: string }>;
  isDrawer?: boolean;
};

function normalizeStrokes(raw: GameState['strokes']): DrawStroke[] {
  if (!raw?.length) return [];
  // New format
  if ((raw[0] as DrawStroke).points) return raw as DrawStroke[];
  // Legacy point stream → one stroke
  const pts = (raw as Array<{ x: number; y: number }>).map((p) => ({
    x: p.x,
    y: p.y,
  }));
  return pts.length ? [{ color: '#FFFFFF', width: 4, points: pts }] : [];
}

type Props = {
  game: GameState | null;
  isHost: boolean;
  onStart: () => void;
  onEnd: () => void;
  onStroke: (strokes: DrawStroke[]) => void;
  onGuess: (guess: string) => void;
};

/** In-room Draw & Guess mini-game panel */
export function DrawGuessGame({
  game,
  isHost,
  onStart,
  onEnd,
  onStroke,
  onGuess,
}: Props) {
  const [guess, setGuess] = useState('');
  const strokes = normalizeStrokes(game?.strokes);

  if (!game || game.status === 'ENDED') {
    return isHost ? (
      <View style={styles.panel}>
        <Text style={styles.title}>Draw & Guess</Text>
        <Pressable style={styles.btn} onPress={onStart}>
          <Text style={styles.btnText}>Start mini-game</Text>
        </Pressable>
      </View>
    ) : null;
  }

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Draw & Guess · R{game.round}/{game.maxRounds}
        </Text>
        {isHost ? (
          <Pressable onPress={onEnd}>
            <Text style={styles.end}>End</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.hint}>
        {game.isDrawer
          ? `Draw: ${game.word ?? '…'}`
          : `Hint: ${game.wordHint ?? '…'}`}
      </Text>

      <ProDrawCanvas
        strokes={strokes}
        enabled={!!game.isDrawer}
        onChange={(next) => onStroke(next)}
        height={160}
        color="#FFFFFF"
        width={4}
      />

      {!game.isDrawer ? (
        <View style={styles.guessRow}>
          <TextInput
            style={styles.input}
            value={guess}
            onChangeText={setGuess}
            placeholder="Your guess"
            placeholderTextColor="rgba(255,255,255,0.4)"
            maxLength={40}
          />
          <Pressable
            style={styles.btn}
            onPress={() => {
              if (!guess.trim()) return;
              onGuess(guess.trim());
              setGuess('');
            }}
          >
            <Text style={styles.btnText}>Guess</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(160,32,240,0.35)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { color: colors.gold, fontWeight: '900', fontSize: 12 },
  end: { color: colors.danger, fontWeight: '800', fontSize: 12 },
  hint: { color: '#fff', fontWeight: '700', fontSize: 12, marginTop: 4 },
  guessRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  input: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    color: '#fff',
    fontSize: 13,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});
