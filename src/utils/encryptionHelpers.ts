import nacl from 'tweetnacl';
import * as naclUtil from 'tweetnacl-util';
import { z } from 'zod';
import { ShippingDetailsSchema } from "../models/schemas";
import { PublicKey } from '@solana/web3.js';

export const validateShippingName = ( name: string): boolean => {
    const nameRegex = /^[a-zA-Z\s]+$/;
    return nameRegex.test(name.trim());
}

export const validateShippingEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
}

export const validateShippingPhone = (phone: string): boolean => {
    const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/;
    return phoneRegex.test(phone.trim());
}

export const validateShippingAddress = (address: string): boolean => {
    return address.trim().length > 0;
}

export const validateShippingCity = (city: string): boolean => {
    const cityRegex = /^[a-zA-Z\s]+$/;
    return cityRegex.test(city.trim());
}

export const  validateShippingCountryRegion = (country: string): boolean => {
    return country.trim().length > 0;
}

export const validateShippingStateProvince = (state: string): boolean => {
    return state.trim().length > 0;
}

export const validateShippingZipCode = (zipCode: string): boolean => {
    const zipCodeRegex = /^[a-zA-Z0-9\s-]+$/;
    return zipCodeRegex.test(zipCode.trim()) && zipCode.trim().length > 0;
}

// Zod schema for shipping details
// const ShippingDetailsSchema = z.object({
//   shippingName: z.string(),
//   shippingEmail: z.string().email(),
//   shippingPhone: z.string().nullable().optional(),
//   shippingAddress: z.string(),
//   shippingCity: z.string(),
//   shippingStateProvince: z.string(),
//   shippingCountryRegion: z.string(),
//   shippingZipCode: z.string(),
// });

// Server-side encryption function
export const encryptShippingInfo = (publicKey: PublicKey, shippingInfo: any) => {
  // Validate shipping info against the schema
  const validatedInfo = ShippingDetailsSchema.parse(shippingInfo);

  // Generate a random symmetric key for encryption
  const symmetricKey = nacl.randomBytes(nacl.secretbox.keyLength);

  // Encrypt the shipping info with the symmetric key
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const messageUint8 = naclUtil.decodeUTF8(JSON.stringify(validatedInfo));
  const encrypted = nacl.secretbox(messageUint8, nonce, symmetricKey);

  // Encrypt the symmetric key with the user's public key
  const ephemeralKeyPair = nacl.box.keyPair();
  const encryptedSymmetricKey = nacl.box(
    symmetricKey,
    nacl.randomBytes(nacl.box.nonceLength),
    publicKey.toBuffer(),
    ephemeralKeyPair.secretKey
  );

  // Combine all components
  const fullMessage = new Uint8Array(nonce.length + encrypted.length + encryptedSymmetricKey.length + ephemeralKeyPair.publicKey.length);
  fullMessage.set(nonce);
  fullMessage.set(encrypted, nonce.length);
  fullMessage.set(encryptedSymmetricKey, nonce.length + encrypted.length);
  fullMessage.set(ephemeralKeyPair.publicKey, nonce.length + encrypted.length + encryptedSymmetricKey.length);

  return naclUtil.encodeBase64(fullMessage);
}

// Example usage
// const userPublicKey = nacl.sign.keyPair().publicKey; // In real scenario, this would be the user's actual public key

// const shippingInfo = {
//   shippingName: "John Doe",
//   shippingEmail: "john@example.com",
//   shippingPhone: "1234567890",
//   shippingAddress: "123 Main St",
//   shippingCity: "Anytown",
//   shippingStateProvince: "State",
//   shippingCountryRegion: "Country",
//   shippingZipCode: "12345"
// };

// const encryptedShippingInfo = encryptShippingInfo(userPublicKey, shippingInfo);

// console.log("Encrypted Shipping Info for NFT attribute:");
// console.log(JSON.stringify([{trait_type: "shippingInfo", value: encryptedShippingInfo}]));


function decryptShippingInfo(secretKey: any, encryptedData: any, signature: any) {
    const fullMessage = naclUtil.decodeBase64(encryptedData);
    
    const nonce = fullMessage.slice(0, nacl.secretbox.nonceLength);
    const encrypted = fullMessage.slice(
      nacl.secretbox.nonceLength,
      fullMessage.length - nacl.box.publicKeyLength - nacl.box.overheadLength
    );
    const encryptedSymmetricKey = fullMessage.slice(
      fullMessage.length - nacl.box.publicKeyLength - nacl.box.overheadLength,
      fullMessage.length - nacl.box.publicKeyLength
    );
    const ephemeralPublicKey = fullMessage.slice(fullMessage.length - nacl.box.publicKeyLength);
  
    // Decrypt the symmetric key
    const symmetricKey = nacl.box.open(
      encryptedSymmetricKey,
      nacl.randomBytes(nacl.box.nonceLength),
      ephemeralPublicKey,
      secretKey
    );
  
    if (!symmetricKey) {
      throw new Error('Failed to decrypt symmetric key');
    }
  
    // Decrypt the shipping info
    const decrypted = nacl.secretbox.open(encrypted, nonce, symmetricKey);
  
    if (!decrypted) {
      throw new Error('Failed to decrypt shipping info');
    }
  
    return JSON.parse(naclUtil.encodeUTF8(decrypted));
  }
  
  // Simulated wallet function to sign and decrypt
  function simulateWalletAutofill(secretKey: any, encryptedShippingInfo: any, messageToSign: any) {
    // Sign the message
    const signature = nacl.sign.detached(naclUtil.decodeUTF8(messageToSign), secretKey);
    
    // Decrypt the shipping info
    const shippingInfo = decryptShippingInfo(secretKey, encryptedShippingInfo, signature);
    
    return {
      signature: naclUtil.encodeBase64(signature),
      shippingInfo: shippingInfo
    };
  }
  
  // Server-side function to verify signature and process autofill
  function verifyAndProcessAutofill(publicKey: Uint8Array, challenge: any, signature: any, shippingInfo: any) {
    const isValid = nacl.sign.detached.verify(
      naclUtil.decodeUTF8(challenge),
      naclUtil.decodeBase64(signature),
      publicKey
    );
  
    if (!isValid) {
      throw new Error('Invalid signature');
    }
  
    console.log('Signature verified. Processing shipping info:', shippingInfo);
    // Here you would typically use the shipping info to autofill the form or complete the transaction
  }
  
//   // Usage simulation
//   const userKeypair = nacl.sign.keyPair();
//   const encryptedShippingInfo = "..."; // This would be retrieved from the NFT attribute
  
//   // Server generates a challenge (e.g., a partial transaction or specific message format)
//   const challenge = "Please sign to autofill your shipping information for order #12345";
  
//   // User's wallet performs autofill
//   const { signature, shippingInfo } = simulateWalletAutofill(userKeypair.secretKey, encryptedShippingInfo, challenge);
  
//   // Server verifies and processes the autofill
//   try {
//     verifyAndProcessAutofill(userKeypair.publicKey, challenge, signature, shippingInfo);
//   } catch (error) {
//     console.error('Autofill verification failed:', error);
//   }