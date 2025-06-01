import { Lines } from "./Lines";
import { Column, Row, useWindowSize } from "./utils/chakra";
import {
  Box,
  Button,
  Text,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  useToast,
  Checkbox,
  IconButton,
  Input,
} from "@chakra-ui/react";
import { LiveState } from "./utils/sync";
import { GameConfig } from "./utils/game/configLib";
import { useState, useEffect, useRef } from "react";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { set, get } from "idb-keyval";
import { createWalletClient, http, parseGwei } from "viem";
import { odysseyTestnet } from "viem/chains";
import { useBalance, usePublicClient, useTransactionCount } from "wagmi";
import { WORLD_ABI } from "./constants/worldAbi";
import { WORLD_ADDRESS } from "./common";
import { HowToPlaySidebar } from "./components/HowToPlaySidebar";
import { LeaderboardSidebar } from "./components/LeaderboardSidebar";
import { CopyIcon } from "@chakra-ui/icons";

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
  const {
    isOpen: isGetEthModalOpen,
    onOpen: onGetEthModalOpen,
    onClose: onGetEthModalClose,
  } = useDisclosure();

  const { data: balance, refetch: refetchBalance } = useBalance({
    address: account?.address,
  });
  const [autoNonceMode, setAutoNonceMode] = useState(false);
  const { data: nonce, refetch: refetchNonce } = useTransactionCount({
    address: account?.address,
  });

  const txnCount = useRef(0);

  const [maxFeePerGas, setMaxFeePerGas] = useState(0);

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
        } catch {
          console.error("Error loading account from IndexedDB");
        }
      }
    })();
  }, []);

  // Load xUsername from localStorage on mount
  useEffect(() => {
    const storedXUsername = localStorage.getItem("rethmatch.xUsername");
    if (storedXUsername) setXUsername(storedXUsername);
  }, []);

  const handleGenerateAccount = async () => {
    const pk = generatePrivateKey();
    const acc = privateKeyToAccount(pk);
    const newAccount = { address: acc.address, privateKey: pk };
    setAccount(newAccount);
    setShowDetails(false);
    setShowPk(false);
    await set("rethmatch.account", newAccount);
    await set(`rethmatch.account.${acc.address.toLowerCase()}`, pk);
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setTxStatus(err.message || "error");
    }
  };

  // Utility to send a transaction and wait for receipt, with toast
  const sendTxWithReceipt = async (
    functionName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args: any[],
    successMsg?: string,
    errorMsg?: string
  ) => {
    if (!walletClient || !publicClient) return;
    try {
      console.log(`Sending transaction for ${functionName} with args:`, args);
      let hash;
      const currentNonce =
        autoNonceMode && nonce !== undefined
          ? Number(BigInt(nonce) + BigInt(txnCount.current))
          : undefined;

      if (functionName === "spawn" || functionName === "access") {
        // Simulate contract for spawn and access
        const { request } = await publicClient.simulateContract({
          account: walletClient.account,
          address: WORLD_ADDRESS,
          abi: WORLD_ABI,
          functionName,
          maxFeePerGas: maxFeePerGas
            ? parseGwei(maxFeePerGas.toString())
            : undefined,
          args,
        });
        hash = await walletClient.writeContract({
          ...request,
          account: walletClient.account,
          gas: 2_000_000n,
          nonce: currentNonce,
        });
      } else {
        // Write contract directly for other actions
        hash = await walletClient.writeContract({
          account: walletClient.account,
          address: WORLD_ADDRESS,
          abi: WORLD_ABI,
          functionName,
          args,
          maxFeePerGas: maxFeePerGas
            ? parseGwei(maxFeePerGas.toString())
            : undefined,
          gas: 2_000_000n,
          nonce: currentNonce,
        });
      }
      // Increment txnCount after successful transaction
      if (autoNonceMode) {
        txnCount.current += 1;
      }
      console.log(`Transaction sent for ${functionName} with hash:`, hash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`Transaction receipt for ${functionName}:`, receipt);
      refetchBalance();
      if (receipt.status === "success") {
        console.log(`Transaction for ${functionName} succeeded.`);
        toast({
          title: successMsg || "Transaction Successful",
          description: `Transaction for ${functionName} succeeded.`,
          status: "success",
          duration: 2000,
          isClosable: true,
        });
        return receipt;
      } else {
        console.log(`Transaction for ${functionName} failed.`);
        toast({
          title: errorMsg || "Transaction Failed",
          description: `Transaction for ${functionName} failed.`,
          status: "error",
          duration: 3000,
          isClosable: true,
        });
        return receipt;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      // If transaction fails, refetch nonce and reset txnCount
      if (autoNonceMode) {
        refetchNonce();
        txnCount.current = 0;
      }
      toast({
        title: errorMsg || "Transaction Error",
        description: err.message || `Transaction for ${functionName} failed.`,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      console.error(err);
      throw err;
    }
  };

  // Replace sendTx with sendTxWithReceipt everywhere
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sendTx = async (functionName: string, args: any[]) => {
    return sendTxWithReceipt(functionName, args);
  };

  // Update handleSpawnRequest to use sendTxWithReceipt and toast
  const handleSpawnRequest = async (
    lineId: number,
    rightNeighbor: bigint,
    velRight: boolean
  ) => {
    if (!account || !publicClient || !xUsername) {
      toast({
        title: "X Username Required",
        description: "Please enter your X account username before spawning.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
      return;
    }
    if (spawnStatus === "pending") return;
    setSpawnStatus("pending");
    try {
      await sendTxWithReceipt(
        "spawn",
        [lineId, rightNeighbor, velRight],
        "Spawned successfully!",
        "Spawn failed"
      );
      setSpawnStatus("success");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setSpawnStatus(err.message || "error");
    }
  };

  // Track pending moves for each direction using useRef
  const pendingMoves = useRef<{
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
  }>({
    left: false,
    right: false,
    up: false,
    down: false,
  });

  // Function to handle movement actions
  const handleMove = async (
    direction: string,
    functionName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args: any[]
  ) => {
    if (!account) return;
    // Check if this direction is already pending
    const directionKey =
      direction.toLowerCase() as keyof typeof pendingMoves.current;
    if (pendingMoves.current[directionKey]) {
      toast({
        title: "Move Pending",
        description: `Move in ${direction} is already pending`,
        status: "info",
        duration: 1000,
        isClosable: true,
      });
      console.log("Move pending, skipping");
      return;
    }
    // Set this direction as pending
    pendingMoves.current[directionKey] = true;

    try {
      toast({
        title: "Moving",
        description: `Moving ${direction}`,
        status: "info",
        duration: 1000,
        isClosable: true,
      });
      await sendTx(functionName, args);
      // Clear the pending state for this direction
      pendingMoves.current[directionKey] = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      // Clear the pending state on error
      pendingMoves.current[directionKey] = false;
      toast({
        title: "Move Failed",
        description: err.message || "Move failed",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Update handleKeyDown to use the new handleMove function
  const handleKeyDown = async (e: KeyboardEvent) => {
    if (!account) return;
    console.log("handleKeyDown", e.key);
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
    if (!account || !xUsername) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, xUsername]);

  // Experimental modal state
  const {
    isOpen: isExperimentalOpen,
    onOpen: onExperimentalOpen,
    onClose: onExperimentalClose,
  } = useDisclosure();

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
              <a
                href={`https://odyssey-explorer.ithaca.xyz/address/${account.address}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "#fff",
                  fontFamily: "monospace",
                  fontSize: "sm",
                  textDecoration: "underline",
                  wordBreak: "break-all",

                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                }}
                title={account.address}
              >
                {account.address}
              </a>
              <IconButton
                aria-label="Copy address"
                icon={<CopyIcon />}
                size="xs"
                variant="ghost"
                colorScheme="teal"
                onClick={() => {
                  navigator.clipboard.writeText(account.address);
                  toast({
                    title: "Address Copied",
                    description: "Address copied to clipboard",
                    status: "success",
                    duration: 2000,
                    isClosable: true,
                  });
                }}
                ml={1}
              />
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
              {/* Show Get testnet ETH button if balance is 0 */}
              {balance && Number(balance.value) === 0 && (
                <Button
                  size="xs"
                  colorScheme="orange"
                  ml={2}
                  onClick={onGetEthModalOpen}
                >
                  Get testnet ETH
                </Button>
              )}
              <Button
                size="xs"
                colorScheme="gray"
                ml={2}
                onClick={onExperimentalOpen}
              >
                Experimental
              </Button>
              {/* X Username input field, always visible when account is present */}
              <input
                style={{
                  width: "180px",
                  marginLeft: "8px",
                  fontFamily: "monospace",
                  fontSize: 14,
                  padding: 4,
                  borderRadius: 2,
                  border: "1px solid #333",
                  background: "#222",
                  color: "#fff",
                }}
                placeholder="X Username (required)"
                value={xUsername}
                onChange={(e) => {
                  setXUsername(e.target.value);
                  localStorage.setItem("rethmatch.xUsername", e.target.value);
                }}
                autoComplete="off"
              />
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
          <HowToPlaySidebar isMobile={isMobile} />
          <Lines
            liveState={liveState}
            gameConfig={gameConfig}
            onSpawnRequest={handleSpawnRequest}
            xUsername={xUsername}
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
        <LeaderboardSidebar
          liveState={liveState}
          gameConfig={gameConfig}
          width={width}
        />
      </Column>

      {/* Modal for getting testnet ETH */}
      <Modal isOpen={isGetEthModalOpen} onClose={onGetEthModalClose} isCentered>
        <ModalOverlay />
        <ModalContent background="#181818" color="#fff">
          <ModalHeader color="#00E893">Get Testnet ETH</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text mb={3}>
              You are on <b>Odyssey</b> testnet. To get ETH:
            </Text>
            <Text mb={2}>
              1. Read about Odyssey and its testnet at{" "}
              <a
                href="https://ithaca.xyz/updates/odyssey"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#00E893", textDecoration: "underline" }}
              >
                ithaca.xyz/updates/odyssey
              </a>
              .
            </Text>
            <Text mb={2}>
              2. Bridge funds from Sepolia using the official bridge at{" "}
              <a
                href="https://hub.conduit.xyz/odyssey"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#00E893", textDecoration: "underline" }}
              >
                hub.conduit.xyz/odyssey
              </a>
              .
            </Text>
            <Text fontSize="sm" color="#aaa">
              (You will need Sepolia ETH to bridge. The process is fast if you
              have some.)
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button size="sm" onClick={onGetEthModalClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={isExperimentalOpen}
        onClose={onExperimentalClose}
        isCentered
      >
        <ModalOverlay />
        <ModalContent background="#181818" color="#fff">
          <ModalHeader color="#00E893">Experimental Settings</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text fontSize="sm" color="#aaa" mb={3}>
              These options are for advanced users and may reduce RPC calls for
              faster gameplay. Use at your own risk!
            </Text>
            <Checkbox
              isChecked={autoNonceMode}
              onChange={(e) => {
                const newValue = e.target.checked;
                setAutoNonceMode(newValue);
                if (newValue) {
                  refetchNonce();
                  txnCount.current = 0;
                }
              }}
              size="md"
              colorScheme="teal"
              mb={4}
            >
              <Text fontSize="sm" color="#00E893">
                Auto Nonce Mode
              </Text>
            </Checkbox>
            <Box mt={2}>
              <Text fontSize="sm" color="#00E893" mb={1}>
                Max Fee Per Gas (Gwei)
              </Text>
              <Input
                type="number"
                min={0}
                value={maxFeePerGas}
                onChange={(e) => setMaxFeePerGas(Number(e.target.value))}
                placeholder="Default (leave blank)"
                background="#222"
                color="#fff"
                borderColor="#333"
                fontFamily="monospace"
                fontSize={14}
                width="100%"
              />
              <Text fontSize="xs" color="#aaa" mt={1}>
                If set to <b>0</b>, the fee will be estimated on the fly for
                each transaction.
              </Text>
            </Box>
          </ModalBody>
          <ModalFooter>
            <Button size="sm" onClick={onExperimentalClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
