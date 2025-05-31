import { Lines } from "./Lines";

import { Column, Row, useWindowSize } from "./utils/chakra";
import { Logo, Robot } from "./utils/icons";
import {
  Box,
  Button,
  Text,
  Tooltip,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { InfoOutlineIcon } from "@chakra-ui/icons";

import { LiveState } from "./utils/sync";
import { Countdown } from "./utils/Countdown";
import { GameConfig } from "./utils/game/configLib";

import { sum } from "./utils/bigintMinHeap";
import { WORLD_ADDRESS } from "./common";
import { EntityType, toEntityId } from "./utils/game/entityLib";
import { useState, useEffect } from "react";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { set, get, del } from "idb-keyval";
import { createWalletClient, encodeFunctionData, http } from "viem";
import { odysseyTestnet } from "viem/chains";
import { useBalance, usePublicClient } from "wagmi";
import { WORLD_ABI } from "./constants/worldAbi";
import leaderboardArchive from "./leaderboard-archive.json";

const WORLD_CONTRACT =
  "0xC1c9BA50c8E7Ef2b37806de7A5f3D295fB1cF1CE" as `0x${string}`;

export function GameUI({
  liveState,
  gameConfig,
}: {
  liveState: LiveState;
  gameConfig: GameConfig;
}) {
  const { width } = useWindowSize();
  const isMobile = width < 768;

  const [account, setAccount] = useState<{
    address: `0x${string}`;
    privateKey: string;
  } | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showPk, setShowPk] = useState(false);
  const [accessSig, setAccessSig] = useState("");
  const [xUsername, setXUsername] = useState("");
  const [txStatus, setTxStatus] = useState<
    null | "pending" | "success" | string
  >(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [spawnStatus, setSpawnStatus] = useState<
    null | "pending" | "success" | string
  >(null);
  const [moveStatus, setMoveStatus] = useState<
    null | "pending" | "success" | string
  >(null);
  const [actions, setActions] = useState<
    Array<{ action: string; status: string; timestamp: Date }>
  >([]);
  const {
    isOpen: isActionsModalOpen,
    onOpen: onActionsModalOpen,
    onClose: onActionsModalClose,
  } = useDisclosure();

  const { data: balance } = useBalance({
    address: account?.address,
  });

  const publicClient = usePublicClient();

  // Create wallet client at the top level
  const walletClient = account
    ? createWalletClient({
        account: privateKeyToAccount(account.privateKey as `0x${string}`),
        chain: odysseyTestnet,
        transport: http(),
      })
    : null;

  const toast = useToast();

  // Load account from IndexedDB on mount
  useEffect(() => {
    (async () => {
      const stored = await get("rethmatch.account");
      if (stored) {
        try {
          const acc = typeof stored === "string" ? JSON.parse(stored) : stored;
          setAccount(acc);
          if (acc?.address && acc?.privateKey) {
            await set(
              `rethmatch.account.${acc.address.toLowerCase()}`,
              acc.privateKey
            );
          }
        } catch {}
      }
    })();
  }, []);

  const handleGenerateAccount = async () => {
    const pk = generatePrivateKey();
    const acc = privateKeyToAccount(pk);
    const newAccount = { address: acc.address, privateKey: pk };
    setAccount(newAccount);
    setShowDetails(true);
    setShowPk(false);
    await set("rethmatch.account", newAccount);
    await set(`rethmatch.account.${acc.address.toLowerCase()}`, pk);
  };

  const handleDeleteAccount = async () => {
    setAccount(null);
    setShowDetails(false);
    setShowPk(false);
    await del("rethmatch.account");
  };

  // Link Account Handler
  const handleLinkAccount = async () => {
    if (!account || !accessSig || !xUsername) return;
    setTxStatus("pending");
    try {
      await sendTxWithReceipt(
        "access",
        [accessSig, xUsername.toLowerCase()],
        "Account linked!",
        "Link failed"
      );
      setTxStatus("success");
    } catch (err: any) {
      setTxStatus(err.message || "error");
    }
  };

  // Utility to send a transaction and wait for receipt, with toast
  const sendTxWithReceipt = async (
    functionName: string,
    args: any[],
    successMsg?: string,
    errorMsg?: string
  ) => {
    if (!walletClient || !publicClient || !account) return;
    const fullAccount = privateKeyToAccount(
      account.privateKey as `0x${string}`
    );
    try {
      console.log(`Sending transaction for ${functionName} with args:`, args);
      let hash;
      if (functionName === "spawn" || functionName === "access") {
        // Simulate contract for spawn and access
        const { request } = await publicClient.simulateContract({
          account: fullAccount,
          address: WORLD_CONTRACT,
          abi: WORLD_ABI,
          functionName,
          args,
        });
        hash = await walletClient.writeContract({
          ...request,
          account: fullAccount,
        });
      } else {
        // Write contract directly for other actions
        hash = await walletClient.writeContract({
          account: fullAccount,
          address: WORLD_CONTRACT,
          abi: WORLD_ABI,
          functionName,
          args,
        });
      }
      console.log(`Transaction sent for ${functionName} with hash:`, hash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`Transaction receipt for ${functionName}:`, receipt);
      if (receipt.status === "success") {
        console.log(`Transaction for ${functionName} succeeded.`);
        toast({
          title: successMsg || "Transaction Successful",
          description: `Transaction for ${functionName} succeeded.`,
          status: "success",
          duration: 5000,
          isClosable: true,
        });
        return receipt;
      } else {
        console.log(`Transaction for ${functionName} failed.`);
        toast({
          title: errorMsg || "Transaction Failed",
          description: `Transaction for ${functionName} failed.`,
          status: "error",
          duration: 5000,
          isClosable: true,
        });
        return receipt;
      }
    } catch (err: any) {
      toast({
        title: errorMsg || "Transaction Error",
        description: err.message || `Transaction for ${functionName} failed.`,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      console.error(err);
      throw err;
    }
  };

  // Replace sendTx with sendTxWithReceipt everywhere
  const sendTx = async (functionName: string, args: any[]) => {
    return sendTxWithReceipt(functionName, args);
  };

  // Update handleSpawnRequest to use sendTxWithReceipt and toast
  const handleSpawnRequest = async (
    lineId: number,
    rightNeighbor: bigint,
    velRight: boolean
  ) => {
    if (!account || !publicClient) return;
    setSpawnStatus("pending");
    try {
      await sendTxWithReceipt(
        "spawn",
        [lineId, rightNeighbor, velRight],
        "Spawned successfully!",
        "Spawn failed"
      );
      setSpawnStatus("success");
    } catch (err: any) {
      setSpawnStatus(err.message || "error");
    }
  };

  // Function to log actions
  const logAction = (action: string, status: string) => {
    const newAction = { action, status, timestamp: new Date() };
    setActions((prev) => [...prev, newAction]);
    // Store in IndexedDB
    set(`rethmatch.actions.${account?.address.toLowerCase()}`, [
      ...actions,
      newAction,
    ]);
  };

  // Function to handle movement actions
  const handleMove = async (
    direction: string,
    functionName: string,
    args: any[]
  ) => {
    if (!account) return;
    setMoveStatus("pending");
    try {
      await sendTx(functionName, args);
      setMoveStatus("success");
      logAction(`Move ${direction}`, "success");
    } catch (err: any) {
      setMoveStatus(err.message || "error");
      logAction(`Move ${direction}`, err.message || "error");
    }
  };

  // Update handleKeyDown to use the new handleMove function
  const handleKeyDown = async (e: KeyboardEvent) => {
    if (!account) return;
    console.log("handleKeyDown", e.key);
    console.log("moveStatus", moveStatus);
    if (moveStatus === "pending") return; // Prevent spamming while tx pending
    // Movement: left/right
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
      await handleMove("Left", "setDirection", [false]); // left
    } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
      await handleMove("Right", "setDirection", [true]); // right
    }
    // Jumping: up/down
    else if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
      console.log("Jumping Up");
      await handleMove("Up", "jumpToLine", [true]); // up
    } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
      console.log("Jumping Down");
      await handleMove("Down", "jumpToLine", [false]); // down
    }
  };

  // Keyboard controls for movement and jumping
  useEffect(() => {
    if (!account) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [account, moveStatus]);

  return (
    <>
      <Column
        mainAxisAlignment="flex-start"
        crossAxisAlignment="center"
        height="100%"
        width={{ base: "100%", xl: "80%" }}
        px={8}
      >
        {/* Account Generation UI */}
        <Box width="100%" mb={1}>
          {!account ? (
            <Button
              onClick={handleGenerateAccount}
              colorScheme="teal"
              borderRadius="0"
              mb={1}
            >
              Generate New Account
            </Button>
          ) : (
            <Box
              backgroundColor="#1A1A1A"
              borderRadius="4px"
              display="flex"
              alignItems="center"
              px={2}
              py={1}
              minHeight="36px"
              width="100%"
            >
              <Text color="#00E893" fontWeight="bold" fontSize="sm" mr={2}>
                Address:
              </Text>
              <Text
                color="white"
                fontFamily="monospace"
                fontSize="sm"
                noOfLines={1}
                wordBreak="break-all"
                flex={1}
                mr={2}
                title={account.address}
                overflow="hidden"
                textOverflow="ellipsis"
                whiteSpace="nowrap"
              >
                {account.address}
              </Text>
              {balance && (
                <Text
                  color="#00E893"
                  fontSize="sm"
                  fontFamily="monospace"
                  mr={2}
                >
                  {parseFloat(balance.formatted).toFixed(3)} {balance.symbol}
                </Text>
              )}
              <Button
                size="xs"
                onClick={() => setShowDetails((v) => !v)}
                mr={1}
              >
                {showDetails ? "Hide" : "Show"} Details
              </Button>
              <Button size="xs" colorScheme="teal" onClick={onOpen}>
                Link X Account
              </Button>
              <Button size="xs" onClick={onActionsModalOpen} ml={2}>
                View Actions Log
              </Button>
            </Box>
          )}
          {account && showDetails && (
            <Box
              mt={1}
              px={2}
              py={1}
              backgroundColor="#181818"
              borderRadius="4px"
              maxWidth="100%"
            >
              <Button size="xs" onClick={() => setShowPk((v) => !v)} mb={1}>
                {showPk ? "Hide" : "Show"} Private Key
              </Button>
              {showPk && (
                <Box>
                  <Text color="#FF5700" fontWeight="bold" fontSize="sm">
                    Private Key:
                  </Text>
                  <Text
                    color="white"
                    fontFamily="monospace"
                    fontSize="sm"
                    wordBreak="break-all"
                    maxWidth="100%"
                  >
                    {account.privateKey}
                  </Text>
                </Box>
              )}
            </Box>
          )}
        </Box>

        {/* Link X Account Modal */}
        <Modal isOpen={isOpen} onClose={onClose} isCentered>
          <ModalOverlay />
          <ModalContent background="#181818" color="#fff">
            <ModalHeader color="#00E893">Link X Account</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Text fontSize="xs" color="#aaa" mb={2}>
                Paste your access signature and X username to link your account.
              </Text>
              <input
                style={{
                  width: "100%",
                  marginBottom: 8,
                  fontFamily: "monospace",
                  fontSize: 14,
                  padding: 6,
                  borderRadius: 2,
                  border: "1px solid #333",
                  background: "#222",
                  color: "#fff",
                }}
                placeholder="Access Signature (0x...)"
                value={accessSig}
                onChange={(e) => setAccessSig(e.target.value)}
                autoComplete="off"
              />
              <input
                style={{
                  width: "100%",
                  marginBottom: 8,
                  fontFamily: "monospace",
                  fontSize: 14,
                  padding: 6,
                  borderRadius: 2,
                  border: "1px solid #333",
                  background: "#222",
                  color: "#fff",
                }}
                placeholder="X Username (lowercase)"
                value={xUsername}
                onChange={(e) => setXUsername(e.target.value)}
                autoComplete="off"
              />
              {txStatus === "success" && (
                <Text color="#00E893" fontSize="sm" mt={2}>
                  Success! Your account is linked.
                </Text>
              )}
              {txStatus && txStatus !== "pending" && txStatus !== "success" && (
                <Text color="#FF5700" fontSize="sm" mt={2}>
                  {txStatus}
                </Text>
              )}
            </ModalBody>
            <ModalFooter>
              <Button
                size="sm"
                colorScheme="teal"
                borderRadius="0"
                onClick={handleLinkAccount}
                isLoading={txStatus === "pending"}
                isDisabled={!accessSig || !xUsername || txStatus === "pending"}
                mr={2}
              >
                Link Account
              </Button>
              <Button size="sm" onClick={onClose}>
                Close
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {isMobile ? (
          <Text textAlign="center" mt={8}>
            Switch to a computer to sign up.
          </Text>
        ) : null}

        <Row
          mainAxisAlignment="space-between"
          crossAxisAlignment="flex-start"
          width="100%"
          height="100%"
        >
          {!isMobile ? (
            <Column
              mainAxisAlignment="flex-start"
              crossAxisAlignment="center"
              maxWidth="269px"
              minWidth="269px"
              overflow="auto"
              className="disableScrollBar fadeBottom"
              height={`calc(100vh - 109px)`} // paddingTop(32px) + logoBarHeight(45px) + logoBarPaddingTop(32px)
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
                  • Eat food, avoid walls, and don't get eaten!
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
          ) : null}

          <Lines
            liveState={liveState}
            gameConfig={gameConfig}
            onSpawnRequest={handleSpawnRequest}
          />
        </Row>
      </Column>

      <Column
        mainAxisAlignment="flex-start"
        crossAxisAlignment="center"
        height="100%"
        width="20%"
        borderLeft="1px"
        borderColor="#1A1A1A"
        display={{ base: "none", xl: "flex" }}
      >
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

        <Column
          mainAxisAlignment="flex-start"
          crossAxisAlignment="center"
          height="100%"
          width="100%"
          overflowY="auto"
          className="disableScrollBar fadeBottom"
        >
          {Array.from(liveState.gameState.highScores)
            .map(([entityId, highScores]) => [entityId, sum(highScores)]) // Summed to turn k high scores into one ranking score.
            .filter(([_, score]) => score > 0n)
            .sort((a, b) => Number(b[1] - a[1])) // Descending order.
            .map(([entityId, score]) => {
              const username =
                liveState.gameState.usernames.get(entityId) ??
                ("UNKNOWN " + entityId.toString().slice(0, 4)).toUpperCase();

              let displayScore = Math.floor(score.fromWad());
              if (username in leaderboardArchive) {
                displayScore += leaderboardArchive[username as keyof typeof leaderboardArchive];
              }

              return (
                <Row
                  key={entityId.toString()}
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
                  <Text color={"white"}>{username}</Text>
                  <Text color={"#FF5700"}>{displayScore.toLocaleString()}</Text>
                </Row>
              );
            })}

          {/* Active Players Section */}
          <Box
            width="100%"
            borderTop="1px"
            borderColor="#1A1A1A"
            px={8}
            py={4}
            mt={4}
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
                    <Text color="white">
                      {liveState.gameState.usernames.get(entity.entityId)}
                    </Text>
                    <Text color="#FFC000">
                      {Math.floor(entity.mass.fromWad()).toLocaleString()}
                    </Text>
                  </Row>
                ))}
            </Column>
          </Box>
        </Column>
      </Column>

      {/* Add Actions Modal */}
      <Modal
        isOpen={isActionsModalOpen}
        onClose={onActionsModalClose}
        isCentered
      >
        <ModalOverlay />
        <ModalContent background="#181818" color="#fff">
          <ModalHeader color="#00E893">Actions Log</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {actions.map((action, index) => (
              <Text
                key={index}
                fontSize="sm"
                color={action.status === "success" ? "#00E893" : "#FF5700"}
              >
                {action.action}: {action.status} at{" "}
                {action.timestamp.toLocaleTimeString()}
              </Text>
            ))}
          </ModalBody>
          <ModalFooter>
            <Button size="sm" onClick={onActionsModalClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
