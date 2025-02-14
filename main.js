import {
  AccountId,
  TopicId,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
} from "@hashgraph/sdk";
import {
  DAppConnector,
  HederaJsonRpcMethod,
  HederaSessionEvent,
  HederaChainId,
} from "@hashgraph/hedera-wallet-connect";

// ---------------------- GLOBALS & NETWORK CONFIG ----------------------
let accountId = "";
let isConnected = false;
let topicId = ""; 

// For testnet configuration:
const NETWORK_CONFIG = {
  testnet: {
    network: "testnet",
    chainId: "0x128",
  },
};

const walletConnectProjectId = "377d75bb6f86a2ffd427d032ff6ea7d3"; 
const currentNetworkConfig = NETWORK_CONFIG.testnet;
const hederaNetwork = currentNetworkConfig.network;

// DApp metadata
const metadata = {
  name: "Hedera HCS Test",
  description: "Simple Hedera WalletConnect Integration to test HCS",
  url: window.location.origin,
  icons: [window.location.origin + "/logo192.png"],
};

// ---------------------- SETUP WALLETCONNECT DAPP CONNECTOR ----------------------
export const dappConnector = new DAppConnector(
  metadata,
  hederaNetwork, 
  walletConnectProjectId,
  Object.values(HederaJsonRpcMethod),
  [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
  [HederaChainId.Testnet] 
);

let walletConnectInitPromise;

const initializeWalletConnect = async () => {
  if (!walletConnectInitPromise) {
    walletConnectInitPromise = dappConnector.init();
  }
  await walletConnectInitPromise;
};

// ---------------------- CONNECT / DISCONNECT LOGIC ----------------------
function syncWalletconnectState() {
  const account = dappConnector.signers[0]?.getAccountId()?.toString();
  if (account) {
    accountId = account;
    isConnected = true;
    updateAccountIdDisplay(accountId);
    console.log("WalletConnect: Connected as", accountId);
  } else {
    accountId = "";
    isConnected = false;
    updateAccountIdDisplay("No account connected");
    console.log("WalletConnect: No account found");
  }
}

async function openWalletConnectModal() {
  try {
    await initializeWalletConnect();
    if (!isConnected) {
      await dappConnector.openModal();
      syncWalletconnectState();
    } else {
      console.log("Already connected.");
    }
  } catch (error) {
    console.error("Failed to open WalletConnect modal", error);
  }
}

async function disconnectWallet() {
  if (isConnected) {
    try {
      await dappConnector.disconnectAll();
      isConnected = false;
      accountId = "";
      updateAccountIdDisplay("No account connected");
      console.log("Disconnected from wallet");
    } catch (error) {
      console.error("Failed to disconnect wallet", error);
    }
  } else {
    console.log("No active session to disconnect from.");
  }
}

// ---------------------- DOM HELPERS ----------------------

function updateAccountIdDisplay(value) {
  const accountIdElement = document.getElementById("accountId");
  const disconnectButton = document.getElementById("disconnectButton");

  if (!accountIdElement || !disconnectButton) return;

  accountIdElement.textContent = value;
  if (value && value !== "No account connected") {
    disconnectButton.textContent = "Connected - Click to Disconnect";
  } else {
    disconnectButton.textContent = "Connect to WalletConnect";
  }
}

function updateTopicIdDisplay(html) {
  const topicIdElem = document.getElementById("topicIdDisplay");
  if (topicIdElem) {
    topicIdElem.innerHTML = html;
  }
}

function updateMessageStatus(html) {
  const msgStatusElem = document.getElementById("messageStatus");
  if (msgStatusElem) {
    msgStatusElem.innerHTML = html;
  }
}

// ---------------------- TOPIC CREATION ----------------------
async function handleTopicCreation() {
  if (!isConnected) {
    console.error("Connect wallet first!");
    updateTopicIdDisplay("Connect a wallet first!");
    return;
  }

  try {
    const signer = dappConnector.signers[0];

    // build transaction
    const createTx = new TopicCreateTransaction().setTopicMemo("Hello from Vanilla JS!");

    // freeze + sign
    await createTx.freezeWithSigner(signer);

    // execute
    const createTxResult = await createTx.executeWithSigner(signer);
    console.log("Topic creation transaction result:", createTxResult);

    // get receipt
    const receipt = await createTxResult.getReceiptWithSigner(signer);
    console.log("Receipt for topic creation:", receipt);

    // console log for debug
    if (receipt.topicId) {
      topicId = receipt.topicId.toString();
      console.log("Topic created with ID:", topicId);

      const hashscanLink = `https://hashscan.io/testnet/topic/${topicId}`;

      // "View on HashScan" link
      updateTopicIdDisplay(`
        ${topicId}
        <br/><br/>
        <a href="${hashscanLink}" target="_blank" class="hashscan-link">
          View on HashScan
        </a>
      `);
    } else {
      console.error("No topicId in receipt:", receipt);
      updateTopicIdDisplay("Topic creation failed (no topicId)");
    }
  } catch (err) {
    console.error("Topic creation error:", err);
    updateTopicIdDisplay(`Topic creation error: ${err.message}`);
  }
}

// ---------------------- MESSAGE SUBMISSION ----------------------
async function handleTopicMessageSubmission() {
  if (!isConnected) {
    console.error("Connect wallet first!");
    updateMessageStatus("Connect a wallet first!");
    return;
  }
  if (!topicId) {
    console.error("No topicId found—create a topic first!");
    updateMessageStatus("No topic to submit to—create a topic first!");
    return;
  }

  try {
    const signer = dappConnector.signers[0];
    const messageInput = document.getElementById("messageInput");
    if (!messageInput?.value) {
      console.error("No message provided.");
      updateMessageStatus("Please enter a message first.");
      return;
    }

    const message = messageInput.value;

    // build tx
    const submitTx = new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(topicId))
      .setMessage(message);

    // freeze + sign
    await submitTx.freezeWithSigner(signer);

    // execute
    const submitTxResult = await submitTx.executeWithSigner(signer);
    console.log("Message submission transaction result:", submitTxResult);

    // check receipt
    const receipt = await submitTxResult.getReceiptWithSigner(signer);
    console.log("Receipt for message submission:", receipt);

    // check for success status
    if (receipt.status && receipt.status.toString() === "SUCCESS") {
      console.log(`Message "${message}" submitted to topic ${topicId}.`);

      const hashscanLink = `https://hashscan.io/testnet/topic/${topicId}`;

      // Success msg
      updateMessageStatus(`
        Message submitted to topic ${topicId} successfully!
        <br/><br/>
        <a href="${hashscanLink}" target="_blank" class="hashscan-link">
          View on HashScan
        </a>
      `);
    } else {
      console.error("Message submission failed, status:", receipt.status);
      updateMessageStatus(`Message submission failed: ${receipt.status}`);
    }
  } catch (err) {
    console.error("Message submit error:", err);
    updateMessageStatus(`Message submit error: ${err.message}`);
  }
}

// ---------------------- EVENT LISTENERS & PAGE INIT ----------------------
document.addEventListener("DOMContentLoaded", async () => {
  await initializeWalletConnect();

  // Buttons
  const disconnectButton = document.getElementById("disconnectButton");
  const createTopicButton = document.getElementById("createTopicButton");
  const submitMessageButton = document.getElementById("submitMessageButton");

  // on page load, show "No account" unless there's an active session
  syncWalletconnectState();

  if (disconnectButton) {
    disconnectButton.addEventListener("click", () => {
      if (isConnected) {
        disconnectWallet();
      } else {
        openWalletConnectModal();
      }
    });
  }

  if (createTopicButton) {
    createTopicButton.addEventListener("click", handleTopicCreation);
  }

  if (submitMessageButton) {
    submitMessageButton.addEventListener("click", handleTopicMessageSubmission);
  }
});
