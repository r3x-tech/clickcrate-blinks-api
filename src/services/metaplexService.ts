import { PublicKey } from "@solana/web3.js";
import { signerIdentity, createNoopSigner } from '@metaplex-foundation/umi'
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { create, createCollection, fetchCollection, mplCore } from "@metaplex-foundation/mpl-core";
import { irysUploader } from '@metaplex-foundation/umi-uploader-irys'
import { fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import { setComputeUnitPrice } from "@metaplex-foundation/mpl-toolbox";
import { validateImageUri } from "../utils/serviceHelpers";

/**
 * 
 * @param collectionName: string 
 * @param imageUri: string
 * @param collectionSymbol: string
 * @param publicKey: PublicKey 
 * @param network: any (for now) 
 * @param plugins: array of type any (for now) 
 */

export const createMetaplexCollection = async (
  collectionName: string, 
  imageUri: string, 
  collectionSymbol: string, 
  publicKey: PublicKey, 
  network: any, 
  plugins: any[]
) => {
  try {
    validateImageUri(imageUri);
    const umiStandardPublicKey = fromWeb3JsPublicKey(publicKey);
    const umi = createUmi(network).use(mplCore()).use(irysUploader());
    const collectionSigner = createNoopSigner(umiStandardPublicKey);
    umi.use(signerIdentity(collectionSigner)); // if this does not work, can use signerPayer
    const uri = await umi.uploader.uploadJson({
      symbol: collectionSymbol,
      description: 'This is my test NFT collection',
      image: imageUri,
    });
    const tx = await createCollection(umi, {
      collection: collectionSigner,
      name: collectionName,
      uri,
      updateAuthority: umiStandardPublicKey,
      plugins
    }).append(setComputeUnitPrice(umi, { microLamports: 1000 }));
    return tx;
  } catch (error) {
    console.error("Error creating metaplex collection", error);
    throw error;
  }
}

/**
 * 
 * @param nftName: string
 * @param nftImageUri: string 
 * @param publicKey: publicKey 
 * @param network: any (for now) 
 * @param plugins: array of type any (for now) 
 * @param attributes: array of type any (for now) 
 */

export const createMetaplexNFTt = async (
  nftName: string,
  nftImageUri: string,
  collectionAddress: any,
  publicKey: PublicKey, 
  network: any, 
  plugins: any[],
  attributes: any[] = []
) => {
  try {
    const umiStandardPublicKey = fromWeb3JsPublicKey(publicKey);
    const umi = createUmi(network).use(mplCore()).use(irysUploader());
    const collection = await fetchCollection(umi, collectionAddress.publicKey);
    const assetSigner = createNoopSigner(umiStandardPublicKey);
    const uri = await umi.uploader.uploadJson({
      description: 'This is my test NFT',
      image: nftImageUri,
      attributes
    });
    const tx = await create(umi, {
      asset: assetSigner,
      collection,
      name: nftName,
      uri,
      plugins
    }).prepend(setComputeUnitPrice(umi, { microLamports: 1000 }));
    return tx;
  } catch(error) {
    console.error("Error creating metaplex nft", error);
    throw error;
  }
}
