import { Column, Row } from "../utils/chakra";
import { Box, Text, Tooltip } from "@chakra-ui/react";
import { InfoOutlineIcon } from "@chakra-ui/icons";
import { LiveState } from "../utils/sync";
import { GameConfig } from "../utils/game/configLib";
import { EntityType } from "../utils/game/entityLib";
import { sum } from "../utils/bigintMinHeap";
import leaderboardArchive from "../leaderboard-archive.json";

interface LeaderboardSidebarProps {
  liveState: LiveState;
  gameConfig: GameConfig;
  width: number;
}

export function LeaderboardSidebar({
  liveState,
  gameConfig,
  width,
}: LeaderboardSidebarProps) {
  return (
    <Column
      mainAxisAlignment="flex-start"
      crossAxisAlignment="center"
      height="100%"
      width="100%"
      overflowY="auto"
      className="disableScrollBar fadeBottom"
    >
      {/* Active Players Section */}
      <Box
        width="100%"
        borderBottom="1px"
        borderColor="#1A1A1A"
        px={8}
        py={4}
        mb={4}
      >
        <Text fontWeight="bold" fontSize="lg" color="#00E893" mb={2}>
          Active Players
        </Text>
        <Column
          width="100%"
          gap={2}
          mainAxisAlignment="flex-start"
          crossAxisAlignment="center"
        >
          {Array.from(liveState.lines.flat())
            .filter(
              (entity) =>
                entity.etype === EntityType.ALIVE &&
                liveState.gameState.usernames.get(entity.entityId)
            )
            .sort((a, b) => Number(b.mass - a.mass))
            .map((entity) => (
              <Row
                key={entity.entityId.toString()}
                mainAxisAlignment="space-between"
                crossAxisAlignment="center"
                width="100%"
                minHeight="32px"
                borderBottom="1px"
                borderColor="#1A1A1A"
                px={0}
              >
                <a
                  href={`https://x.com/${liveState.gameState.usernames.get(entity.entityId)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#00E893",
                    textDecoration: "underline",
                    fontWeight: "bold",
                    fontFamily: "monospace",
                  }}
                >
                  {liveState.gameState.usernames.get(entity.entityId)}
                </a>
                <Text color="#FFC000">
                  {Math.floor(entity.mass.fromWad()).toLocaleString()}
                </Text>
              </Row>
            ))}
        </Column>
      </Box>

      {/* Player/Overall Score header */}
      <Row
        mainAxisAlignment="space-between"
        crossAxisAlignment="center"
        height="65px"
        width="100%"
        borderBottom="1px"
        borderColor="#1A1A1A"
        px={8}
        color="#808080"
      >
        <Text fontWeight="bold">Player</Text>
        <Tooltip
          label={`Sum of your top ${gameConfig.highScoreTopK} lifetime scores. Each lifetime score = total mass consumed during that life.`}
          bg="#262626"
          fontFamily="BerkeleyMono, monospace"
          hasArrow
          mr={3}
          boxShadow="0 0 5px #262626"
        >
          <Text>
            Overall Score {width < 1440 ? null : <InfoOutlineIcon mb="3px" />}
          </Text>
        </Tooltip>
      </Row>

      {/* Overall Leaderboard Section */}
      {(() => {
        const allPlayers = new Map<
          string,
          { currentScore: number; archiveScore: number }
        >();

        // Add players from current high scores
        Array.from(liveState.gameState.highScores).forEach(
          ([entityId, highScores]) => {
            const username =
              liveState.gameState.usernames.get(entityId) ??
              ("UNKNOWN " + entityId.toString().slice(0, 4)).toUpperCase();

            const currentScore = Math.floor(sum(highScores).fromWad());

            allPlayers.set(username, {
              currentScore,
              archiveScore:
                leaderboardArchive[
                  username as keyof typeof leaderboardArchive
                ] || 0,
            });
          }
        );

        // Add players from archive who aren't already in current scores
        Object.entries(leaderboardArchive).forEach(
          ([username, archiveScore]) => {
            if (!allPlayers.has(username)) {
              allPlayers.set(username, {
                currentScore: 0,
                archiveScore,
              });
            }
          }
        );

        // Convert to array, calculate total scores, filter and sort
        return Array.from(allPlayers.entries())
          .map(([username, data]) => ({
            username,
            totalScore: data.currentScore + data.archiveScore,
          }))
          .filter((player) => player.totalScore > 0)
          .sort((a, b) => b.totalScore - a.totalScore)
          .map(({ username, totalScore }) => (
            <Row
              key={username}
              mainAxisAlignment="space-between"
              crossAxisAlignment="center"
              width="100%"
              minHeight="50px"
              borderBottom="1px"
              borderColor="#1A1A1A"
              px={8}
              _hover={{
                backgroundColor: "#0D0D0d",
              }}
            >
              <a
                href={`https://x.com/${username}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "#00E893",
                  textDecoration: "underline",
                  fontWeight: "bold",
                  fontFamily: "monospace",
                }}
              >
                {username}
              </a>
              <Text color={"#FF5700"}>{totalScore.toLocaleString()}</Text>
            </Row>
          ));
      })()}
    </Column>
  );
}
