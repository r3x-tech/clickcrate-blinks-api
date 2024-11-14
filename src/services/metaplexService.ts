import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  signerIdentity,
  createNoopSigner,
  KeypairSigner,
  createSignerFromKeypair,
  generateSigner,
  Transaction,
  signTransaction,
  Signer,
  Umi,
  signerPayer,
  publicKey,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import { setComputeUnitPrice } from "@metaplex-foundation/mpl-toolbox";
import { convertMetaplexInstructionToTransactionInstruction } from "../utils/conversions";
import { getMimeType, validateImageUri } from "../utils/imageValidator";
import bs58 from "bs58";
import {
  Attribute,
  create,
  createCollection,
  fetchAsset,
  fetchAssetsByCollection,
  fetchCollection,
  mplCore,
} from "@metaplex-foundation/mpl-core";
import { createConnection, getRecentBlockhashWithRetry } from "./solanaService";
import {
  AssetResult,
  CollectionResult,
} from "@metaplex-foundation/mpl-core-das/dist/src/types";
import { dasApi } from "@metaplex-foundation/digital-asset-standard-api";
import { das } from "@metaplex-foundation/mpl-core-das";

const createUmiUploader = (network: "devnet" | "mainnet") => {
  const rpcUrl =
    network === "devnet"
      ? process.env.SOLANA_DEVNET_RPC_URL
      : process.env.SOLANA_MAINNET_RPC_URL;
  const solanaConnection = new Connection(rpcUrl!, "confirmed");
  return createUmi(solanaConnection).use(mplCore()).use(irysUploader());
};

const createUmiFetcher = (network: "devnet" | "mainnet", endpoint?: string) => {
  const rpcUrl =
    endpoint ||
    (network === "devnet"
      ? process.env.SOLANA_DEVNET_RPC_URL
      : process.env.SOLANA_MAINNET_RPC_URL);
  const solanaConnection = new Connection(rpcUrl!, "confirmed");
  return createUmi(solanaConnection).use(dasApi());
};

const uploadJsonUmi = async (data: any, network: "devnet" | "mainnet") => {
  const umi = createUmiUploader(network);
  const secretKeyUint8Array = bs58.decode(process.env.SERVER_WALLET_SK!);
  const userWallet = Keypair.fromSecretKey(
    Uint8Array.from(secretKeyUint8Array)
  );
  const serverWallet = umi.eddsa.createKeypairFromSecretKey(
    userWallet.secretKey
  );
  const serverSigner: KeypairSigner = createSignerFromKeypair(
    umi,
    serverWallet
  );
  umi.use(signerIdentity(serverSigner));
  return await umi.uploader.uploadJson(data);
};

// const uploadMetaData = async (metaData: any) => {
//   const solanaConnection = new Connection("https://api.devnet.solana.com", "confirmed")
//   const umi = createUmi(solanaConnection).use(mplCore()).use(irysUploader());
//   const secretKeyUint8Array = bs58.decode(process.env.SERVER_WALLET_SK!)
//   const userWallet = Keypair.fromSecretKey(Uint8Array.from(secretKeyUint8Array));
//   const myKeypair = umi.eddsa.createKeypairFromSecretKey(userWallet.secretKey);
//   const myKeypairSigner: KeypairSigner = createSignerFromKeypair(umi, myKeypair);
//   umi.use(signerIdentity(myKeypairSigner));
//   const uri = await umi.uploader.uploadJson(metaData);
//   return uri;
// }

export const createMetaplexCollectionNft = async (
  name: string,
  symbol: string,
  description: string,
  imageUri: string,
  animation_url: string,
  external_url: string,
  creator_url: string,
  attributesList: Attribute[],
  plugins: any[],
  creator: PublicKey,
  feePayer: PublicKey,
  network: "devnet" | "mainnet"
) => {
  try {
    console.log("Starting createMetaplexCollectionNft");
    const extension = validateImageUri(imageUri);
    const mimeType = getMimeType(extension);
    console.log(
      `Image validated. Extension: ${extension}, MIME type: ${mimeType}`
    );
    const umi = createUmiUploader(network);
    console.log("Umi created");
    const umiCreatorPublicKey = fromWeb3JsPublicKey(creator);
    const umiFeePayerPublicKey = fromWeb3JsPublicKey(feePayer);
    const creatorSigner = createNoopSigner(umiCreatorPublicKey);
    const payerSigner = createNoopSigner(umiFeePayerPublicKey);
    umi.use(signerIdentity(payerSigner));
    console.log("Signer set up");

    const collectionSigner = generateSigner(umi);
    console.log("collectionSigner is:", collectionSigner.publicKey);

    const uri = await uploadJsonUmi(
      {
        symbol: symbol,
        description: description,
        image: imageUri,
        animation_url: animation_url,
        external_url: external_url,
        creator_url: creator_url,
        attributes: attributesList,
        properties: {
          files: [
            {
              uri: `${imageUri}`,
              type: mimeType,
            },
          ],
          category: "image",
          creators: [
            {
              address: creator.toBase58(),
              share: 100,
            },
          ],
        },
      },
      network
    );
    console.log("JSON uploaded, URI:", uri);
    const txBuilder = await createCollection(umi, {
      collection: collectionSigner,
      name,
      uri,
      plugins: [
        ...plugins,
        {
          type: "Attributes",
          attributeList: attributesList,
        },
      ],
    })
      .prepend(setComputeUnitPrice(umi, { microLamports: 1000 }))
      .buildAndSign(umi);
    if (!txBuilder) {
      console.error("txBuilder is undefined");
      throw Error("Failed to retrieve builder");
    }
    return {
      tx: txBuilder,
      collectionAddress: collectionSigner.publicKey,
    };
  } catch (error) {
    console.error("Error creating metaplex collection", error);
    throw error;
  }
};

export const createMetaplexNftInCollection = async (
  name: string,
  symbol: string,
  description: string,
  imageUri: string,
  animation_url: string,
  external_url: string,
  creator_url: string,
  attributesList: Attribute[],
  plugins: any[],
  collectionAddress: PublicKey,
  creator: PublicKey,
  feePayer: PublicKey,
  network: "devnet" | "mainnet"
) => {
  try {
    const extension = validateImageUri(imageUri);
    const mimeType = getMimeType(extension);
    console.log(
      `Image validated. Extension: ${extension}, MIME type: ${mimeType}`
    );

    const umi = createUmiUploader(network);
    const umiCollectionAddress = fromWeb3JsPublicKey(collectionAddress);
    const collection = await fetchCollection(umi, umiCollectionAddress);
    const umiCreatorPublicKey = fromWeb3JsPublicKey(creator);
    const umiFeePayerPublicKey = fromWeb3JsPublicKey(feePayer);
    const creatorSigner = createNoopSigner(umiCreatorPublicKey);
    const payerSigner = createNoopSigner(umiFeePayerPublicKey);
    umi.use(signerIdentity(payerSigner));
    // umi.use(signerPayer(payerSigner));
    console.log("Signer set up");

    const assetSigner = generateSigner(umi);
    console.log("assetSigner is:", assetSigner.publicKey);

    const uri = await uploadJsonUmi(
      {
        name: name,
        symbol: symbol,
        description: description,
        image: imageUri,
        animation_url: animation_url,
        external_url: external_url,
        creator_url: creator_url,
        attributes: attributesList,
        properties: {
          files: [
            {
              uri: `${imageUri}`,
              type: mimeType,
            },
          ],
          category: "image",
          creators: [
            {
              address: creator.toBase58(),
              share: 100,
            },
          ],
        },
      },
      network
    );

    const txBuilder = await create(umi, {
      asset: assetSigner,
      collection,
      name: name,
      uri,
      plugins: [
        ...plugins,
        {
          type: "Attributes",
          attributeList: attributesList,
        },
      ],
    })
      .prepend(setComputeUnitPrice(umi, { microLamports: 1000 }))
      .buildAndSign(umi);

    if (!txBuilder) {
      console.error("txBuilder is undefined");
      throw Error("Failed to retrieve builder");
    }
    console.log("txBuilder is:", txBuilder);
    return {
      tx: txBuilder,
      assetAddress: assetSigner.publicKey,
    };
  } catch (error) {
    console.error("Error creating metaplex nft", error);
    throw error;
  }
};

export const createMetaplexNft = async (
  name: string,
  symbol: string,
  description: string,
  imageUri: string,
  animation_url: string,
  external_url: string,
  creator_url: string,
  attributesList: any[],
  plugins: any[],
  creator: PublicKey,
  network: "devnet" | "mainnet"
) => {
  try {
    const extension = validateImageUri(imageUri);
    const mimeType = getMimeType(extension);
    console.log(
      `Image validated. Extension: ${extension}, MIME type: ${mimeType}`
    );

    const umi = createUmiUploader(network);
    const umiCreatorPublicKey = fromWeb3JsPublicKey(creator);
    const assetSigner = createNoopSigner(umiCreatorPublicKey);

    umi.use(signerIdentity(assetSigner));
    const umiSigner = generateSigner(umi);
    console.log("umiSigner is:", umiSigner.publicKey);

    const uri = await uploadJsonUmi(
      {
        name: name,
        symbol: symbol,
        description: description,
        image: imageUri,
        animation_url: animation_url,
        external_url: external_url,
        creator_url: creator_url,
        attributes: attributesList,
        properties: {
          files: [
            {
              uri: `${imageUri}`,
              type: mimeType,
            },
          ],
          category: "image",
          creators: [
            {
              address: creator.toBase58(),
              share: 100,
            },
          ],
        },
      },
      network
    );
    const txBuilder = await create(umi, {
      asset: umiSigner,
      name: name,
      uri,
      plugins: [
        ...plugins,
        {
          type: "Attributes",
          attributeList: attributesList,
        },
      ],
    }).buildAndSign(umi);
    if (!txBuilder) {
      console.error("txBuilder is undefined");
      throw Error("Failed to retrieve builder");
    }
    return umi.transactions.serialize(txBuilder);
  } catch (error) {
    console.error("Error creating metaplex nft", error);
    throw error;
  }
};

export const fetchSingleAsset = async (
  assetAddress: PublicKey,
  network: "devnet" | "mainnet"
) => {
  try {
    const umi = createUmiUploader(network);
    const umiAssetAddress = fromWeb3JsPublicKey(assetAddress);

    const asset = await fetchAsset(umi, umiAssetAddress);
    return asset;
  } catch (error) {
    console.error("Error fetching single asset", error);
    throw error;
  }
};

export const fetchAssetsByCollectionAddress = async (
  collectionAddress: PublicKey,
  network: "devnet" | "mainnet"
) => {
  try {
    const umi = createUmiUploader(network);
    const umiCollectionAddress = fromWeb3JsPublicKey(collectionAddress);

    const assets = await fetchAssetsByCollection(umi, umiCollectionAddress);
    return assets;
  } catch (error) {
    console.error("Error fetching assets by collection", error);
    throw error;
  }
};

export const fetchDasCoreAsset = async (
  assetId: string,
  network: "devnet" | "mainnet"
): Promise<AssetResult> => {
  const umi = createUmiFetcher(network);
  try {
    const asset = await das.getAsset(umi, publicKey(assetId));
    return asset;
  } catch (error) {
    console.error("Error fetching das core asset:", error);
    throw error;
  }
};

export const fetchDasCoreCollection = async (
  collectionAddress: string,
  network: "devnet" | "mainnet"
): Promise<CollectionResult> => {
  const MAX_RETRIES = 3;
  const INITIAL_DELAY = 1000;

  // Multiple RPC endpoints
  const rpcEndpoints = {
    devnet: [
      `${process.env.SOLANA_DEVNET_RPC_URL}`,
      "https://api.devnet.solana.com",
    ],
    mainnet: [
      `${process.env.SOLANA_MAINNET_RPC_URL}`,
      "https://api.mainnet-beta.solana.com",
    ],
  };

  for (const endpoint of rpcEndpoints[network]) {
    let attempt = 0;
    while (attempt < MAX_RETRIES) {
      try {
        const umi = createUmiFetcher(network, endpoint);
        const collection = publicKey(collectionAddress);
        return await das.getCollection(umi, collection);
      } catch (error) {
        attempt++;
        console.error(
          `Attempt ${attempt} with endpoint ${endpoint} failed:`,
          error
        );

        if (attempt === MAX_RETRIES) break; // Try next endpoint

        await new Promise((r) =>
          setTimeout(r, INITIAL_DELAY * Math.pow(2, attempt))
        );
      }
    }
  }

  throw new Error("All RPC endpoints failed to fetch DAS collection");
};

export async function signAndSendMetaplexTransaction(
  umi: Umi,
  legacyTx: Transaction,
  signers: Signer[],
  network: "devnet" | "mainnet"
): Promise<string> {
  try {
    if (signers.length !== 1 || !signers) {
      throw new Error(`Signers unavailable`);
    }

    const mySignedTransaction = await signTransaction(legacyTx, signers);
    const serializedTransaction =
      umi.transactions.serialize(mySignedTransaction);
    console.log(
      `Encoded transaction is: `,
      Buffer.from(serializedTransaction).toString("base64")
    );
    const txId = await umi.rpc.sendTransaction(mySignedTransaction, {
      skipPreflight: true,
    });
    console.log(
      `Transaction sent with ID: ${Buffer.from(txId).toString("base64")}`
    );

    const rtB = await umi.rpc.getLatestBlockhash();
    const confirmResult = await umi.rpc.confirmTransaction(txId, {
      strategy: { type: "blockhash", ...rtB },
    });
    console.log(`Confirmed tx: `, confirmResult);

    return Buffer.from(txId).toString("base64");
  } catch (error) {
    console.error("Error in signAndSendTransaction:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    throw new Error(`Failed to sign and send transaction: ${error}`);
  }
}
