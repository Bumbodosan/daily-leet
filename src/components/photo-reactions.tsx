import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  ApiError,
  deleteImageReaction,
  ImageReactionSummary,
  ReactionEmoji,
  reactionEmojis,
  setImageReaction,
} from '@/lib/api';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type PhotoReactionsProps = {
  imageId: string;
  reactions: ImageReactionSummary;
  onError?: (message: string) => void;
};

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return 'Request failed';
}

function applyOptimisticReaction(summary: ImageReactionSummary, nextEmoji: ReactionEmoji | null) {
  const counts = new Map(summary.counts.map((count) => [count.emoji, count.count]));

  if (summary.viewer_emoji) {
    counts.set(summary.viewer_emoji, Math.max(0, (counts.get(summary.viewer_emoji) ?? 0) - 1));
  }

  if (nextEmoji) {
    counts.set(nextEmoji, (counts.get(nextEmoji) ?? 0) + 1);
  }

  return {
    counts: reactionEmojis
      .map((emoji) => ({ emoji, count: counts.get(emoji) ?? 0 }))
      .filter((count) => count.count > 0),
    viewer_emoji: nextEmoji,
  };
}

export function PhotoReactions({ imageId, reactions, onError }: PhotoReactionsProps) {
  const theme = useTheme();
  const [localSummary, setLocalSummary] = useState<{
    imageId: string;
    summary: ImageReactionSummary;
    sourceReactions: ImageReactionSummary;
  } | null>(null);
  const [savingEmoji, setSavingEmoji] = useState<ReactionEmoji | null>(null);
  const summary =
    localSummary?.imageId === imageId && localSummary.sourceReactions === reactions
      ? localSummary.summary
      : reactions;

  const countsByEmoji = useMemo(
    () => new Map(summary.counts.map((count) => [count.emoji, count.count])),
    [summary.counts]
  );

  async function handleReactionPress(emoji: ReactionEmoji) {
    const previousSummary = summary;
    const nextEmoji = summary.viewer_emoji === emoji ? null : emoji;

    setSavingEmoji(emoji);
    setLocalSummary({
      imageId,
      sourceReactions: reactions,
      summary: applyOptimisticReaction(summary, nextEmoji),
    });

    try {
      const result = nextEmoji
        ? await setImageReaction(imageId, nextEmoji)
        : await deleteImageReaction(imageId);

      setLocalSummary({ imageId, sourceReactions: reactions, summary: result.reactions });
    } catch (caughtError) {
      setLocalSummary({ imageId, sourceReactions: reactions, summary: previousSummary });
      onError?.(getErrorMessage(caughtError));
    } finally {
      setSavingEmoji(null);
    }
  }

  return (
    <View style={styles.reactions}>
      {reactionEmojis.map((emoji) => {
        const isSelected = summary.viewer_emoji === emoji;
        const count = countsByEmoji.get(emoji) ?? 0;
        const isSaving = savingEmoji !== null;

        return (
          <Pressable
            key={emoji}
            accessibilityLabel={`${isSelected ? 'Remove' : 'Add'} ${emoji} reaction`}
            accessibilityRole="button"
            disabled={isSaving}
            onPress={() => handleReactionPress(emoji)}
            style={({ pressed }) => [
              styles.reactionButton,
              {
                backgroundColor: isSelected ? theme.backgroundSelected : theme.backgroundElement,
                borderColor: isSelected ? theme.text : theme.backgroundSelected,
                opacity: isSaving && savingEmoji !== emoji ? 0.52 : pressed ? 0.74 : 1,
              },
            ]}>
            <ThemedText style={styles.emoji}>{emoji}</ThemedText>
            {count > 0 ? (
              <ThemedText type="smallBold" style={styles.count}>
                {count}
              </ThemedText>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  reactions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  reactionButton: {
    minWidth: 50,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
  },
  emoji: {
    fontSize: 18,
    lineHeight: 24,
  },
  count: {
    minWidth: 8,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
