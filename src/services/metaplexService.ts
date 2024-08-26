import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  Metaplex,
  keypairIdentity,
  irysStorage,
} from "@metaplex-foundation/js";
import { ProductInfo } from "../schemas/creator";

//TODO: Upgrade to create nft collections and nfts using Metaplex Core. Both should include including the attribute plugin and attributes in plugin should match those in JSON perfectly.
const connection = new Connection(process.env.SOLANA_RPC_URL!);
const keypair = Keypair.fromSecretKey(
  Buffer.from(JSON.parse(process.env.WALLET_PRIVATE_KEY!))
);
const metaplex = Metaplex.make(connection)
  .use(keypairIdentity(keypair))
  .use(irysStorage());

export async function createMetaplexNFT(productInfo: ProductInfo) {
  try {
    const { uri } = await metaplex.nfts().uploadMetadata({
      name: productInfo.name,
      description: productInfo.description,
      image: productInfo.imageUri,
    });

    const { nft } = await metaplex.nfts().create({
      uri,
      name: productInfo.name,
      sellerFeeBasisPoints: 0,
    });

    return nft;
  } catch (error) {
    console.error("Error creating Metaplex NFT:", error);
    throw error;
  }
}
