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

const createUmiUploader = (network: "devnet" | "mainnet") => {
  const rpcUrl =
    network === "devnet"
      ? process.env.SOLANA_DEVNET_RPC_URL
      : process.env.SOLANA_MAINNET_RPC_URL;
  const solanaConnection = new Connection(rpcUrl!, "confirmed");
  return createUmi(solanaConnection).use(mplCore()).use(irysUploader());
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
    const collectionSigner = createNoopSigner(umiCreatorPublicKey);
    const payerSigner = createNoopSigner(umiFeePayerPublicKey);

    umi.use(signerIdentity(payerSigner));
    console.log("Signer set up");

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

    console.log("Creating collection");
    let txBuilder;
    try {
      txBuilder = createCollection(umi, {
        collection: collectionSigner,
        name,
        uri,
        updateAuthority: umiCreatorPublicKey,
        payer: payerSigner,
        plugins: [
          ...plugins,
          {
            type: "Attributes",
            attributeList: attributesList,
          },
        ],
        // })
        //   .prepend(setComputeUnitPrice(umi, { microLamports: 1000 }))
        //   .buildAndSign(umi);
      });
      console.log("Collection created");
    } catch (error) {
      console.error("Error creating collection:", error);
      throw error;
    }

    if (!txBuilder) {
      console.error("txBuilder is undefined");
      throw Error("Failed to retrieve builder");
    }
    console.log("txBuilder is:", txBuilder);

    const currentConnection = createConnection("devnet");
    const blockhash = await getRecentBlockhashWithRetry(currentConnection);
    if (blockhash == undefined) {
      console.error("Recent blockhash is undefined");
      throw Error("Failed to retrieve blockhash");
    }
    console.log("Blockhash retrieved:", blockhash);

    // if (txBuilder.getBlockhash() == undefined) {
    //   console.error("txBuilder blockhash is undefined");
    //   throw Error("Failed to retrieve blockhash");
    // }
    // console.log("Blockhash retrieved:", txBuilder.getBlockhash());

    const ixs = txBuilder.getInstructions();
    console.log("Instructions retrieved:", ixs.length);

    const msg = new TransactionMessage({
      payerKey: feePayer,
      recentBlockhash: blockhash.blockhash as string,
      instructions: [
        ...ixs.map(convertMetaplexInstructionToTransactionInstruction),
      ],
    }).compileToV0Message();
    console.log("Transaction message compiled");

    return new VersionedTransaction(msg);
    // return (await txBuilder).serializedMessage
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
    const umiCreatorPublicKey = fromWeb3JsPublicKey(creator);
    const umiFeePayerPublicKey = fromWeb3JsPublicKey(feePayer);
    const umiCollectionAddress = fromWeb3JsPublicKey(collectionAddress);
    const assetSigner = createNoopSigner(umiCreatorPublicKey);
    const payerSigner = createNoopSigner(umiFeePayerPublicKey);
    const collection = await fetchCollection(umi, umiCollectionAddress);
    umi.use(signerIdentity(payerSigner));

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

    const txBuilder = create(umi, {
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
      // }).prepend(setComputeUnitPrice(umi, { microLamports: 1000 })).buildAndSign(umi)
    });

    if (!txBuilder) {
      console.error("txBuilder is undefined");
      throw Error("Failed to retrieve builder");
    }
    console.log("txBuilder is:", txBuilder);

    const currentConnection = createConnection("devnet");
    const blockhash = await getRecentBlockhashWithRetry(currentConnection);
    if (blockhash == undefined) {
      console.error("Recent blockhash is undefined");
      throw Error("Failed to retrieve blockhash");
    }
    console.log("Blockhash retrieved:", blockhash);

    const ixs = txBuilder.getInstructions();
    console.log("ixs retrieved:", ixs);

    const msg = new TransactionMessage({
      payerKey: feePayer,
      recentBlockhash: blockhash.blockhash as string,
      instructions: [
        ...ixs.map(convertMetaplexInstructionToTransactionInstruction),
      ],
    }).compileToV0Message();

    return new VersionedTransaction(msg);
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
