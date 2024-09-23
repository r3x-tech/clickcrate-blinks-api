import {
  Instruction,
  Transaction as MetaplexTransaction,
} from "@metaplex-foundation/umi";
import {
  PublicKey,
  TransactionInstruction,
  Transaction as SolanaTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { Attribute } from "../models/schemas";

export const getOriginFromString = (origin: string): any => {
  switch (origin) {
    case "Clickcrate":
      return { clickcrate: {} };
    case "Shopify":
      return { shopify: {} };
    case "Square":
      return { square: {} };
    default:
      throw new Error(`Invalid origin: ${origin}`);
  }
};

export const getPlacementTypeFromString = (placementType: string): any => {
  switch (placementType) {
    case "Digitalreplica":
      return { digitalreplica: {} };
    case "Relatedpurchase":
      return { relatedpurchase: {} };
    case "Targetedplacement":
      return { targetedplacement: {} };
    default:
      throw new Error(`Invalid placement type: ${placementType}`);
  }
};

export const getProductCategoryFromString = (productCategory: string): any => {
  switch (productCategory) {
    case "Clothing":
      return { clothing: {} };
    case "Electronics":
      return { electronics: {} };
    case "Books":
      return { books: {} };
    case "Home":
      return { home: {} };
    case "Beauty":
      return { beauty: {} };
    case "Toys":
      return { toys: {} };
    case "Sports":
      return { sports: {} };
    case "Automotive":
      return { automotive: {} };
    case "Grocery":
      return { grocery: {} };
    case "Health":
      return { health: {} };
    default:
      throw new Error(`Invalid product category: ${productCategory}`);
  }
};

export function convertMetaplexInstructionToTransactionInstruction(
  metaplexInstruction: Instruction
): TransactionInstruction {
  return new TransactionInstruction({
    keys: metaplexInstruction.keys.map((key) => ({
      pubkey: new PublicKey(key.pubkey), // Assuming Metaplex PublicKey can be converted to Solana PublicKey
      isSigner: key.isSigner,
      isWritable: key.isWritable,
    })),
    programId: new PublicKey(metaplexInstruction.programId),
    data: Buffer.from(metaplexInstruction.data),
  });
}

export function solToLamports(sol: number): number {
  return Math.round(sol * LAMPORTS_PER_SOL);
}

export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

export function formatSolPrice(lamports: number): string {
  return lamportsToSol(lamports).toFixed(9) + " SOL";
}

export function isAttribute(obj: any): obj is Attribute {
  return (
    obj && typeof obj.trait_type === "string" && typeof obj.value === "string"
  );
}

export function parseSizes(
  sizeString: string
): { label: string; value: string }[] {
  // Remove any text in parentheses and trim whitespace
  const cleanedSizeString = sizeString.replace(/\([^)]*\)/g, "").trim();

  // Split the string by commas and trim each size
  const sizes = cleanedSizeString.split(",").map((size) => size.trim());

  // Create an array of objects with label and value properties
  return sizes.map((size) => ({ label: size, value: size }));
}
