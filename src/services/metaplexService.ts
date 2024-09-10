import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
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
import {
  Metaplex,
  keypairIdentity,
  irysStorage,
} from "@metaplex-foundation/js";
import { ProductInfo } from "../models/schemas";

//TODO: Upgrade to create nft collections and nfts using Metaplex Core. Both should include including the attribute plugin and attributes in plugin should match those in JSON perfectly.
const connection = new Connection(process.env.SOLANA_RPC_URL!);
const keypair = Keypair.fromSecretKey(
  Buffer.from(JSON.parse(process.env.WALLET_PRIVATE_KEY!))
);
const metaplex = Metaplex.make(connection)
  .use(keypairIdentity(keypair))
  .use(irysStorage());

import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import { setComputeUnitPrice } from "@metaplex-foundation/mpl-toolbox";
import { convertMetaplexInstructionToTransactionInstruction } from "../utils/conversions";
import { validateImageUri } from "../utils/serviceHelpers";
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

const createUmiUploader = () => {
  const rpcUrl =
    process.env.NODE_ENV === "development"
      ? process.env.SOLANA_DEVNET_RPC_URL
      : process.env.SOLANA_MAINNET_RPC_URL;
  const solanaConnection = new Connection(rpcUrl!, "confirmed");
  return createUmi(solanaConnection).use(mplCore()).use(irysUploader());
};

const uploadJsonUmi = async (data: any) => {
  const umi = createUmiUploader();
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
  feePayer: PublicKey
) => {
  try {
    validateImageUri(imageUri);
    const umi = createUmiUploader();
    const umiCreatorPublicKey = fromWeb3JsPublicKey(creator);
    const collectionSigner = createNoopSigner(umiCreatorPublicKey);
    umi.use(signerIdentity(collectionSigner));

    const uri = await uploadJsonUmi({
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
            type: "image/svg",
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
    });

    const txBuilder = createCollection(umi, {
      collection: collectionSigner,
      name,
      uri,
      updateAuthority: umiCreatorPublicKey,
      plugins: [
        ...plugins,
        {
          type: "Attributes",
          attributeList: attributesList,
        },
      ],
    }).prepend(setComputeUnitPrice(umi, { microLamports: 1000 }));

    if (!txBuilder || txBuilder.getBlockhash() == undefined) {
      throw Error("Failed to retrieve builder");
    }
    const ixs = txBuilder.getInstructions();
    const msg = new TransactionMessage({
      payerKey: feePayer,
      recentBlockhash: txBuilder.getBlockhash() as string,
      instructions: [
        ...ixs.map(convertMetaplexInstructionToTransactionInstruction),
      ],
    }).compileToV0Message();

    return new VersionedTransaction(msg);
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
  feePayer: PublicKey
) => {
  try {
    const umi = createUmiUploader();
    const umiCreatorPublicKey = fromWeb3JsPublicKey(creator);
    const umiCollectionAddress = fromWeb3JsPublicKey(collectionAddress);
    const assetSigner = createNoopSigner(umiCreatorPublicKey);
    const collection = await fetchCollection(umi, umiCollectionAddress);
    umi.use(signerIdentity(assetSigner));

    const uri = await uploadJsonUmi({
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
            type: "image/svg",
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
    });

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
    }).prepend(setComputeUnitPrice(umi, { microLamports: 1000 }));

    if (!txBuilder || txBuilder.getBlockhash() == undefined) {
      throw Error("Failed to retrieve builder");
    }
    const ixs = txBuilder.getInstructions();
    const msg = new TransactionMessage({
      payerKey: feePayer,
      recentBlockhash: txBuilder.getBlockhash() as string,
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
  creator: PublicKey
) => {
  try {
    const umi = createUmiUploader();
    const umiCreatorPublicKey = fromWeb3JsPublicKey(creator);
    const assetSigner = createNoopSigner(umiCreatorPublicKey);

    umi.use(signerIdentity(assetSigner));
    const umiSigner = generateSigner(umi);
    const uri = await uploadJsonUmi({
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
            type: "image/svg",
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
    });
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

export const fetchSingleAsset = async (assetAddress: PublicKey) => {
  try {
    const umi = createUmiUploader();
    const umiAssetAddress = fromWeb3JsPublicKey(assetAddress);

    const asset = await fetchAsset(umi, umiAssetAddress);
    return asset;
  } catch (error) {
    console.error("Error fetching single asset", error);
    throw error;
  }
};

export const fetchAssetsByCollectionAddress = async (
  collectionAddress: PublicKey
) => {
  try {
    const umi = createUmiUploader();
    const umiCollectionAddress = fromWeb3JsPublicKey(collectionAddress);

    const assets = await fetchAssetsByCollection(umi, umiCollectionAddress);
    return assets;
  } catch (error) {
    console.error("Error fetching assets by collection", error);
    throw error;
  }
};
