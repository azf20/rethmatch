import { Column } from "../utils/chakra";
import { Box, Text, Button } from "@chakra-ui/react";
import { Robot } from "../utils/icons";
import { Countdown } from "../utils/Countdown";
import { WORLD_ADDRESS } from "../common";

interface HowToPlaySidebarProps {
  isMobile: boolean;
}

export function HowToPlaySidebar({ isMobile }: HowToPlaySidebarProps) {
  if (isMobile) {
    return (
      <Text textAlign="center" mt={8}>
        Switch to a computer to sign up.
      </Text>
    );
  }

  return (
    <Column
      mainAxisAlignment="flex-start"
      crossAxisAlignment="center"
      maxWidth="269px"
      minWidth="269px"
      overflow="auto"
      className="disableScrollBar fadeBottom"
      height={`calc(100vh - 109px)`}
      marginTop="32px"
      mr={8}
    >
      <Box
        border="1px"
        borderColor="#1A1A1A"
        backgroundColor="#0D0D0D"
        width="100%"
        p={4}
      >
        <Text fontWeight="bold" fontSize="lg" mb={2}>
          How to Play
        </Text>
        <Text fontSize="sm" mb={1}>
          • Click on an entity to spawn next to it.
        </Text>
        <Text fontSize="sm" mb={1}>
          • Use Arrow Keys or WASD to move and jump.
        </Text>
        <Text fontSize="sm">
          • Eat food, avoid walls, and don&apos;t get eaten!
        </Text>
      </Box>

      <Box
        border="1px"
        borderColor="#1A1A1A"
        backgroundColor="#0D0D0D"
        p={4}
        width="100%"
        mt={4}
      >
        <Text fontWeight="bold" fontSize="lg">
          COMPETITION LIVE
        </Text>
        <Text fontSize="sm" mt={2} color="#808080">
          until June 1st, 9pm PT.
        </Text>

        <Box
          mt={4}
          p={3}
          backgroundColor="#1A1A1A"
          borderRadius="1px"
          textAlign="center"
        >
          <Text
            fontSize="xl"
            fontWeight="bold"
            color="#00E893"
            fontFamily="monospace"
          >
            <Countdown targetDate="2025-06-01T21:00:00-08:00" />
          </Text>
        </Box>
      </Box>

      <Box
        border="1px"
        borderColor="#1A1A1A"
        backgroundColor="#0D0D0D"
        p={4}
        width="100%"
        mt={4}
      >
        <Text fontWeight="bold" fontSize="lg">
          HOW TO GET STARTED
        </Text>

        <Text fontSize="sm" mt={2} mb={1} color="#808080">
          Read the guide below to learn how to sign up and get started.
        </Text>

        <Button
          mt={4}
          backgroundColor="#0D0D0D"
          borderColor="#00E893"
          borderWidth="1.5px"
          borderRadius="0"
          width="100%"
          height="42px"
          color="#00E893"
          p={4}
          _hover={{ opacity: 0.8 }}
          _active={{ opacity: 0.35 }}
          as="a"
          href="https://hackmd.io/@t11s/rethmatch"
          target="_blank"
        >
          LEARN HOW{" "}
          <Robot
            style={{
              marginBottom: "2px",
              fill: "#00FF99",
              marginLeft: "12px",
            }}
          />
        </Button>
      </Box>

      <Box
        border="1px"
        borderColor="#1A1A1A"
        backgroundColor="#0D0D0D"
        p={4}
        width="100%"
        mt={4}
        mb={4}
      >
        <Text fontWeight="bold" fontSize="lg">
          QUICK LINKS
        </Text>

        <Box mt={3}>
          <Text fontSize="sm" color="#808080" mb={2}>
            •{" "}
            <Text
              as="a"
              href="https://github.com/paradigmxyz/rethmatch"
              target="_blank"
              color="#00E893"
              _hover={{ opacity: 0.8 }}
              textDecoration="underline"
            >
              Github
            </Text>
          </Text>

          <Text fontSize="sm" color="#808080" mb={2}>
            •{" "}
            <Text
              as="a"
              href="https://x.com/transmissions11/status/1928529682116513798"
              target="_blank"
              color="#00E893"
              _hover={{ opacity: 0.8 }}
              textDecoration="underline"
            >
              X/Twitter
            </Text>
          </Text>

          <Text fontSize="sm" color="#808080">
            •{" "}
            <Text
              as="a"
              href={`https://odyssey-explorer.ithaca.xyz/address/${WORLD_ADDRESS}`}
              target="_blank"
              color="#00E893"
              _hover={{ opacity: 0.8 }}
              textDecoration="underline"
            >
              Contract
            </Text>
          </Text>
        </Box>
      </Box>
    </Column>
  );
}
