import {
  PublicKey,
  sendAndConfirmRawTransaction,
  sendAndConfirmTransaction,
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
  mplCore,
} from "@metaplex-foundation/mpl-core";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import { setComputeUnitPrice } from "@metaplex-foundation/mpl-toolbox";
import { convertMetaplexInstructionToTransactionInstruction } from "../utils/conversions";

/**
 *
 * @param collectionName: string
 * @param imageUri: string
 * @param collectionSymbol: string
 * @param creator: PublicKey
 * @param network: any (for now) xw
 * @param plugins: array of type any (for now)
 */

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
  creator: PublicKey
) => {
  try {
    const umi = createUmi(network).use(mplCore()).use(irysUploader());
    const umiStandardPublicKey = fromWeb3JsPublicKey(creator);
    const collectionSigner = createNoopSigner(umiStandardPublicKey);
    umi.use(signerIdentity(collectionSigner)); // if this does not work, can use signerPayer
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
            address: "Engvm8giPGZvLV115DkzhVGkWKR5j11ZTrggo5EUQBau",
            share: 100,
          },
        ],
      },
    });

    const txBuilder = createCollection(umi, {
      collection: collectionSigner,
      name,
      uri,
      updateAuthority: umiStandardPublicKey,
      plugins,
    }).prepend(setComputeUnitPrice(umi, { microLamports: 1000 }));
    if (!txBuilder || txBuilder.getBlockhash() == undefined) {
      throw Error("Failed to retrieve builder");
    }
    const ixs = txBuilder.getInstructions();
    const msg = new TransactionMessage({
      payerKey: creator,
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

/**
 *
 * @param nftName: string
 * @param nftImageUri: string
 * @param creator: publicKey
 * @param network: any (for now)
 * @param plugins: array of type any (for now)
 * @param attributes: array of type any (for now)
 */

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
  creator: PublicKey
) => {
  try {
    const umi = createUmi(network).use(mplCore()).use(irysUploader());
    const umiCreatorPublicKey = fromWeb3JsPublicKey(creator);
    const umiCollectionAddress = fromWeb3JsPublicKey(collectionAddress);
    const assetSigner = createNoopSigner(umiCreatorPublicKey);
    const collection = await fetchCollection(umi, umiCollectionAddress);
    umi.use(signerIdentity(assetSigner)); // if this does not work, can use signerPayer
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
            address: "Engvm8giPGZvLV115DkzhVGkWKR5j11ZTrggo5EUQBau",
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
      plugins,
    }).prepend(setComputeUnitPrice(umi, { microLamports: 1000 }));
    if (!txBuilder || txBuilder.getBlockhash() == undefined) {
      throw Error("Failed to retrieve builder");
    }
    const ixs = txBuilder.getInstructions();
    const msg = new TransactionMessage({
      payerKey: creator,
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
