import AsyncStorage from '@react-native-async-storage/async-storage';
import { AsymmetricDerivationMode, SymmetricDerivationMode, UnexpectedStateError, } from 'farcaster-cryptography';
import { NativeModules, Platform } from 'react-native';
const LINKING_ERROR = `The package 'farcaster-cryptography-react-native' doesn't seem to be linked. Make sure: \n\n` +
    Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
    '- You rebuilt the app after installing the package\n' +
    '- You are not using Expo managed workflow\n';
class FarcasterSymmetricKey {
    id;
    constructor(id) {
        this.id = id;
    }
    async encrypt(options) {
        return JSON.parse(await FarcasterCryptographyNativeKeyStore.encrypt(this.id, options.base64Plaintext, options.aeadPrefix
            ? options.aeadPrefix.id
            : undefined, options.base64AssociatedData));
    }
    async decrypt(options) {
        return await FarcasterCryptographyNativeKeyStore.decrypt(this.id, options.ciphertext.base64IV, options.ciphertext.base64Ciphertext, options.ciphertext.base64AssociatedData);
    }
    async compareKey(other) {
        return await FarcasterCryptographyNativeKeyStore.compareKey(this.id, other.id);
    }
    async generateConfirmationValue() {
        return await FarcasterCryptographyNativeKeyStore.generateConfirmationValue(this.id);
    }
    async compareConfirmationValue(confirmationValue) {
        return (confirmationValue ===
            (await FarcasterCryptographyNativeKeyStore.generateConfirmationValue(this.id)));
    }
    async wrapSymmetricKey(other) {
        return await FarcasterCryptographyNativeKeyStore.wrapSymmetricKey(this.id, other.id);
    }
    async wrapEphemeralKey(other) {
        return await FarcasterCryptographyNativeKeyStore.wrapEphemeralKey(this.id, other.base64PublicKey);
    }
    async wrapSignedPreKey(other) {
        return await FarcasterCryptographyNativeKeyStore.wrapSignedPreKey(this.id, other.base64PublicKey);
    }
    async wrapIdentityKey(other) {
        return await FarcasterCryptographyNativeKeyStore.wrapIdentityKey(this.id, other.base64PublicKey);
    }
    async unwrapSymmetricKey(other) {
        return new FarcasterSymmetricKey(JSON.parse(await FarcasterCryptographyNativeKeyStore.unwrapSymmetricKey(this.id, other)).id);
    }
    async unwrapEphemeralKey(other) {
        return new FarcasterEphemeralPrivateKey(JSON.parse(await FarcasterCryptographyNativeKeyStore.unwrapEphemeralKey(this.id, other)));
    }
    async unwrapSignedPreKey(other) {
        return new FarcasterPrePrivateKey(JSON.parse(await FarcasterCryptographyNativeKeyStore.unwrapSignedPreKey(this.id, other)));
    }
    async unwrapIdentityKey(other) {
        return new FarcasterIdentitySigningPrivateKey(JSON.parse(await FarcasterCryptographyNativeKeyStore.unwrapIdentityKey(this.id, other)));
    }
}
class FarcasterEphemeralPrivateKey {
    constructor(baseKey) {
        this.base64PublicKey = baseKey.base64PublicKey;
    }
    async deriveKey(options) {
        return new FarcasterSymmetricKey(JSON.parse(await FarcasterCryptographyNativeKeyStore.agreeWithEphemeralKey(this.base64PublicKey, options.counterpartyPublicKey.base64PublicKey)).id);
    }
    async signMessage(messageHash) {
        return JSON.parse(await FarcasterCryptographyNativeKeyStore.signWithEphemeralKey(this.base64PublicKey, messageHash));
    }
    base64PublicKey;
}
class FarcasterPrePrivateKey {
    constructor(baseKey) {
        this.base64PublicKey = baseKey.base64PublicKey;
    }
    async deriveKey(options) {
        return new FarcasterSymmetricKey(JSON.parse(await FarcasterCryptographyNativeKeyStore.agreeWithSignedPreKey(this.base64PublicKey, options.counterpartyPublicKey.base64PublicKey)).id);
    }
    async signMessage(messageHash) {
        return JSON.parse(await FarcasterCryptographyNativeKeyStore.signWithSignedPreKey(this.base64PublicKey, messageHash));
    }
    base64PublicKey;
}
class FarcasterVerifyingPublicKey {
    constructor(baseKey) {
        this.base64PublicKey = baseKey.base64PublicKey;
    }
    base64PublicKey;
    async verifySignature(message, signature) {
        return await FarcasterCryptographyNativeKeyStore.verifySignature(this.base64PublicKey, message, signature);
    }
}
class FarcasterSignedPublicKey {
    constructor(baseKey) {
        this.base64PublicKey = baseKey.base64PublicKey;
        this.base64Signature = baseKey.base64Signature;
    }
    base64Signature;
    async verify(_) {
        throw new Error('!');
    }
    async deriveKey(options) {
        return new FarcasterSymmetricKey(JSON.parse(await FarcasterCryptographyNativeKeyStore.agreeWithSignedPreKey(this.base64PublicKey, options.counterpartyPublicKey.base64PublicKey)).id);
    }
    base64PublicKey;
}
class FarcasterIdentitySigningPrivateKey {
    constructor(baseKey) {
        this.base64PublicKey = baseKey.base64PublicKey;
    }
    async signMessage(messageHash) {
        return JSON.parse(await FarcasterCryptographyNativeKeyStore.signWithIdentityKey(this.base64PublicKey, messageHash));
    }
    async signPublicKey(_, _2) {
        throw new Error('!');
    }
    async deriveKey(options) {
        return new FarcasterSymmetricKey(JSON.parse(await FarcasterCryptographyNativeKeyStore.agreeWithIdentityKey(this.base64PublicKey, options.counterpartyPublicKey.base64PublicKey)).id);
    }
    base64PublicKey;
}
export class FarcasterAsyncDataStore {
    async getSyncChannelKey(syncChannelIdentifier) {
        return await this.getItem('channelkey:' + syncChannelIdentifier, undefined);
    }
    async setSyncChannelKey(syncChannelIdentifier, symmetricKey) {
        await this.setItem('channelkey:' + syncChannelIdentifier, symmetricKey);
    }
    async getItem(key, fallback) {
        try {
            const result = await AsyncStorage.getItem(key);
            if (result === null) {
                return fallback;
            }
            return JSON.parse(result);
        }
        catch {
            return fallback;
        }
    }
    async setItem(key, value) {
        await AsyncStorage.setItem(key, value === undefined ? JSON.stringify(null) : JSON.stringify(value));
    }
}
export class FarcasterCryptographyKeyStore {
    constructor(name) {
        this.name = name;
    }
    name;
    async setName(name) {
        return await FarcasterCryptographyNativeKeyStore.initializeWithName(name);
    }
    async getSignedPreKey(pubKey) {
        return new FarcasterPrePrivateKey(JSON.parse(await FarcasterCryptographyNativeKeyStore.getSignedPreKey(pubKey.base64PublicKey)));
    }
    async getIdentityKey(pubKey) {
        return new FarcasterIdentitySigningPrivateKey(JSON.parse(await FarcasterCryptographyNativeKeyStore.getIdentityKey(pubKey.base64PublicKey)));
    }
    async getEphemeralKey(pubKey) {
        return new FarcasterEphemeralPrivateKey(JSON.parse(await FarcasterCryptographyNativeKeyStore.getEphemeralKey(pubKey.base64PublicKey)));
    }
    async getSymmetricKey(symmetricKey) {
        // TODO: make this method more direct in an update-we do this so a native
        // methods change (i.e. full app update) isn't required.
        try {
            const result = await AsyncStorage.getItem(symmetricKey.id);
            if (result !== null) {
                const baseKeyId = JSON.parse(result);
                const baseKeyJson = await FarcasterCryptographyNativeKeyStore.getSymmetricKey(baseKeyId);
                if (baseKeyJson) {
                    return new FarcasterSymmetricKey(JSON.parse(baseKeyJson).id);
                }
            }
        }
        catch { }
        return new FarcasterSymmetricKey(JSON.parse(await FarcasterCryptographyNativeKeyStore.getSymmetricKey(symmetricKey.id)).id);
    }
    async createSymmetricKey(id) {
        // TODO: make this method more direct in an update – we do this so a native
        // methods change (i.e. full app update) isn't required.
        try {
            const result = await AsyncStorage.getItem(id);
            if (result !== null) {
                const baseKeyId = JSON.parse(result);
                const baseKeyJson = await FarcasterCryptographyNativeKeyStore.getSymmetricKey(baseKeyId);
                if (baseKeyJson) {
                    return new FarcasterSymmetricKey(JSON.parse(baseKeyJson).id);
                }
            }
        }
        catch { }
        const left = await this.createEphemeralKey();
        const right = await this.createEphemeralKey();
        const baseSymKey = await left.deriveKey({
            derivationMode: AsymmetricDerivationMode.ECDH_SHA256,
            counterpartyPublicKey: right,
        });
        const baseKey = new FarcasterSymmetricKey(JSON.parse(await FarcasterCryptographyNativeKeyStore.getSymmetricKey(baseSymKey.id)).id);
        await AsyncStorage.setItem(id, JSON.stringify(baseKey.id));
        return baseKey;
    }
    async createIdentityKey() {
        return new FarcasterIdentitySigningPrivateKey(JSON.parse(await FarcasterCryptographyNativeKeyStore.createIdentityKey()));
    }
    async createSignedPreKey(identityPubKey) {
        return new FarcasterSignedPublicKey(JSON.parse(await FarcasterCryptographyNativeKeyStore.createSignedPreKey(identityPubKey.base64PublicKey)));
    }
    async createEphemeralKey() {
        return new FarcasterEphemeralPrivateKey(JSON.parse(await FarcasterCryptographyNativeKeyStore.createEphemeralKey()));
    }
    async deleteSignedPreKey(pubKey) {
        await FarcasterCryptographyNativeKeyStore.deleteSignedPreKey(pubKey.base64PublicKey);
    }
    async deleteEphemeralKey(pubKey) {
        await FarcasterCryptographyNativeKeyStore.deleteEphemeralKey(pubKey.base64PublicKey);
    }
    async deleteSymmetricKey(symmetricKey) {
        await FarcasterCryptographyNativeKeyStore.deleteSymmetricKey(symmetricKey.id);
    }
    async parsePublicKey(base64PublicKey) {
        return new FarcasterVerifyingPublicKey(JSON.parse(await FarcasterCryptographyNativeKeyStore.parsePublicKey(base64PublicKey)));
    }
    async verifyPublicKey(base64PubKey, base64Signature, base64SigningPublicKey) {
        return await FarcasterCryptographyNativeKeyStore.verifyPublicKey(base64PubKey, base64Signature, base64SigningPublicKey);
    }
    async deriveKey(options) {
        const keys = JSON.parse(await FarcasterCryptographyNativeKeyStore.deriveKey(JSON.stringify({
            derivationMode: options.derivationMode === SymmetricDerivationMode.HKDF_SHA256
                ? 'hkdfsha256'
                : 'hmacsha256',
            base64Salt: options.base64Salt,
            saltKeyId: options.saltKey === undefined
                ? undefined
                : options.saltKey.id,
            base64Prefix: options.base64Prefix,
            inputKeyIds: Array.isArray(options.inputKey)
                ? options.inputKey.map((i) => i.id)
                : [options.inputKey.id],
            info: options.info,
            outputLength: options.outputLength ?? 32,
            outputKeyLengths: options.outputKeyLengths,
        })));
        if (keys.length > 1) {
            return keys.map((k) => new FarcasterSymmetricKey(k.id));
        }
        else {
            return new FarcasterSymmetricKey(keys[0].id);
        }
    }
    async getStoredPasskeys() {
        if (await this.isPasskeysSupported()) {
            return JSON.parse(await FarcasterCryptographyNativeKeyStore.getStoredPasskeys());
        }
        else {
            throw new UnexpectedStateError({ message: 'not supported' });
        }
    }
    async updateStoredPasskey(credentialId, storedPasskey) {
        if (await this.isPasskeysSupported()) {
            return JSON.parse(await FarcasterCryptographyNativeKeyStore.updateStoredPasskeys(credentialId, JSON.stringify(storedPasskey)));
        }
        else {
            throw new UnexpectedStateError({ message: 'not supported' });
        }
    }
    async deleteStoredPasskey(credentialId) {
        if (await this.isPasskeysSupported()) {
            return JSON.parse(await FarcasterCryptographyNativeKeyStore.deleteStoredPasskey(credentialId));
        }
        else {
            throw new UnexpectedStateError({ message: 'not supported' });
        }
    }
    async hasRecoveryData(credentialId) {
        if (Platform.OS !== 'android') {
            // iOS stores recovery data in iCloud Keychain via largeBlob;
            // cannot check without an authentication ceremony. Return true
            // to skip the migration flow on iOS.
            return true;
        }
        if (await this.isPasskeysSupported()) {
            return FarcasterCryptographyNativeKeyStore.hasRecoveryData(credentialId);
        }
        return false;
    }
    async addMnemonicToCredential(request) {
        if (await this.isPasskeysSupported()) {
            // Native writes the mnemonic directly to iCloud Keychain and resolves with "true".
            // No FIDO2 assertion is performed — return a stub result so callers get a truthy value.
            await FarcasterCryptographyNativeKeyStore.addMnemonicToCredential(request.rpId, request.challenge, request.credentialId, request.largeBlob);
            return {
                id: request.credentialId,
                rawId: request.credentialId,
                response: {
                    clientDataJSON: '',
                    authenticatorData: '',
                    signature: '',
                    userHandle: '',
                },
            };
        }
        else {
            throw new UnexpectedStateError({ message: 'not supported' });
        }
    }
    async register(request) {
        if (await this.isPasskeysSupported()) {
            const { rpId, name, userID, challenge } = {
                rpId: request.rp.id,
                name: request.user.displayName,
                userID: request.user.id,
                challenge: request.challenge,
            };
            try {
                const response = await FarcasterCryptographyNativeKeyStore.register(rpId, challenge, name, userID);
                return {
                    id: response.credentialID,
                    rawId: response.credentialID,
                    response: {
                        clientDataJSON: response.response.rawClientDataJSON,
                        attestationObject: response.response.rawAttestationObject,
                    },
                };
            }
            catch (error) {
                throw error;
            }
        }
        else {
            throw new UnexpectedStateError({ message: 'not supported' });
        }
    }
    async authenticate(request) {
        if (await this.isPasskeysSupported()) {
            try {
                const response = await FarcasterCryptographyNativeKeyStore.authenticate(request.rpId, request.challenge, request.credentialId ?? '');
                return {
                    id: response.credentialID,
                    rawId: response.credentialID,
                    response: {
                        clientDataJSON: response.response.rawClientDataJSON,
                        authenticatorData: response.response.rawAuthenticatorData,
                        signature: response.response.signature,
                        userHandle: response.userID,
                    },
                    largeBlob: response.largeBlob,
                };
            }
            catch (error) {
                throw error;
            }
        }
        else {
            throw new UnexpectedStateError({ message: 'not supported' });
        }
    }
    async isPasskeysSupported() {
        if (Platform.OS === 'ios') {
            return parseInt(Platform.Version, 10) > 16;
        }
        if (Platform.OS === 'android') {
            return Platform.Version >= 34;
        }
        return false;
    }
    async getInbox() {
        const conv = JSON.parse(await FarcasterCryptographyNativeKeyStore.getInbox());
        conv.map((c) => {
            c.participants = c.participants.map((p) => {
                return {
                    ...p,
                    userInfo: JSON.parse(p.userInfo),
                };
            });
        });
        return conv;
    }
    async getConversationPage(conversationId, pageSize, before, after) {
        return JSON.parse(await FarcasterCryptographyNativeKeyStore.getConversationPage(conversationId, pageSize, before ?? after ?? 0, before !== undefined ? 'before' : 'after'));
    }
    async getInboxId() {
        return await FarcasterCryptographyNativeKeyStore.getInboxId();
    }
    async getConversationParticipants(conversationId) {
        const info = JSON.parse(await FarcasterCryptographyNativeKeyStore.getConversationParticipants(conversationId));
        return info.map((i) => {
            return {
                ...i,
                userInfo: JSON.parse(i.userInfo),
            };
        });
    }
    async bulkRatchetDecrypt(participants, messages) {
        return JSON.parse(await FarcasterCryptographyNativeKeyStore.bulkRatchetDecrypt(JSON.stringify(participants), JSON.stringify(messages)));
    }
    async bulkRatchetEncrypt(conversationId, keys, participants, message, account, fid, messageId) {
        return JSON.parse(await FarcasterCryptographyNativeKeyStore.bulkRatchetEncrypt(JSON.stringify(keys), JSON.stringify({
            conversationId,
            participants,
            message,
            account,
            fid,
            messageId,
        })));
    }
    async getPublicInboxKeys() {
        const [idkPublicKey, spkPublicKey, ibxPublicKey] = JSON.parse(await FarcasterCryptographyNativeKeyStore.getPublicInboxKeys());
        if (!idkPublicKey || !spkPublicKey || !ibxPublicKey) {
            throw new UnexpectedStateError({ message: 'keys not instantiated' });
        }
        return {
            idk: {
                keyId: '', // this is provided by the server
                type: 'idk',
                base64PublicKey: idkPublicKey,
                base64Signature: '', // this is provided upstream
                deviceId: '',
                deviceName: '',
                account: '', // this is provided upstream
                inboxId: ibxPublicKey,
                timestamp: Date.now(),
            },
            spk: {
                keyId: '', // this is provided by the server
                type: 'spk',
                base64PublicKey: spkPublicKey,
                base64Signature: '', // this is provided upstream
                deviceId: '',
                deviceName: '',
                account: '', // this is provided upstream
                inboxId: ibxPublicKey,
                timestamp: Date.now(),
            },
        };
    }
    async initializeWithName(name) {
        await FarcasterCryptographyNativeKeyStore.initializeWithName(name);
    }
    async setMessageStatus(messageId, fid, status) {
        await FarcasterCryptographyNativeKeyStore.setMessageStatus(messageId, fid, status);
    }
    async setConversationsRead(conversationReadInfo) {
        await FarcasterCryptographyNativeKeyStore.setConversationsRead(JSON.stringify(conversationReadInfo));
    }
    async wipeData() {
        await FarcasterCryptographyNativeKeyStore.wipeData();
    }
    async clearOldMessages() {
        await FarcasterCryptographyNativeKeyStore.clearOldMessages();
    }
    async deleteConversation(conversationId) {
        await FarcasterCryptographyNativeKeyStore.deleteConversation(conversationId);
    }
}
const FarcasterCryptographyNativeKeyStore = NativeModules.FarcasterCryptographyReactNative
    ? NativeModules.FarcasterCryptographyReactNative
    : new Proxy({}, {
        get() {
            throw new Error(LINKING_ERROR);
        },
    });
