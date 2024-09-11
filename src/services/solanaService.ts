// src/services/solanaService.ts
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  VersionedTransaction,
  TransactionMessage,
  ComputeBudgetProgram,
  Transaction,
} from "@solana/web3.js";
import { ProductInfo } from "../models/schemas";
import * as MetaplexService from "../services/metaplexService";
import bs58 from "bs58";

require("dotenv").config();

const createConnection = (network: "devnet" | "mainnet") => {
  const rpcUrl =
    network === "devnet"
      ? process.env.SOLANA_DEVNET_RPC_URL
      : process.env.SOLANA_MAINNET_RPC_URL;

  if (typeof rpcUrl !== "string" || rpcUrl == undefined || !rpcUrl) {
    throw new TypeError("rpcUrl expected string");
  }
  return new Connection(rpcUrl, "confirmed");
};

if (!process.env.PROXY_WALLET_SK || process.env.PROXY_WALLET_SK == undefined) {
  throw new TypeError("Proxy wallet secret key not found");
}
const relayWalletKeypair = Keypair.fromSecretKey(
  bs58.decode(process.env.PROXY_WALLET_SK)
);

async function getTransactionDetails(txSignature: string): Promise<any> {
  const myHeaders = new Headers();
  myHeaders.append("x-api-key", process.env.SHYFT_API_KEY!);

  const requestOptions = {
    method: "GET",
    headers: myHeaders,
  };

  const response = await fetch(
    `https://api.shyft.to/sol/v1/transaction/parsed?network=mainnet-beta&txn_signature=${txSignature}`,
    requestOptions
  );
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const result = await response.json();
  return result;
}

async function getRecentBlockhashWithRetry(
  connection: Connection,
  maxRetries = 3,
  delayMs = 1000
) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("finalized");
      return { blockhash, lastValidBlockHeight };
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  console.error("Failed to get recent blockhash after retries");
  return undefined;
}

const relayPaymentTransaction = async (
  amount: number,
  fromPubkey: PublicKey,
  network: "devnet" | "mainnet"
) => {
  const connection = createConnection(network);
  const toPubkey = relayWalletKeypair.publicKey;

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey,
      toPubkey,
      lamports: amount,
    })
  );

  const latestBlockhash = await connection.getLatestBlockhash();
  transaction.recentBlockhash = latestBlockhash.blockhash;
  transaction.feePayer = fromPubkey;

  return transaction;
};

const createTransaction = async (
  instruction: TransactionInstruction,
  feePayer: PublicKey,
  network: "devnet" | "mainnet",
  computeUnits?: number
) => {
  const connection = createConnection(network);
  const instructions: TransactionInstruction[] = [];

  const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 1000,
  });
  instructions.push(priorityFeeIx);

  if (computeUnits !== undefined) {
    if (computeUnits <= 200000) {
      console.error("Compute units must be greater than 200,000");
      return;
    }
    const modifyComputeUnitsIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: computeUnits,
    });
    instructions.push(modifyComputeUnitsIx);
  }
  instructions.push(instruction);

  const blockhash = await connection.getLatestBlockhash();
  const messageV0 = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash.blockhash,
    instructions,
  }).compileToV0Message();

  return new VersionedTransaction(messageV0);
};

async function signAndSendTransaction(
  versionedTransaction: VersionedTransaction,
  signers: Keypair[],
  network: "devnet" | "mainnet"
): Promise<string> {
  const connection = createConnection(network);
  try {
    if (signers.length !== 1 || !signers) {
      throw new Error(`Signers unavailable`);
    }
    versionedTransaction.sign(signers);
    console.log(
      `Encoded transaction is: `,
      Buffer.from(versionedTransaction.serialize()).toString("base64")
    );

    const serializedTransaction = versionedTransaction.serialize();
    const txId = await connection.sendRawTransaction(serializedTransaction, {
      skipPreflight: true,
    });
    console.log(`Transaction sent with ID: ${txId}`);

    const confirmation = await connection.confirmTransaction(txId, "confirmed");

    // const latestBlockHash = await connection.getLatestBlockhash();

    // const confirmation = await connection.confirmTransaction({
    //   blockhash: latestBlockHash.blockhash,
    //   lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    //   signature: txId,
    // });
    console.log(`Transaction confirmed: `, confirmation);

    return txId;
  } catch (error) {
    console.error("Error in signAndSendTransaction:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    throw new Error(`Failed to sign and send transaction: ${error}`);
  }
}

async function simulateAndGetCost(
  tx: VersionedTransaction,
  network: "devnet" | "mainnet"
): Promise<number> {
  const connection = createConnection(network);
  const simulation = await connection.simulateTransaction(tx);

  if (simulation.value.err) {
    console.error("Simulation error:", simulation.value.err);
    throw new Error(
      `Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`
    );
  }
  const unitsUsed = simulation.value.unitsConsumed || 0;

  // Convert compute units to lamports
  // Rate might require adjustment based on current Solana pricing
  const lamportsPerComputeUnit = 0.00000001;
  const estimatedCostInLamports = unitsUsed * lamportsPerComputeUnit;

  return Math.ceil(estimatedCostInLamports);
}

async function createProducts(
  productInfo: ProductInfo,
  publicKey: PublicKey,
  network: "devnet" | "mainnet"
) {
  const { name, imageUri, description, quantity, account } = productInfo;
  let totalCost = 0;

  // Create ClickCrate POS Collection NFT
  const posCollectionNftTx = await MetaplexService.createMetaplexCollectionNft(
    `${name} ClickCrate POS`,
    "CPOS",
    `${name} ClickCrate POS`,
    imageUri,
    ``,
    `https://www.clickcrate.xyz/`,
    `https://www.clickcrate.xyz/`,
    [
      { key: "Type", value: "ClickCrate" },
      { key: "Placement Type", value: "Related Purchase" },
      { key: "Additional Placement Requirements", value: "None" },
      { key: "Placement Fee (USDC)", value: "0" },
      { key: "User Profile Uri", value: "None" },
    ],
    [],
    publicKey,
    relayWalletKeypair.publicKey,
    network
  );

  console.log("POS created!!!!!!!");
  // totalCost += await simulateAndGetCost(posCollectionNftTx, network);
  // console.log("Cost calculated");
  const posTxSignature = await signAndSendTransaction(
    posCollectionNftTx,
    [relayWalletKeypair],
    network
  );

  // Create Product Listing Collection NFT
  const listingCollectionNftTx =
    await MetaplexService.createMetaplexCollectionNft(
      `${name}`,
      "PLCC",
      `${description}`,
      imageUri,
      ``,
      `https://www.clickcrate.xyz/`,
      `https://www.clickcrate.xyz/`,
      [
        { key: "Type", value: "Product Listing" },
        { key: "Product Category", value: "Clothing" },
        { key: "Brand", value: "ClickCrate" },
        { key: "Size(s)", value: "Unisex" },
        { key: "Placement Type", value: "Related Purchase" },
        { key: "Additional Placement Requirements", value: "None" },
        { key: "Discount", value: "None" },
        { key: "Customer Profile Uri", value: "None" },
      ],
      [],
      publicKey,
      relayWalletKeypair.publicKey,
      network
    );

  console.log("Listing created!!!!!!!");
  // totalCost += await simulateAndGetCost(listingCollectionNftTx, network);
  // console.log("Cost updated");
  const listingTxSignature = await signAndSendTransaction(
    listingCollectionNftTx,
    [relayWalletKeypair],
    network
  );

  // Get the listing collection NFT address
  const listingTxDetails = await getTransactionDetails(listingTxSignature);
  let listingCollectionNftAddress: string | undefined;

  for (const action of listingTxDetails.result.actions) {
    if (action.type === "NFT_MINT") {
      listingCollectionNftAddress = action.info.nft_address;
      break;
    }
  }

  if (!listingCollectionNftAddress) {
    throw new Error(
      "Failed to find NFT_MINT action in listing collection transaction"
    );
  }

  // Create Product NFTs
  const productNfts = [];
  for (let i = 0; i < quantity; i++) {
    const productNftTx = await MetaplexService.createMetaplexNftInCollection(
      `${name} #${i + 1}`,
      `PCC${i}`,
      `${description}`,
      imageUri,
      "",
      `https://www.clickcrate.xyz/`,
      `https://www.clickcrate.xyz/`,
      [
        { key: "Type", value: "Product" },
        { key: "Product Category", value: "Clothing" },
        { key: "Brand", value: "ClickCrate" },
        { key: "Size", value: "Unisex" },
      ],
      [],
      new PublicKey(listingCollectionNftAddress),
      publicKey,
      relayWalletKeypair.publicKey,
      network
    );

    // totalCost += await simulateAndGetCost(productNftTx, network);
    const productTxSignature = await signAndSendTransaction(
      productNftTx,
      [relayWalletKeypair],
      network
    );
    productNfts.push(productTxSignature);
  }

  totalCost = (2 + productNfts.length) * 0.01;
  console.log("Cost finalized: ", totalCost);

  return {
    totalCost,
    posTxSignature,
    listingTxSignature,
    productNfts,
    listingCollectionNftAddress,
  };
}

export {
  createConnection,
  simulateAndGetCost,
  getRecentBlockhashWithRetry,
  createTransaction,
  signAndSendTransaction,
  createProducts,
  relayPaymentTransaction,
};
