import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { signerIdentity, createNoopSigner } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  Attribute,
  create,
  createCollection,
  fetchCollection,
  fetchAsset,
  fetchAssetsByCollection,
  mplCore,
} from "@metaplex-foundation/mpl-core";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import { setComputeUnitPrice } from "@metaplex-foundation/mpl-toolbox";
import { convertMetaplexInstructionToTransactionInstruction } from "../utils/conversions";
import { validateImageUri } from "../utils/serviceHelpers";

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
  network: "mainnet" | "devnet",
  creator: PublicKey,
  feePayer: PublicKey
) => {
  try {
    validateImageUri(imageUri);
    const umi = createUmi(network).use(mplCore()).use(irysUploader());
    const umiCreatorPublicKey = fromWeb3JsPublicKey(creator);
    const collectionSigner = createNoopSigner(umiCreatorPublicKey);
    umi.use(signerIdentity(collectionSigner));

    const uri = await umi.uploader.uploadJson({
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

export const createMetaplexNft = async (
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
  network: "mainnet" | "devnet",
  creator: PublicKey,
  feePayer: PublicKey
) => {
  try {
    const umi = createUmi(network).use(mplCore()).use(irysUploader());
    const umiCreatorPublicKey = fromWeb3JsPublicKey(creator);
    const umiCollectionAddress = fromWeb3JsPublicKey(collectionAddress);
    const assetSigner = createNoopSigner(umiCreatorPublicKey);
    const collection = await fetchCollection(umi, umiCollectionAddress);
    umi.use(signerIdentity(assetSigner));

    const uri = await umi.uploader.uploadJson({
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

export const fetchSingleAsset = async (
  assetAddress: PublicKey,
  network: "mainnet" | "devnet"
) => {
  try {
    const umi = createUmi(network).use(mplCore());
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
  network: "mainnet" | "devnet"
) => {
  try {
    const umi = createUmi(network).use(mplCore());
    const umiCollectionAddress = fromWeb3JsPublicKey(collectionAddress);

    const assets = await fetchAssetsByCollection(umi, umiCollectionAddress);
    return assets;
  } catch (error) {
    console.error("Error fetching assets by collection", error);
    throw error;
  }
};
